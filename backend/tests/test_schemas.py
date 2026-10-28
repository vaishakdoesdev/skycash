import json
from datetime import datetime, timezone
from pathlib import Path
import pytest
from pydantic import ValidationError

from app.models.enums import (
    AlertSeverity,
    AlertStatus,
    AlertTriggerType,
    ApprovalStatus,
    BillingPeriod,
    Currency,
    DataResidencyRequirement,
    DataSensitivity,
    DependencyType,
    RecommendationStatus,
    TimeGranularity,
    ViolationSeverity,
)
from app.models.schemas import (
    ComplianceViolation,
    CostCapacityScenario,
    DependencyGraph,
    DependencyRelationship,
    PlacementRecommendation,
    PrivateDCAssumptions,
    PublicCloudRegion,
    ReviewAlert,
    UtilisationHistory,
    Workload,
    WorkloadSoftPreferences,
)

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
SYNTHETIC_DIR = REPO_ROOT / "data" / "synthetic"


# ==============================================================================
# Synthetic Dataset Validation Tests
# ==============================================================================

def test_load_and_validate_synthetic_datacenter_assumptions() -> None:
    path = SYNTHETIC_DIR / "datacenter_assumptions.json"
    assert path.exists(), f"Missing file {path}"
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    assumptions = PrivateDCAssumptions.model_validate(data)
    assert assumptions.dc_id == "karnataka-dc-1"
    assert assumptions.currency == Currency.INR
    assert assumptions.location_state == "Karnataka"
    assert assumptions.usable_cpu_cores <= assumptions.total_cpu_cores
    assert assumptions.usable_ram_gib <= assumptions.total_ram_gib
    assert assumptions.usable_storage_gib <= assumptions.total_storage_gib


def test_load_and_validate_synthetic_cloud_regions() -> None:
    path = SYNTHETIC_DIR / "cloud_regions.json"
    assert path.exists(), f"Missing file {path}"
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    regions = [PublicCloudRegion.model_validate(item) for item in data]
    assert len(regions) >= 2
    mumbai = next(r for r in regions if r.region_id == "aws-ap-south-1")
    assert mumbai.provider == "AWS"
    assert mumbai.approval_status == ApprovalStatus.APPROVED
    assert mumbai.location_country == "IN"
    assert DataSensitivity.CONFIDENTIAL in mumbai.allowed_sensitivities
    assert DataSensitivity.RESTRICTED not in mumbai.allowed_sensitivities


def test_load_and_validate_synthetic_workloads() -> None:
    path = SYNTHETIC_DIR / "workloads.json"
    assert path.exists(), f"Missing file {path}"
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    workloads = [Workload.model_validate(item) for item in data]
    assert len(workloads) == 6

    # Test core banking DB hard constraints
    core_db = next(w for w in workloads if w.id == "wl-core-banking-db")
    assert core_db.data_sensitivity == DataSensitivity.RESTRICTED
    assert core_db.residency_requirement == DataResidencyRequirement.KARNATAKA_DC_ONLY
    assert "RBI_LOCALIZATION" in core_db.required_certifications
    assert core_db.soft_preferences is None

    # Test customer portal
    portal = next(w for w in workloads if w.id == "wl-customer-portal")
    assert portal.data_sensitivity == DataSensitivity.PUBLIC
    assert portal.residency_requirement == DataResidencyRequirement.ANY_APPROVED_REGION
    assert portal.soft_preferences is not None
    assert portal.soft_preferences.preferred_provider == "AWS"


def test_load_and_validate_synthetic_dependencies() -> None:
    path = SYNTHETIC_DIR / "dependencies.json"
    assert path.exists(), f"Missing file {path}"
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    graph = DependencyGraph.model_validate(data)
    assert len(graph.nodes) == 6
    assert len(graph.edges) == 4
    assert "group-core-banking" in graph.co_location_groups
    assert set(graph.co_location_groups["group-core-banking"]) == {
        "wl-core-banking-db",
        "wl-core-banking-api",
    }

    # Verify mandatory co-location edge
    edge_api_to_db = next(e for e in graph.edges if e.id == "dep-api-to-db")
    assert edge_api_to_db.relationship_type == DependencyType.CO_LOCATE
    assert edge_api_to_db.is_mandatory is True
    assert edge_api_to_db.max_tolerable_latency_ms == 2.0


def test_load_and_validate_synthetic_utilisation_history() -> None:
    path = SYNTHETIC_DIR / "utilisation_history.json"
    assert path.exists(), f"Missing file {path}"
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    history = [UtilisationHistory.model_validate(item) for item in data]
    assert len(history) == 6
    for item in history:
        assert item.is_synthetic is True
        assert item.granularity == TimeGranularity.MONTHLY
        assert 0.0 <= item.cpu_utilization_pct <= 100.0
        assert 0.0 <= item.ram_utilization_pct <= 100.0


# ==============================================================================
# Model Field Validation & Boundary Constraint Tests
# ==============================================================================

def test_workload_rejects_extra_fields() -> None:
    with pytest.raises(ValidationError) as exc_info:
        Workload(
            id="wl-test",
            name="Test Workload",
            environment="production",
            current_placement="karnataka-dc-1",
            data_sensitivity=DataSensitivity.INTERNAL,
            residency_requirement=DataResidencyRequirement.INDIA_ONLY,
            allocated_cpu_cores=4.0,
            allocated_ram_gib=16.0,
            allocated_storage_gib=100.0,
            unrecognized_field="illegal_value",
        )
    assert "Extra inputs are not permitted" in str(exc_info.value)


def test_workload_rejects_non_positive_allocations() -> None:
    with pytest.raises(ValidationError):
        Workload(
            id="wl-bad-cpu",
            name="Bad CPU",
            environment="test",
            current_placement="karnataka-dc-1",
            data_sensitivity=DataSensitivity.PUBLIC,
            residency_requirement=DataResidencyRequirement.ANY_APPROVED_REGION,
            allocated_cpu_cores=0.0,  # Invalid: gt=0.0
            allocated_ram_gib=16.0,
            allocated_storage_gib=100.0,
        )


def test_placement_recommendation_schema() -> None:
    rec = PlacementRecommendation(
        workload_id="wl-customer-portal",
        current_placement="karnataka-dc-1",
        recommended_placement="aws-ap-south-1",
        status=RecommendationStatus.CHANGE_RECOMMENDED,
        current_monthly_cost=15800.0,
        recommended_monthly_cost=12300.0,
        projected_monthly_savings=3500.0,
        currency=Currency.INR,
        billing_period=BillingPeriod.MONTHLY,
        capacity_allocated_cpu=8.0,
        capacity_allocated_ram_gib=32.0,
        capacity_allocated_storage_gib=200.0,
        co_location_group_id=None,
        co_located_workload_ids=[],
        hard_compliance_passed=True,
        factors=["Cost reduction in public cloud", "Low data sensitivity (PUBLIC)"],
        assumptions=["AWS ap-south-1 on-demand pricing standard tier"],
        audit_explanation="Customer web tier is stateless and public, saving 3,500 INR/month on public cloud without violating residency.",
        rule_engine_version="0.1.0",
    )
    assert rec.projected_monthly_savings == 3500.0
    assert rec.hard_compliance_passed is True
    assert rec.status == RecommendationStatus.CHANGE_RECOMMENDED


def test_cost_capacity_scenario_schema() -> None:
    scenario = CostCapacityScenario(
        scenario_id="scenario-growth-12m",
        name="12-Month Organic Estate Growth",
        description="Assumes 20% compute growth and 15% storage growth across estate",
        timeframe_months=12,
        cpu_growth_rate_pct=20.0,
        ram_growth_rate_pct=15.0,
        storage_growth_rate_pct=25.0,
        cloud_cost_adjustment_pct=-5.0,
        private_dc_cost_adjustment_pct=3.0,
        projected_total_dc_cpu_used=380.0,
        projected_total_dc_ram_gib_used=2900.0,
        projected_total_dc_storage_gib_used=65000.0,
        projected_total_monthly_cost=450000.0,
        currency=Currency.INR,
    )
    assert scenario.timeframe_months == 12
    assert scenario.projected_total_monthly_cost == 450000.0


def test_compliance_violation_schema() -> None:
    violation = ComplianceViolation(
        id="viol-001",
        workload_id="wl-core-banking-db",
        placement_id="aws-ap-south-1",
        rule_name="DATA_RESIDENCY_KARNATAKA_DC_ONLY",
        severity=ViolationSeverity.HARD_VIOLATION,
        description="Core banking database requires Karnataka DC hosting by regulatory mandate; cannot place in Mumbai.",
        conflicting_attribute="location_state",
        required_value="Karnataka",
        actual_value="Maharashtra",
    )
    assert violation.severity == ViolationSeverity.HARD_VIOLATION
    assert violation.rule_name == "DATA_RESIDENCY_KARNATAKA_DC_ONLY"


def test_review_alert_schema() -> None:
    alert = ReviewAlert(
        alert_id="alert-001",
        workload_id="wl-analytics-reporting",
        created_at=datetime.now(timezone.utc),
        trigger_type=AlertTriggerType.PLACEMENT_CHANGED_OVER_TIME,
        severity=AlertSeverity.WARNING,
        title="Optimal placement changed from Private DC to Public Cloud",
        summary="Historical utilization shows off-peak idle hours exceeding 65%, favoring cloud elasticity.",
        previous_placement="karnataka-dc-1",
        new_placement="azure-central-india",
        cost_delta=-12000.0,
        currency=Currency.INR,
        status=AlertStatus.ACTIVE,
        audit_rationale="Utilization history triggers dynamic tiering rule based on off-peak elasticity savings.",
    )
    assert alert.trigger_type == AlertTriggerType.PLACEMENT_CHANGED_OVER_TIME
    assert alert.status == AlertStatus.ACTIVE
