import json
from pathlib import Path
import pytest

from app.models.enums import (
    ApprovalStatus,
    DataResidencyRequirement,
    DataSensitivity,
    DependencyType,
    RecommendationStatus,
)
from app.models.schemas import (
    DependencyGraph,
    DependencyRelationship,
    PrivateDCAssumptions,
    PublicCloudRegion,
    Workload,
    WorkloadSoftPreferences,
)
from app.engine.evaluator import evaluate_workloads

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
SYNTHETIC_DIR = REPO_ROOT / "data" / "synthetic"


@pytest.fixture
def base_dc() -> PrivateDCAssumptions:
    with open(SYNTHETIC_DIR / "datacenter_assumptions.json", "r", encoding="utf-8") as f:
        return PrivateDCAssumptions.model_validate(json.load(f))


@pytest.fixture
def base_cloud_regions() -> list[PublicCloudRegion]:
    with open(SYNTHETIC_DIR / "cloud_regions.json", "r", encoding="utf-8") as f:
        return [PublicCloudRegion.model_validate(r) for r in json.load(f)]


# ==============================================================================
# Case A: Cheapest Eligible Placement
# Choose the lower-cost option when both placements are valid.
# ==============================================================================

def test_cheapest_eligible_placement_chosen_when_both_valid(
    base_dc: PrivateDCAssumptions,
) -> None:
    """When two placements (e.g. DC and an approved Indian Cloud region) are both
    fully compliant and fit within capacity, the engine chooses the lower-cost option.
    """
    # Create a small compliant cloud region that is cheaper than the DC for a small workload
    cheap_cloud = PublicCloudRegion(
        region_id="cloud-cheap-india",
        provider="CloudProvider",
        region_name="India Central (Cheap)",
        location_country="IN",
        location_city="Pune",
        approval_status=ApprovalStatus.APPROVED,
        allowed_sensitivities=[DataSensitivity.PUBLIC, DataSensitivity.INTERNAL],
        supports_residency_in=["IN"],
        currency=base_dc.currency,
        compute_rate_per_vcpu_month=500.0,    # Very cheap compute
        memory_rate_per_gib_month=50.0,       # Very cheap RAM
        storage_ssd_rate_per_gib_month=2.0,   # Very cheap storage
        egress_rate_per_gib=1.0,
    )

    wl = Workload(
        id="wl-stateless-web",
        name="Stateless Web Tier",
        environment="production",
        current_placement="karnataka-dc-1",
        data_sensitivity=DataSensitivity.PUBLIC,
        residency_requirement=DataResidencyRequirement.INDIA_ONLY,
        allocated_cpu_cores=4.0,
        allocated_ram_gib=16.0,
        allocated_storage_gib=100.0,
    )

    recs = evaluate_workloads([wl], base_dc, [cheap_cloud])
    assert len(recs) == 1
    rec = recs[0]

    # Both karnataka-dc-1 and cloud-cheap-india are valid, but cloud-cheap-india is cheaper
    assert rec.recommended_placement == "cloud-cheap-india"
    assert rec.status == RecommendationStatus.CHANGE_RECOMMENDED
    assert rec.recommended_monthly_cost < rec.current_monthly_cost
    assert rec.projected_monthly_savings > 0.0
    assert "karnataka-dc-1" in rec.rejected_alternatives
    assert "higher monthly cost" in rec.rejected_alternatives["karnataka-dc-1"].lower()


# ==============================================================================
# Case B: Residency Restriction
# Reject a cheaper cloud region when data residency rules prohibit it.
# ==============================================================================

def test_cheaper_placement_violating_residency_is_rejected(
    base_dc: PrivateDCAssumptions,
    base_cloud_regions: list[PublicCloudRegion],
) -> None:
    """Public cloud US region (aws-us-east-1) has lower compute/storage rates,
    but violates the INDIA_ONLY data residency mandate. It must be rejected.
    Hard compliance rules always override cost savings.
    """
    wl = Workload(
        id="wl-india-sovereign",
        name="Sovereign Indian Service",
        environment="production",
        current_placement="karnataka-dc-1",
        data_sensitivity=DataSensitivity.INTERNAL,
        residency_requirement=DataResidencyRequirement.INDIA_ONLY,
        allocated_cpu_cores=8.0,
        allocated_ram_gib=32.0,
        allocated_storage_gib=500.0,
    )

    recs = evaluate_workloads([wl], base_dc, base_cloud_regions)
    rec = recs[0]

    # aws-us-east-1 has the lowest cloud rate in cloud_regions.json, but MUST be rejected
    assert rec.recommended_placement != "aws-us-east-1"
    assert "aws-us-east-1" in rec.rejected_alternatives
    rejection_msg = rec.rejected_alternatives["aws-us-east-1"].lower()
    assert "residency" in rejection_msg or "approval" in rejection_msg
    assert rec.hard_compliance_passed is True


def test_workload_restricted_to_karnataka_dc_rejects_all_cloud_regions(
    base_dc: PrivateDCAssumptions,
    base_cloud_regions: list[PublicCloudRegion],
) -> None:
    """Workload with RESTRICTED sensitivity and KARNATAKA_DC_ONLY residency
    must only be placed in Karnataka DC. All cloud regions must be rejected.
    """
    wl = Workload(
        id="wl-restricted-core",
        name="Restricted Core DB",
        environment="production",
        current_placement="karnataka-dc-1",
        data_sensitivity=DataSensitivity.RESTRICTED,
        residency_requirement=DataResidencyRequirement.KARNATAKA_DC_ONLY,
        required_certifications=["RBI_LOCALIZATION"],
        allocated_cpu_cores=16.0,
        allocated_ram_gib=64.0,
        allocated_storage_gib=1000.0,
        storage_tier="NVME",
    )

    recs = evaluate_workloads([wl], base_dc, base_cloud_regions)
    rec = recs[0]

    assert rec.recommended_placement == "karnataka-dc-1"
    assert rec.status == RecommendationStatus.NO_CHANGE
    assert rec.hard_compliance_passed is True
    # All cloud regions must appear in rejected_alternatives
    assert "aws-ap-south-1" in rec.rejected_alternatives
    assert "azure-central-india" in rec.rejected_alternatives
    assert "aws-us-east-1" in rec.rejected_alternatives


# ==============================================================================
# Case C: Capacity Limit
# Reject a placement that exceeds available capacity.
# ==============================================================================

def test_dc_capacity_limit_makes_placement_infeasible_for_dc(
    base_dc: PrivateDCAssumptions,
    base_cloud_regions: list[PublicCloudRegion],
) -> None:
    """Workload requesting more cores than usable DC capacity cannot be placed
    in Private DC due to capacity headroom breach.
    """
    # DC usable CPU is 460.0. Request 500 cores.
    wl = Workload(
        id="wl-huge-compute",
        name="High Performance Compute Cluster",
        environment="production",
        current_placement="karnataka-dc-1",
        data_sensitivity=DataSensitivity.PUBLIC,
        residency_requirement=DataResidencyRequirement.ANY_APPROVED_REGION,
        allocated_cpu_cores=500.0,  # Exceeds usable DC limit of 460
        allocated_ram_gib=1024.0,
        allocated_storage_gib=5000.0,
    )

    recs = evaluate_workloads([wl], base_dc, base_cloud_regions)
    rec = recs[0]

    # Private DC must be rejected due to capacity overflow
    assert rec.recommended_placement != "karnataka-dc-1"
    assert "karnataka-dc-1" in rec.rejected_alternatives
    assert "capacity breached" in rec.rejected_alternatives["karnataka-dc-1"].lower()
    # Falls back to an approved public cloud region that can fit it
    assert rec.recommended_placement in ("aws-ap-south-1", "azure-central-india")


# ==============================================================================
# Case D: Dependency Co-Location
# Keep workloads together when the model specifies mandatory co-location.
# ==============================================================================

def test_dependent_workloads_remain_co_located(
    base_dc: PrivateDCAssumptions,
    base_cloud_regions: list[PublicCloudRegion],
) -> None:
    """Workload A (DB) requires Karnataka DC (Restricted).
    Workload B (API) by itself could run in public cloud, but has a mandatory
    CO_LOCATE dependency on Workload A.
    Both must be co-located together in Karnataka DC.
    """
    db_wl = Workload(
        id="wl-co-db",
        name="DB Tier",
        environment="production",
        current_placement="karnataka-dc-1",
        data_sensitivity=DataSensitivity.RESTRICTED,
        residency_requirement=DataResidencyRequirement.KARNATAKA_DC_ONLY,
        allocated_cpu_cores=16.0,
        allocated_ram_gib=64.0,
        allocated_storage_gib=1000.0,
    )
    api_wl = Workload(
        id="wl-co-api",
        name="API Tier",
        environment="production",
        current_placement="karnataka-dc-1",
        data_sensitivity=DataSensitivity.PUBLIC,
        residency_requirement=DataResidencyRequirement.ANY_APPROVED_REGION,
        allocated_cpu_cores=8.0,
        allocated_ram_gib=32.0,
        allocated_storage_gib=200.0,
    )

    graph = DependencyGraph(
        nodes=["wl-co-db", "wl-co-api"],
        edges=[
            DependencyRelationship(
                id="dep-api-db-mandatory",
                source_workload_id="wl-co-api",
                target_workload_id="wl-co-db",
                relationship_type=DependencyType.CO_LOCATE,
                is_mandatory=True,
            )
        ],
        co_location_groups={"group-co-db-api": ["wl-co-db", "wl-co-api"]},
    )

    recs = evaluate_workloads([db_wl, api_wl], base_dc, base_cloud_regions, dependency_graph=graph)
    assert len(recs) == 2

    rec_db = next(r for r in recs if r.workload_id == "wl-co-db")
    rec_api = next(r for r in recs if r.workload_id == "wl-co-api")

    # Both must be recommended for the exact same placement
    assert rec_db.recommended_placement == rec_api.recommended_placement == "karnataka-dc-1"
    assert rec_api.co_location_group_id is not None
    assert "wl-co-db" in rec_api.co_located_workload_ids


def test_co_location_group_infeasible_reported_instead_of_silently_split(
    base_dc: PrivateDCAssumptions,
    base_cloud_regions: list[PublicCloudRegion],
) -> None:
    """Two workloads in a mandatory co-location group have mutually exclusive constraints:
    Workload A requires KARNATAKA_DC_ONLY (cannot go to cloud).
    Combined capacity of A + B exceeds Private DC capacity.
    The engine must report INFEASIBLE for both instead of silently splitting the group.
    """
    wl_a = Workload(
        id="wl-group-a",
        name="Workload A",
        environment="production",
        current_placement="karnataka-dc-1",
        data_sensitivity=DataSensitivity.RESTRICTED,
        residency_requirement=DataResidencyRequirement.KARNATAKA_DC_ONLY,
        allocated_cpu_cores=300.0,
        allocated_ram_gib=2000.0,
        allocated_storage_gib=10000.0,
    )
    wl_b = Workload(
        id="wl-group-b",
        name="Workload B",
        environment="production",
        current_placement="karnataka-dc-1",
        data_sensitivity=DataSensitivity.RESTRICTED,
        residency_requirement=DataResidencyRequirement.KARNATAKA_DC_ONLY,
        allocated_cpu_cores=300.0,  # Combined cores = 600.0, exceeds DC limit of 460
        allocated_ram_gib=2000.0,
        allocated_storage_gib=10000.0,
    )

    graph = DependencyGraph(
        nodes=["wl-group-a", "wl-group-b"],
        edges=[
            DependencyRelationship(
                id="dep-a-b",
                source_workload_id="wl-group-a",
                target_workload_id="wl-group-b",
                relationship_type=DependencyType.CO_LOCATE,
                is_mandatory=True,
            )
        ],
        co_location_groups={"group-unfittable": ["wl-group-a", "wl-group-b"]},
    )

    recs = evaluate_workloads([wl_a, wl_b], base_dc, base_cloud_regions, dependency_graph=graph)
    assert len(recs) == 2
    for r in recs:
        assert r.status == RecommendationStatus.INELIGIBLE
        assert r.recommended_placement is None
        assert r.hard_compliance_passed is False
        assert "infeasible" in r.audit_explanation.lower()


# ==============================================================================
# Case E: Missing or Conflicting Data
# Return a clear review-required result when required information is missing/conflicting.
# ==============================================================================

def test_workload_with_conflicting_information_triggers_review_required(
    base_dc: PrivateDCAssumptions,
    base_cloud_regions: list[PublicCloudRegion],
) -> None:
    """A workload with mutually contradictory constraints:
    mandates KARNATAKA_DC_ONLY residency, but requests AWS in soft preferences.
    Must return REVIEW_REQUIRED rather than an ungrounded recommendation.
    """
    conflicting_wl = Workload(
        id="wl-contradictory",
        name="Contradictory Workload",
        environment="production",
        current_placement="karnataka-dc-1",
        data_sensitivity=DataSensitivity.RESTRICTED,
        residency_requirement=DataResidencyRequirement.KARNATAKA_DC_ONLY,
        allocated_cpu_cores=8.0,
        allocated_ram_gib=32.0,
        allocated_storage_gib=200.0,
        soft_preferences=WorkloadSoftPreferences(
            preferred_provider="AWS",  # Contradicts KARNATAKA_DC_ONLY
        ),
    )

    recs = evaluate_workloads([conflicting_wl], base_dc, base_cloud_regions)
    rec = recs[0]

    assert rec.status == RecommendationStatus.REVIEW_REQUIRED
    assert rec.recommended_placement is None
    assert "review required" in rec.audit_explanation.lower()


def test_workload_with_missing_current_placement_triggers_review_required(
    base_dc: PrivateDCAssumptions,
    base_cloud_regions: list[PublicCloudRegion],
) -> None:
    """When a workload has missing or unspecified current_placement ('UNKNOWN'),
    the engine returns REVIEW_REQUIRED rather than inventing a placement.
    """
    missing_data_wl = Workload(
        id="wl-unknown-loc",
        name="Unspecified Location Workload",
        environment="production",
        current_placement="UNKNOWN",  # Missing/unspecified current placement
        data_sensitivity=DataSensitivity.INTERNAL,
        residency_requirement=DataResidencyRequirement.INDIA_ONLY,
        allocated_cpu_cores=4.0,
        allocated_ram_gib=16.0,
        allocated_storage_gib=100.0,
    )

    recs = evaluate_workloads([missing_data_wl], base_dc, base_cloud_regions)
    rec = recs[0]

    assert rec.status == RecommendationStatus.REVIEW_REQUIRED
    assert rec.recommended_placement is None
    assert "missing or unspecified current_placement" in rec.audit_explanation.lower()


# ==============================================================================
# Case F: Equal Costs (Deterministic Tie-Breaking)
# Handle a tie deterministically.
# ==============================================================================

def test_tie_between_eligible_placements_uses_deterministic_tie_breaking(
    base_dc: PrivateDCAssumptions,
) -> None:
    """When two cloud regions have the exact same cost:
    1. If one matches current_placement, prefer current_placement (minimize churn).
    2. Otherwise, break tie deterministically by alphabetical region_id.
    """
    region_a = PublicCloudRegion(
        region_id="cloud-alpha",
        provider="CloudA",
        region_name="Alpha",
        location_country="IN",
        location_city="Mumbai",
        approval_status=ApprovalStatus.APPROVED,
        allowed_sensitivities=[DataSensitivity.PUBLIC],
        supports_residency_in=["IN"],
        currency=base_dc.currency,
        compute_rate_per_vcpu_month=1000.0,
        memory_rate_per_gib_month=100.0,
        storage_ssd_rate_per_gib_month=5.0,
        egress_rate_per_gib=5.0,
    )
    region_b = PublicCloudRegion(
        region_id="cloud-beta",
        provider="CloudB",
        region_name="Beta",
        location_country="IN",
        location_city="Pune",
        approval_status=ApprovalStatus.APPROVED,
        allowed_sensitivities=[DataSensitivity.PUBLIC],
        supports_residency_in=["IN"],
        currency=base_dc.currency,
        compute_rate_per_vcpu_month=1000.0,  # Exact same cost
        memory_rate_per_gib_month=100.0,
        storage_ssd_rate_per_gib_month=5.0,
        egress_rate_per_gib=5.0,
    )

    # Subcase 1: Current placement is cloud-beta -> should keep cloud-beta (prefer current)
    wl_current_beta = Workload(
        id="wl-tie-beta",
        name="Tie Beta Workload",
        environment="production",
        current_placement="cloud-beta",
        data_sensitivity=DataSensitivity.PUBLIC,
        residency_requirement=DataResidencyRequirement.INDIA_ONLY,
        allocated_cpu_cores=4.0,
        allocated_ram_gib=16.0,
        allocated_storage_gib=100.0,
    )
    recs_a = evaluate_workloads([wl_current_beta], base_dc, [region_a, region_b])
    assert recs_a[0].recommended_placement == "cloud-beta"
    assert recs_a[0].status == RecommendationStatus.NO_CHANGE

    # Subcase 2: Neither is current placement -> alphabetical tie-break selects cloud-alpha
    wl_unplaced = Workload(
        id="wl-tie-neutral",
        name="Tie Neutral Workload",
        environment="production",
        current_placement="other-dc",
        data_sensitivity=DataSensitivity.PUBLIC,
        residency_requirement=DataResidencyRequirement.INDIA_ONLY,
        allocated_cpu_cores=4.0,
        allocated_ram_gib=16.0,
        allocated_storage_gib=100.0,
    )
    recs_b = evaluate_workloads([wl_unplaced], base_dc, [region_a, region_b])
    assert recs_b[0].recommended_placement == "cloud-alpha"


# ==============================================================================
# Case G: No Feasible Placement Exists
# Report that no valid placement exists instead of inventing one.
# Infeasible recommendations cannot be marked as successful placements.
# ==============================================================================

def test_no_feasible_placement_exists(
    base_dc: PrivateDCAssumptions,
    base_cloud_regions: list[PublicCloudRegion],
) -> None:
    """Workload requiring KARNATAKA_DC_ONLY (cannot go to cloud)
    demanding 5,000 cores (exceeds Private DC usable limit of 460).
    No candidate placement can satisfy both compliance and capacity.
    Engine must return INELIGIBLE with explicit rejections.
    """
    huge_restricted_wl = Workload(
        id="wl-impossible",
        name="Impossible Workload",
        environment="production",
        current_placement="karnataka-dc-1",
        data_sensitivity=DataSensitivity.RESTRICTED,
        residency_requirement=DataResidencyRequirement.KARNATAKA_DC_ONLY,
        allocated_cpu_cores=5000.0,  # Far exceeds DC limit
        allocated_ram_gib=10000.0,
        allocated_storage_gib=200000.0,
    )

    recs = evaluate_workloads([huge_restricted_wl], base_dc, base_cloud_regions)
    rec = recs[0]

    assert rec.status == RecommendationStatus.INELIGIBLE
    assert rec.recommended_placement is None  # Infeasible cannot have a placement
    assert rec.recommended_monthly_cost is None
    assert rec.projected_monthly_savings is None
    assert rec.hard_compliance_passed is False
    assert len(rec.rejected_alternatives) >= 3  # All candidates recorded
    assert "infeasible" in rec.audit_explanation.lower()


# ==============================================================================
# Full Explainability & Determinism Tests
# ==============================================================================

def test_explainability_payload_contains_all_required_dimensions(
    base_dc: PrivateDCAssumptions,
    base_cloud_regions: list[PublicCloudRegion],
) -> None:
    """Confirms that recommendations populate selected placement, relevant costs,
    binding constraints, factors, assumptions, and rejected alternatives.
    """
    wl = Workload(
        id="wl-explain-test",
        name="Explainability Test Workload",
        environment="production",
        current_placement="karnataka-dc-1",
        data_sensitivity=DataSensitivity.INTERNAL,
        residency_requirement=DataResidencyRequirement.INDIA_ONLY,
        allocated_cpu_cores=8.0,
        allocated_ram_gib=32.0,
        allocated_storage_gib=400.0,
    )

    recs = evaluate_workloads([wl], base_dc, base_cloud_regions)
    rec = recs[0]

    assert rec.recommended_placement is not None
    assert rec.current_monthly_cost > 0.0
    assert rec.recommended_monthly_cost is not None and rec.recommended_monthly_cost > 0.0
    assert rec.projected_monthly_savings is not None
    assert len(rec.factors) > 0
    assert len(rec.binding_constraints) > 0
    assert len(rec.assumptions) > 0
    assert len(rec.rejected_alternatives) > 0
    assert len(rec.audit_explanation) > 20


def test_determinism_for_identical_inputs(
    base_dc: PrivateDCAssumptions,
    base_cloud_regions: list[PublicCloudRegion],
) -> None:
    """Verifies that calling the decision engine multiple times on identical
    inputs produces identical outputs without drift.
    """
    with open(SYNTHETIC_DIR / "workloads.json", "r", encoding="utf-8") as f:
        workloads = [Workload.model_validate(w) for w in json.load(f)]
    with open(SYNTHETIC_DIR / "dependencies.json", "r", encoding="utf-8") as f:
        graph = DependencyGraph.model_validate(json.load(f))

    recs_1 = evaluate_workloads(workloads, base_dc, base_cloud_regions, dependency_graph=graph)
    recs_2 = evaluate_workloads(workloads, base_dc, base_cloud_regions, dependency_graph=graph)

    assert len(recs_1) == len(recs_2)
    for r1, r2 in zip(recs_1, recs_2):
        assert r1.workload_id == r2.workload_id
        assert r1.recommended_placement == r2.recommended_placement
        assert r1.status == r2.status
        assert r1.recommended_monthly_cost == r2.recommended_monthly_cost
        assert r1.rejected_alternatives == r2.rejected_alternatives
