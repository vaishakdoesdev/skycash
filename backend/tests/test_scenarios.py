import pytest
from app.models.enums import (
    ApprovalStatus,
    Currency,
    DataResidencyRequirement,
    DataSensitivity,
    DependencyType,
)
from app.models.schemas import (
    DependencyGraph,
    DependencyRelationship,
    PrivateDCAssumptions,
    PublicCloudRegion,
    Workload,
)
from app.engine.scenarios import (
    SIGN_CONVENTION_NOTE,
    evaluate_scenario,
    evaluate_scenario_report,
)


@pytest.fixture
def mock_dc() -> PrivateDCAssumptions:
    """Hand-calculated small DC baseline.
    Rates:
      CPU: 1,000 INR/core-month
      RAM: 100 INR/GiB-month
      Storage: 10 INR/GiB-month
      PUE Overhead: 20.0% (multiplier 1.20)
    Capacity:
      CPU usable: 100.0 cores (total 120.0)
      RAM usable: 200.0 GiB (total 256.0)
      Storage usable: 1,000.0 GiB (total 1,200.0)
    """
    return PrivateDCAssumptions(
        dc_id="karnataka-dc-1",
        name="Small Karnataka Test DC",
        location_country="IN",
        location_state="Karnataka",
        total_cpu_cores=120.0,
        usable_cpu_cores=100.0,
        total_ram_gib=256.0,
        usable_ram_gib=200.0,
        total_storage_gib=1200.0,
        usable_storage_gib=1000.0,
        currency=Currency.INR,
        amortized_cost_per_cpu_core_month=1000.0,
        amortized_cost_per_ram_gib_month=100.0,
        amortized_cost_per_storage_gib_month=10.0,
        power_cooling_pue_overhead_pct=20.0,
        fixed_monthly_facility_cost=50000.0,
        assumptions_notes="Hand-calculated test assumptions with 20% PUE multiplier",
    )


@pytest.fixture
def mock_cloud_region(mock_dc: PrivateDCAssumptions) -> PublicCloudRegion:
    """Hand-calculated cheap compliant Indian Cloud Region.
    Rates:
      CPU: 500 INR/core-month
      RAM: 50 INR/GiB-month
      Storage: 5 INR/GiB-month
      Egress: 0 INR/GiB
    """
    return PublicCloudRegion(
        region_id="cloud-india-test",
        provider="TestCloud",
        region_name="India Central Test",
        location_country="IN",
        location_city="Pune",
        approval_status=ApprovalStatus.APPROVED,
        allowed_sensitivities=[DataSensitivity.PUBLIC, DataSensitivity.INTERNAL, DataSensitivity.CONFIDENTIAL],
        supports_residency_in=["IN"],
        currency=mock_dc.currency,
        compute_rate_per_vcpu_month=500.0,
        memory_rate_per_gib_month=50.0,
        storage_ssd_rate_per_gib_month=5.0,
        egress_rate_per_gib=0.0,
    )


# ==============================================================================
# Case 1: Hand-Calculated Scenario Where Recommendation Costs LESS (Savings)
# ==============================================================================

def test_recommended_scenario_costs_less_than_current(
    mock_dc: PrivateDCAssumptions,
    mock_cloud_region: PublicCloudRegion,
) -> None:
    """Workload currently in high-cost on-premise DC.
    Public cloud is fully compliant and cheaper.
    Hand-calculated figures:
      DC cost:
        Compute: 4 * 1000 = 4000
        RAM:     8 * 100  = 800
        Storage: 50 * 10  = 500
        Subtotal = 5300
        PUE multiplier 1.20 -> 5300 * 1.20 = 6,360.00 INR
      Cloud cost:
        Compute: 4 * 500 = 2000
        RAM:     8 * 50  = 400
        Storage: 50 * 5  = 250
        Total = 2,650.00 INR
      Absolute difference:
        2650.00 - 6360.00 = -3,710.00 INR (Negative = cost reduction / savings)
      Percentage difference:
        (-3710.00 / 6360.00) * 100 = -58.33%
    """
    wl = Workload(
        id="wl-stateless",
        name="Stateless Web Service",
        environment="production",
        current_placement="karnataka-dc-1",
        data_sensitivity=DataSensitivity.PUBLIC,
        residency_requirement=DataResidencyRequirement.INDIA_ONLY,
        allocated_cpu_cores=4.0,
        allocated_ram_gib=8.0,
        allocated_storage_gib=50.0,
    )

    report = evaluate_scenario_report(
        workloads=[wl],
        dc=mock_dc,
        cloud_regions=[mock_cloud_region],
    )

    # 1. Baseline Current Placement
    curr = report.current_scenario
    assert curr.projected_monthly_cost == 6360.00
    assert curr.cost_difference_absolute == 0.0
    assert curr.cost_difference_pct == 0.0

    # 2. Recommended Scenario
    rec = report.recommended_scenario
    assert rec.projected_monthly_cost == 2650.00
    assert rec.cost_difference_absolute == -3710.00  # Exactly matches hand calculation
    assert rec.cost_difference_pct == -58.33        # Exactly -58.33%
    assert rec.is_cost_estimate is True
    assert rec.compliance_violations_count == 0
    assert rec.is_feasible is True

    # 3. Check Sign Convention string
    assert "Negative (< 0) indicates cost reduction / savings" in rec.sign_convention


# ==============================================================================
# Case 2: Hand-Calculated Scenario Where Recommendation Costs MORE (Compliance)
# ==============================================================================

def test_recommended_scenario_costs_more_to_satisfy_compliance(
    mock_dc: PrivateDCAssumptions,
    mock_cloud_region: PublicCloudRegion,
) -> None:
    """Workload currently running in a cheap cloud region, but its data classification
    is RESTRICTED and residency mandates KARNATAKA_DC_ONLY.
    Current placement is therefore ILLEGAL / NON-COMPLIANT.
    Moving it to compliant Karnataka DC increases cost, but achieves 100% compliance.
    Hand-calculated figures:
      Current cloud cost (non-compliant):
        Compute: 8 * 500 = 4000
        RAM:     32 * 50 = 1600
        Storage: 200 * 5 = 1000
        Total = 6,600.00 INR
      Recommended compliant DC cost:
        Compute: 8 * 1000 = 8000
        RAM:     32 * 100 = 3200
        Storage: 200 * 10 = 2000
        Subtotal = 13200
        PUE multiplier 1.20 -> 13200 * 1.20 = 15,840.00 INR
      Absolute difference:
        15840.00 - 6600.00 = +9,240.00 INR (Positive = cost increase / compliance premium)
      Percentage difference:
        (+9240.00 / 6600.00) * 100 = +140.0%
    """
    non_compliant_wl = Workload(
        id="wl-rogue-ledger-db",
        name="Regulated Ledger DB",
        environment="production",
        current_placement="cloud-india-test",  # Non-compliant placement
        data_sensitivity=DataSensitivity.RESTRICTED,
        residency_requirement=DataResidencyRequirement.KARNATAKA_DC_ONLY,
        allocated_cpu_cores=8.0,
        allocated_ram_gib=32.0,
        allocated_storage_gib=200.0,
    )

    report = evaluate_scenario_report(
        workloads=[non_compliant_wl],
        dc=mock_dc,
        cloud_regions=[mock_cloud_region],
    )

    # 1. Current scenario has compliance violations
    curr = report.current_scenario
    assert curr.projected_monthly_cost == 6600.00
    assert curr.compliance_violations_count > 0  # Illegal current placement
    assert curr.is_feasible is False

    # 2. Recommended scenario moves to DC, increasing cost but 100% compliant
    rec = report.recommended_scenario
    assert rec.projected_monthly_cost == 15840.00
    assert rec.cost_difference_absolute == 9240.00  # Exactly matches hand calculation (+9240.00)
    assert rec.cost_difference_pct == 140.0         # Exactly +140%
    assert rec.compliance_violations_count == 0     # Hard compliance is strictly 0
    assert rec.is_feasible is True


# ==============================================================================
# Case 3: On-Premise Resource Utilization & Headroom Accounting
# ==============================================================================

def test_on_premise_utilization_headroom_and_no_double_counting(
    mock_dc: PrivateDCAssumptions,
    mock_cloud_region: PublicCloudRegion,
) -> None:
    """Verifies that DC utilization sums workloads placed on-premise without double-counting,
    correctly calculates usable headroom, and flags capacity violations.
    Workload A in DC: 20 cores, 40 GiB RAM, 200 GiB disk.
    Workload B in DC: 10 cores, 20 GiB RAM, 100 GiB disk.
    Workload C in Cloud: 15 cores, 30 GiB RAM, 150 GiB disk (MUST NOT be counted in DC).
    DC Usable limits: 100 cores, 200 GiB RAM, 1000 GiB disk.
    Expected DC totals:
      CPU: 30.0 cores (30.0% util, 70.0 headroom, no violation)
      RAM: 60.0 GiB (30.0% util, 140.0 headroom, no violation)
      Storage: 300.0 GiB (30.0% util, 700.0 headroom, no violation)
    """
    wl_a = Workload(
        id="wl-dc-a",
        name="DC App A",
        environment="production",
        current_placement="karnataka-dc-1",
        data_sensitivity=DataSensitivity.RESTRICTED,
        residency_requirement=DataResidencyRequirement.KARNATAKA_DC_ONLY,
        allocated_cpu_cores=20.0,
        allocated_ram_gib=40.0,
        allocated_storage_gib=200.0,
    )
    wl_b = Workload(
        id="wl-dc-b",
        name="DC App B",
        environment="production",
        current_placement="karnataka-dc-1",
        data_sensitivity=DataSensitivity.RESTRICTED,
        residency_requirement=DataResidencyRequirement.KARNATAKA_DC_ONLY,
        allocated_cpu_cores=10.0,
        allocated_ram_gib=20.0,
        allocated_storage_gib=100.0,
    )
    wl_c = Workload(
        id="wl-cloud-c",
        name="Cloud App C",
        environment="production",
        current_placement="cloud-india-test",
        data_sensitivity=DataSensitivity.PUBLIC,
        residency_requirement=DataResidencyRequirement.INDIA_ONLY,
        allocated_cpu_cores=15.0,
        allocated_ram_gib=30.0,
        allocated_storage_gib=150.0,
    )

    report = evaluate_scenario_report(
        workloads=[wl_a, wl_b, wl_c],
        dc=mock_dc,
        cloud_regions=[mock_cloud_region],
    )

    curr = report.current_scenario
    cpu_util = next(u for u in curr.on_premise_utilization if u.dimension == "Compute CPU")
    ram_util = next(u for u in curr.on_premise_utilization if u.dimension == "Memory RAM")
    storage_util = next(u for u in curr.on_premise_utilization if u.dimension == "Persistent Storage")

    # Verify no double counting: exactly 20 + 10 = 30 cores
    assert cpu_util.allocated == 30.0
    assert cpu_util.headroom == 70.0
    assert cpu_util.utilization_pct == 30.0
    assert cpu_util.is_violated is False

    assert ram_util.allocated == 60.0
    assert ram_util.headroom == 140.0
    assert ram_util.is_violated is False

    assert storage_util.allocated == 300.0
    assert storage_util.headroom == 700.0
    assert storage_util.is_violated is False


# ==============================================================================
# Case 4: Mandatory Dependency Group Preservation Tracking
# ==============================================================================

def test_mandatory_dependency_groups_preservation_calculation(
    mock_dc: PrivateDCAssumptions,
    mock_cloud_region: PublicCloudRegion,
) -> None:
    """Verifies that the scenario service correctly calculates the count and fraction
    of mandatory co-location groups preserved in both valid and artificially broken scenarios.
    """
    wl_1 = Workload(
        id="wl-coloc-1",
        name="App 1",
        environment="production",
        current_placement="karnataka-dc-1",
        data_sensitivity=DataSensitivity.RESTRICTED,
        residency_requirement=DataResidencyRequirement.KARNATAKA_DC_ONLY,
        allocated_cpu_cores=4.0,
        allocated_ram_gib=8.0,
        allocated_storage_gib=50.0,
    )
    wl_2 = Workload(
        id="wl-coloc-2",
        name="App 2",
        environment="production",
        current_placement="karnataka-dc-1",
        data_sensitivity=DataSensitivity.PUBLIC,
        residency_requirement=DataResidencyRequirement.INDIA_ONLY,
        allocated_cpu_cores=4.0,
        allocated_ram_gib=8.0,
        allocated_storage_gib=50.0,
    )

    graph = DependencyGraph(
        nodes=["wl-coloc-1", "wl-coloc-2"],
        edges=[
            DependencyRelationship(
                id="dep-coloc-1-2",
                source_workload_id="wl-coloc-1",
                target_workload_id="wl-coloc-2",
                relationship_type=DependencyType.CO_LOCATE,
                is_mandatory=True,
            )
        ],
        co_location_groups={"group-1": ["wl-coloc-1", "wl-coloc-2"]},
    )

    # Subcase A: Valid co-located scenario
    report = evaluate_scenario_report(
        workloads=[wl_1, wl_2],
        dc=mock_dc,
        cloud_regions=[mock_cloud_region],
        dependency_graph=graph,
    )
    rec = report.recommended_scenario
    assert rec.mandatory_dependency_groups_total == 1
    assert rec.mandatory_dependency_groups_preserved == 1
    assert rec.mandatory_dependency_groups_fraction == 1.0

    # Subcase B: Artificially split scenario (App 1 in DC, App 2 in Cloud)
    broken_assignments = {
        "wl-coloc-1": "karnataka-dc-1",
        "wl-coloc-2": "cloud-india-test",
    }
    broken_summary = evaluate_scenario(
        scenario_id="scenario-broken-dep",
        scenario_name="Broken Co-Location Scenario",
        description="Scenario that splits a mandatory dependency group.",
        assignments=broken_assignments,
        workloads=[wl_1, wl_2],
        dc=mock_dc,
        cloud_regions=[mock_cloud_region],
        dependency_graph=graph,
    )
    assert broken_summary.mandatory_dependency_groups_total == 1
    assert broken_summary.mandatory_dependency_groups_preserved == 0
    assert broken_summary.mandatory_dependency_groups_fraction == 0.0
    assert broken_summary.is_feasible is False  # Must NOT be feasible
