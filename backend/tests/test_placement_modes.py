import pytest
from app.models.enums import (
    ApprovalStatus,
    DataResidencyRequirement,
    DataSensitivity,
    DependencyType,
    PlacementStrategyMode,
)
from app.models.schemas import (
    DependencyGraph,
    DependencyRelationship,
    PrivateDCAssumptions,
    PublicCloudRegion,
    Workload,
)
from app.engine.placement_modes import (
    evaluate_cloud_only_scenario,
    evaluate_hybrid_scenario,
    evaluate_local_only_scenario,
    evaluate_placement_flow,
)
from app.services.data_loader import load_all_data


@pytest.fixture
def mock_dc() -> PrivateDCAssumptions:
    return PrivateDCAssumptions(
        dc_id="karnataka-dc-1",
        name="Bengaluru Enterprise Private DC",
        location_country="IN",
        location_state="Karnataka",
        total_cpu_cores=100.0,
        usable_cpu_cores=80.0,
        total_ram_gib=1000.0,
        usable_ram_gib=800.0,
        total_storage_gib=10000.0,
        usable_storage_gib=8000.0,
        amortized_cost_per_cpu_core_month=1000.0,
        amortized_cost_per_ram_gib_month=100.0,
        amortized_cost_per_storage_gib_month=2.0,
        power_cooling_pue_overhead_pct=20.0,
        fixed_monthly_facility_cost=50000.0,
        assumptions_notes="Baseline DC fixture with 20% PUE overhead.",
    )


@pytest.fixture
def mock_clouds() -> list[PublicCloudRegion]:
    return [
        PublicCloudRegion(
            region_id="aws-ap-south-1",
            provider="AWS",
            region_name="Mumbai",
            location_country="IN",
            location_city="Mumbai",
            approval_status=ApprovalStatus.APPROVED,
            allowed_sensitivities=[
                DataSensitivity.PUBLIC,
                DataSensitivity.INTERNAL,
                DataSensitivity.CONFIDENTIAL,
            ],
            supports_residency_in=["IN"],
            compliance_certifications=["ISO27001", "RBI_LOCALIZATION"],
            compute_rate_per_vcpu_month=1200.0,
            memory_rate_per_gib_month=120.0,
            storage_ssd_rate_per_gib_month=2.5,
            egress_rate_per_gib=5.0,
            eligibility_rules=[],
        ),
        PublicCloudRegion(
            region_id="azure-central-india",
            provider="Azure",
            region_name="Pune",
            location_country="IN",
            location_city="Pune",
            approval_status=ApprovalStatus.APPROVED,
            allowed_sensitivities=[
                DataSensitivity.PUBLIC,
                DataSensitivity.INTERNAL,
                DataSensitivity.CONFIDENTIAL,
            ],
            supports_residency_in=["IN"],
            compliance_certifications=["ISO27001", "RBI_LOCALIZATION"],
            compute_rate_per_vcpu_month=1100.0,
            memory_rate_per_gib_month=110.0,
            storage_ssd_rate_per_gib_month=2.2,
            egress_rate_per_gib=4.5,
            eligibility_rules=[],
        ),
    ]


def test_cloud_only_compliance_rejection(mock_dc, mock_clouds):
    """Case 1: Cloud-only evaluation rejects workloads with local-only residency / sensitivity."""
    workload = Workload(
        id="wl-restricted-karnataka",
        name="Regulated Ledger Service",
        environment="production",
        current_placement="karnataka-dc-1",
        data_sensitivity=DataSensitivity.RESTRICTED,
        residency_requirement=DataResidencyRequirement.KARNATAKA_DC_ONLY,
        allocated_cpu_cores=8.0,
        allocated_ram_gib=32.0,
        allocated_storage_gib=200.0,
    )

    result = evaluate_placement_flow(
        mode=PlacementStrategyMode.CLOUD_ONLY,
        workloads=[workload],
        dc=mock_dc,
        cloud_regions=mock_clouds,
    )

    assert result.mode == PlacementStrategyMode.CLOUD_ONLY
    assert result.has_feasible_recommendation is False
    assert result.recommended_scenario is None
    assert len(result.evaluated_scenarios) == 1

    scenario = result.evaluated_scenarios[0]
    assert scenario.scenario_id == "scenario-cloud-only"
    assert scenario.is_feasible is False
    assert scenario.compliance_violations_count > 0
    assert "scenario-cloud-only" in result.rejected_scenarios
    assert "compliance violation" in result.rejected_scenarios["scenario-cloud-only"].lower()

    # Underutilisation analysis
    assert "private_dc_utilization" in result.capacity_analysis
    assert "underutilisation" in result.capacity_analysis["private_dc_utilization"].lower()


def test_cloud_only_all_eligible(mock_dc, mock_clouds):
    """Case 2: Cloud-only mode succeeds when all workloads are eligible for public cloud."""
    wl1 = Workload(
        id="wl-portal",
        name="Customer Portal",
        environment="production",
        current_placement="karnataka-dc-1",
        data_sensitivity=DataSensitivity.PUBLIC,
        residency_requirement=DataResidencyRequirement.ANY_APPROVED_REGION,
        allocated_cpu_cores=4.0,
        allocated_ram_gib=16.0,
        allocated_storage_gib=100.0,
    )
    wl2 = Workload(
        id="wl-reporting",
        name="Reporting Engine",
        environment="production",
        current_placement="karnataka-dc-1",
        data_sensitivity=DataSensitivity.INTERNAL,
        residency_requirement=DataResidencyRequirement.INDIA_ONLY,
        allocated_cpu_cores=8.0,
        allocated_ram_gib=32.0,
        allocated_storage_gib=200.0,
    )

    result = evaluate_placement_flow(
        mode=PlacementStrategyMode.CLOUD_ONLY,
        workloads=[wl1, wl2],
        dc=mock_dc,
        cloud_regions=mock_clouds,
    )

    assert result.has_feasible_recommendation is True
    assert result.recommended_scenario is not None
    assert result.recommended_scenario.scenario_id == "scenario-cloud-only"
    assert result.recommended_scenario.is_feasible is True
    assert result.recommended_scenario.compliance_violations_count == 0
    assert result.recommended_scenario.has_capacity_violations is False
    assert "Cloud-Only Placement" in result.recommendation_rationale


def test_local_only_capacity_overload(mock_dc, mock_clouds):
    """Case 3: Local-only scenario detects and reports capacity overload when DC limits are exceeded."""
    # mock_dc has usable_cpu_cores = 80.0
    wl_large = Workload(
        id="wl-oversized",
        name="Oversized Batch Cluster",
        environment="production",
        current_placement="karnataka-dc-1",
        data_sensitivity=DataSensitivity.INTERNAL,
        residency_requirement=DataResidencyRequirement.INDIA_ONLY,
        allocated_cpu_cores=100.0,  # Exceeds 80.0 cores
        allocated_ram_gib=400.0,
        allocated_storage_gib=2000.0,
    )

    result = evaluate_placement_flow(
        mode=PlacementStrategyMode.HYBRID,
        workloads=[wl_large],
        dc=mock_dc,
        cloud_regions=mock_clouds,
    )

    # Local-only scenario should fail capacity check
    local_scenario = next(s for s in result.evaluated_scenarios if s.scenario_id == "scenario-local-only")
    assert local_scenario.has_capacity_violations is True
    assert local_scenario.is_feasible is False
    assert local_scenario.capacity_violations_count >= 1

    # Capacity analysis identifies the deficit
    assert "local_only_capacity" in result.capacity_analysis
    assert "capacity overload" in result.capacity_analysis["local_only_capacity"].lower()
    assert "20.0 cores" in result.capacity_analysis["local_only_capacity"]

    # In hybrid mode, the workload can spill to cloud where it is compliant
    assert result.has_feasible_recommendation is True
    assert result.recommended_scenario.scenario_id == "scenario-hybrid"
    assert "scenario-local-only" in result.rejected_scenarios


def test_hybrid_selects_lowest_cost_feasible(mock_dc, mock_clouds):
    """Case 4: Hybrid mode compares Local-Only and Hybrid and recommends the lowest-cost feasible option."""
    # Workload 1: Must stay in Karnataka DC
    wl_db = Workload(
        id="wl-db",
        name="Core Database",
        environment="production",
        current_placement="karnataka-dc-1",
        data_sensitivity=DataSensitivity.RESTRICTED,
        residency_requirement=DataResidencyRequirement.KARNATAKA_DC_ONLY,
        allocated_cpu_cores=16.0,
        allocated_ram_gib=64.0,
        allocated_storage_gib=500.0,
    )
    # Workload 2: Cloud-eligible and cheaper in cloud
    # DC cost: (4*1000 + 16*100 + 50*2) * 1.2 = (4000 + 1600 + 100) * 1.2 = 5700 * 1.2 = 6840 INR
    # Azure cost: 4*1100 + 16*110 + 50*2.2 = 4400 + 1760 + 110 = 6270 INR (cheaper in cloud)
    wl_web = Workload(
        id="wl-web",
        name="Public Web Frontend",
        environment="production",
        current_placement="karnataka-dc-1",
        data_sensitivity=DataSensitivity.PUBLIC,
        residency_requirement=DataResidencyRequirement.ANY_APPROVED_REGION,
        allocated_cpu_cores=4.0,
        allocated_ram_gib=16.0,
        allocated_storage_gib=50.0,
    )

    result = evaluate_placement_flow(
        mode=PlacementStrategyMode.HYBRID,
        workloads=[wl_db, wl_web],
        dc=mock_dc,
        cloud_regions=mock_clouds,
    )

    assert result.has_feasible_recommendation is True
    assert result.recommended_scenario is not None
    # Hybrid is cheaper than Local-only while keeping wl-db compliant in DC
    assert result.recommended_scenario.scenario_id == "scenario-hybrid"
    assert "scenario-local-only" in result.rejected_scenarios
    assert "higher cost alternative" in result.rejected_scenarios["scenario-local-only"].lower()


def test_all_infeasible_scenario(mock_dc, mock_clouds):
    """Case 5: Explains reasons when every evaluated alternative is infeasible."""
    # Workload mandates Karnataka DC residency, but requires 150 cores (exceeds DC capacity of 80)
    wl_impossible = Workload(
        id="wl-impossible",
        name="Monolithic Ledger",
        environment="production",
        current_placement="karnataka-dc-1",
        data_sensitivity=DataSensitivity.RESTRICTED,
        residency_requirement=DataResidencyRequirement.KARNATAKA_DC_ONLY,
        allocated_cpu_cores=150.0,  # Exceeds DC usable CPU
        allocated_ram_gib=500.0,
        allocated_storage_gib=2000.0,
    )

    result = evaluate_placement_flow(
        mode=PlacementStrategyMode.HYBRID,
        workloads=[wl_impossible],
        dc=mock_dc,
        cloud_regions=mock_clouds,
    )

    assert result.has_feasible_recommendation is False
    assert result.recommended_scenario is None
    assert "No feasible placement option exists" in result.recommendation_rationale

    # Every scenario in evaluated_scenarios must be documented in rejected_scenarios
    for s in result.evaluated_scenarios:
        assert s.is_feasible is False
        assert s.scenario_id in result.rejected_scenarios
        assert "infeasible" in result.rejected_scenarios[s.scenario_id].lower()


def test_cloud_only_mandatory_co_location(mock_dc, mock_clouds):
    """Case 6: Mandatory co-location cluster must be placed together in Cloud-Only mode."""
    wl_api = Workload(
        id="wl-api",
        name="Banking API",
        environment="production",
        current_placement="karnataka-dc-1",
        data_sensitivity=DataSensitivity.CONFIDENTIAL,
        residency_requirement=DataResidencyRequirement.INDIA_ONLY,
        allocated_cpu_cores=4.0,
        allocated_ram_gib=16.0,
        allocated_storage_gib=50.0,
    )
    wl_db = Workload(
        id="wl-db-partner",
        name="Banking DB Partner",
        environment="production",
        current_placement="karnataka-dc-1",
        data_sensitivity=DataSensitivity.CONFIDENTIAL,
        residency_requirement=DataResidencyRequirement.INDIA_ONLY,
        allocated_cpu_cores=8.0,
        allocated_ram_gib=32.0,
        allocated_storage_gib=200.0,
    )

    graph = DependencyGraph(
        nodes=["wl-api", "wl-db-partner"],
        edges=[
            DependencyRelationship(
                id="dep-api-db",
                source_workload_id="wl-api",
                target_workload_id="wl-db-partner",
                relationship_type=DependencyType.CO_LOCATE,
                is_mandatory=True,
            )
        ],
        co_location_groups={"bank-group": ["wl-api", "wl-db-partner"]},
    )

    result = evaluate_placement_flow(
        mode=PlacementStrategyMode.CLOUD_ONLY,
        workloads=[wl_api, wl_db],
        dc=mock_dc,
        cloud_regions=mock_clouds,
        dependency_graph=graph,
    )

    assert result.has_feasible_recommendation is True
    scenario = result.recommended_scenario
    assert scenario.mandatory_dependency_groups_total == 1
    assert scenario.mandatory_dependency_groups_preserved == 1
    assert scenario.mandatory_dependency_groups_fraction == 1.0

    # Confirm both workloads share the EXACT same cloud region
    breakdown_map = {b.workload_id: b.assigned_placement for b in scenario.per_workload_breakdown}
    assert breakdown_map["wl-api"] == breakdown_map["wl-db-partner"]
    assert breakdown_map["wl-api"] in ["aws-ap-south-1", "azure-central-india"]


def test_synthetic_dataset_placement_flow():
    """Case 7: Evaluates the actual deterministic synthetic dataset."""
    loaded = load_all_data()

    # 1. Cloud-only mode: should be infeasible because wl-core-banking-db mandates Karnataka DC
    cloud_result = evaluate_placement_flow(
        mode=PlacementStrategyMode.CLOUD_ONLY,
        workloads=loaded.workloads,
        dc=loaded.dc_assumptions,
        cloud_regions=loaded.cloud_regions,
        dependency_graph=loaded.dependency_graph,
        utilisation=loaded.utilisation_history,
    )
    assert cloud_result.has_feasible_recommendation is False
    assert cloud_result.recommended_scenario is None
    assert "scenario-cloud-only" in cloud_result.rejected_scenarios

    # 2. Hybrid mode: should be feasible and recommend Hybrid
    hybrid_result = evaluate_placement_flow(
        mode=PlacementStrategyMode.HYBRID,
        workloads=loaded.workloads,
        dc=loaded.dc_assumptions,
        cloud_regions=loaded.cloud_regions,
        dependency_graph=loaded.dependency_graph,
        utilisation=loaded.utilisation_history,
    )
    assert hybrid_result.has_feasible_recommendation is True
    assert hybrid_result.recommended_scenario is not None
    assert hybrid_result.recommended_scenario.is_feasible is True
    assert hybrid_result.recommended_scenario.scenario_id in ["scenario-hybrid", "scenario-local-only"]
