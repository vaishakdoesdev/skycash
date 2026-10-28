from datetime import datetime, timezone
from typing import Optional, Union
from app.models.enums import (
    BillingPeriod,
    Currency,
    DataResidencyRequirement,
    DataSensitivity,
    RecommendationStatus,
)
from app.models.schemas import (
    DependencyGraph,
    OnPremiseResourceUtilization,
    PlacementRecommendation,
    PrivateDCAssumptions,
    PublicCloudRegion,
    ScenarioEvaluationReport,
    ScenarioPlacementBreakdown,
    ScenarioSummary,
    UtilisationHistory,
    Workload,
)
from app.engine.capacity import check_dc_capacity_fit
from app.engine.compliance import evaluate_placement_compliance
from app.engine.cost import calculate_cloud_workload_cost, calculate_private_dc_workload_cost
from app.engine.dependencies import (
    extract_co_location_clusters,
    map_workloads_to_co_location_groups,
)
from app.engine.evaluator import calculate_cost_for_placement, evaluate_workloads


SIGN_CONVENTION_NOTE = (
    "Cost Difference Sign Convention: (scenario_cost - baseline_cost). "
    "Negative (< 0) indicates cost reduction / savings compared to baseline. "
    "Positive (> 0) indicates cost increase / premium compared to baseline."
)

ESTIMATE_DISCLAIMER = (
    "PROJECTED ESTIMATE: Values are calculated decision-support projections based on "
    "a 720-hour monthly amortized baseline. These figures are not official billing invoices."
)


def evaluate_scenario(
    scenario_id: str,
    scenario_name: str,
    description: str,
    assignments: dict[str, Optional[str]],
    workloads: list[Workload],
    dc: PrivateDCAssumptions,
    cloud_regions: list[PublicCloudRegion],
    dependency_graph: Optional[DependencyGraph] = None,
    utilisation: Optional[list[UtilisationHistory]] = None,
    baseline_cost: Optional[float] = None,
) -> ScenarioSummary:
    """Evaluates an estate-wide workload placement configuration against cost, capacity,
    compliance, and dependency rules.
    """
    placements_by_id: dict[str, Union[PrivateDCAssumptions, PublicCloudRegion]] = {
        dc.dc_id: dc,
    }
    for region in cloud_regions:
        placements_by_id[region.region_id] = region

    egress_by_workload: dict[str, float] = {}
    unconfirmed_metrics: list[str] = []
    has_unconfirmed_egress = False

    if utilisation:
        for u in utilisation:
            egress_by_workload[u.workload_id] = u.network_egress_gib
    else:
        has_unconfirmed_egress = True

    # -------------------------------------------------------------------------
    # 1. On-Premise DC Capacity Utilization (Preventing Double-Counting)
    # -------------------------------------------------------------------------
    on_prem_workloads = [
        w for w in workloads
        if assignments.get(w.id) == dc.dc_id
    ]

    total_dc_cpu = round(sum(w.allocated_cpu_cores for w in on_prem_workloads), 2)
    total_dc_ram = round(sum(w.allocated_ram_gib for w in on_prem_workloads), 2)
    total_dc_storage = round(sum(w.allocated_storage_gib for w in on_prem_workloads), 2)

    cpu_headroom = round(dc.usable_cpu_cores - total_dc_cpu, 2)
    ram_headroom = round(dc.usable_ram_gib - total_dc_ram, 2)
    storage_headroom = round(dc.usable_storage_gib - total_dc_storage, 2)

    cpu_violated = total_dc_cpu > dc.usable_cpu_cores
    ram_violated = total_dc_ram > dc.usable_ram_gib
    storage_violated = total_dc_storage > dc.usable_storage_gib

    capacity_violations_count = sum([cpu_violated, ram_violated, storage_violated])

    on_prem_utilization = [
        OnPremiseResourceUtilization(
            dimension="Compute CPU",
            unit="cores",
            allocated=total_dc_cpu,
            usable_capacity=dc.usable_cpu_cores,
            total_capacity=dc.total_cpu_cores,
            utilization_pct=round((total_dc_cpu / dc.usable_cpu_cores) * 100, 2) if dc.usable_cpu_cores > 0 else 0.0,
            headroom=cpu_headroom,
            is_violated=cpu_violated,
            violation_amount=round(max(0.0, total_dc_cpu - dc.usable_cpu_cores), 2),
        ),
        OnPremiseResourceUtilization(
            dimension="Memory RAM",
            unit="GiB",
            allocated=total_dc_ram,
            usable_capacity=dc.usable_ram_gib,
            total_capacity=dc.total_ram_gib,
            utilization_pct=round((total_dc_ram / dc.usable_ram_gib) * 100, 2) if dc.usable_ram_gib > 0 else 0.0,
            headroom=ram_headroom,
            is_violated=ram_violated,
            violation_amount=round(max(0.0, total_dc_ram - dc.usable_ram_gib), 2),
        ),
        OnPremiseResourceUtilization(
            dimension="Persistent Storage",
            unit="GiB",
            allocated=total_dc_storage,
            usable_capacity=dc.usable_storage_gib,
            total_capacity=dc.total_storage_gib,
            utilization_pct=round((total_dc_storage / dc.usable_storage_gib) * 100, 2) if dc.usable_storage_gib > 0 else 0.0,
            headroom=storage_headroom,
            is_violated=storage_violated,
            violation_amount=round(max(0.0, total_dc_storage - dc.usable_storage_gib), 2),
        ),
    ]

    # -------------------------------------------------------------------------
    # 2. Per-Workload Cost, Compliance, and Delta
    # -------------------------------------------------------------------------
    breakdowns: list[ScenarioPlacementBreakdown] = []
    total_scenario_cost = 0.0
    compliance_violations_count = 0

    for w in workloads:
        assigned_p_id = assignments.get(w.id)
        current_p_obj = placements_by_id.get(w.current_placement)
        assigned_p_obj = placements_by_id.get(assigned_p_id) if assigned_p_id else None

        current_cost = calculate_cost_for_placement(
            w, current_p_obj, egress_by_workload.get(w.id)
        )

        wl_assumptions: list[str] = []
        wl_violations: list[str] = []
        is_compliant = True

        if assigned_p_obj is None:
            # Unassigned / Ineligible
            assigned_cost = 0.0
            is_compliant = False
            wl_violations.append("Workload is unassigned or has no eligible placement.")
            wl_assumptions.append("No active hosting cost calculated for unassigned workload.")
        else:
            # Check compliance
            comp_res = evaluate_placement_compliance(w, assigned_p_obj)
            is_compliant = comp_res.is_eligible
            if not is_compliant:
                for v in comp_res.violations:
                    wl_violations.append(v.description)
                compliance_violations_count += len(comp_res.violations)

            # Compute cost
            egress_val = egress_by_workload.get(w.id)
            if egress_val is None and not isinstance(assigned_p_obj, PrivateDCAssumptions):
                has_unconfirmed_egress = True
                wl_assumptions.append("Network egress volume unconfirmed; modeled as 0.0 GiB/month.")
            
            assigned_cost = calculate_cost_for_placement(w, assigned_p_obj, egress_val)
            if isinstance(assigned_p_obj, PrivateDCAssumptions):
                wl_assumptions.append(f"Private DC amortized rates with {dc.power_cooling_pue_overhead_pct}% PUE overhead.")
            else:
                wl_assumptions.append(f"Public cloud on-demand pricing in {assigned_p_obj.region_name}.")

        total_scenario_cost += assigned_cost
        delta = round(assigned_cost - current_cost, 2)
        delta_pct = round((delta / current_cost) * 100, 2) if current_cost > 0 else None

        breakdowns.append(
            ScenarioPlacementBreakdown(
                workload_id=w.id,
                workload_name=w.name,
                current_placement=w.current_placement,
                assigned_placement=assigned_p_id,
                monthly_cost=assigned_cost,
                cost_delta_from_current=delta,
                cost_delta_pct_from_current=delta_pct,
                is_compliant=is_compliant,
                compliance_violations=wl_violations,
                assumptions=wl_assumptions,
            )
        )

    total_scenario_cost = round(total_scenario_cost, 2)

    # -------------------------------------------------------------------------
    # 3. Mandatory Dependency Groups Preservation
    # -------------------------------------------------------------------------
    co_loc_clusters = extract_co_location_clusters(dependency_graph)
    total_groups = len(co_loc_clusters)
    preserved_groups = 0

    for cluster in co_loc_clusters:
        member_placements = {assignments.get(m) for m in cluster}
        # A group is preserved if all members are assigned to the exact same non-None placement
        if len(member_placements) == 1 and None not in member_placements:
            preserved_groups += 1

    group_fraction = round(preserved_groups / total_groups, 4) if total_groups > 0 else 1.0

    # -------------------------------------------------------------------------
    # 4. Overall Feasibility
    # -------------------------------------------------------------------------
    is_feasible = (
        compliance_violations_count == 0
        and capacity_violations_count == 0
        and (total_groups == 0 or preserved_groups == total_groups)
        and all(b.assigned_placement is not None for b in breakdowns)
    )

    # -------------------------------------------------------------------------
    # 5. Cost Deltas Against Baseline
    # -------------------------------------------------------------------------
    if baseline_cost is not None:
        cost_diff_abs = round(total_scenario_cost - baseline_cost, 2)
        cost_diff_pct = round((cost_diff_abs / baseline_cost) * 100, 2) if baseline_cost > 0 else 0.0
    else:
        cost_diff_abs = 0.0
        cost_diff_pct = 0.0

    if has_unconfirmed_egress:
        unconfirmed_metrics.append(
            "Outbound network egress volume was unconfirmed in telemetry and modeled as 0.0 GiB/month."
        )

    return ScenarioSummary(
        scenario_id=scenario_id,
        scenario_name=scenario_name,
        description=description,
        projected_monthly_cost=total_scenario_cost,
        is_cost_estimate=True,
        cost_estimate_disclaimer=ESTIMATE_DISCLAIMER,
        cost_difference_absolute=cost_diff_abs,
        cost_difference_pct=cost_diff_pct,
        sign_convention=SIGN_CONVENTION_NOTE,
        currency=Currency.INR,
        billing_period=BillingPeriod.MONTHLY,
        on_premise_utilization=on_prem_utilization,
        has_capacity_violations=capacity_violations_count > 0,
        capacity_violations_count=capacity_violations_count,
        mandatory_dependency_groups_total=total_groups,
        mandatory_dependency_groups_preserved=preserved_groups,
        mandatory_dependency_groups_fraction=group_fraction,
        compliance_violations_count=compliance_violations_count,
        is_feasible=is_feasible,
        per_workload_breakdown=breakdowns,
        unconfirmed_metrics=unconfirmed_metrics,
    )


def evaluate_scenario_report(
    workloads: list[Workload],
    dc: PrivateDCAssumptions,
    cloud_regions: list[PublicCloudRegion],
    dependency_graph: Optional[DependencyGraph] = None,
    utilisation: Optional[list[UtilisationHistory]] = None,
) -> ScenarioEvaluationReport:
    """Generates an end-to-end scenario comparison report covering:
      1. Current Placement Scenario (Baseline).
      2. Recommended Scenario (Decision Engine Output).
      3. Meaningful Alternative Feasible Scenarios:
         a) Private-DC-First Feasible Scenario (max local retention).
         b) Cloud-Prioritized Feasible Scenario (max cloud elasticity).
    """
    now_utc = datetime.now(timezone.utc)

    egress_by_workload: dict[str, float] = {}
    if utilisation:
        for u in utilisation:
            egress_by_workload[u.workload_id] = u.network_egress_gib

    # -------------------------------------------------------------------------
    # Scenario 1: Current Placement (Baseline)
    # -------------------------------------------------------------------------
    current_assignments = {w.id: w.current_placement for w in workloads}
    current_summary = evaluate_scenario(
        scenario_id="scenario-current",
        scenario_name="Current Placement (Baseline)",
        description="Existing operational placement of all workloads as currently recorded in inventory.",
        assignments=current_assignments,
        workloads=workloads,
        dc=dc,
        cloud_regions=cloud_regions,
        dependency_graph=dependency_graph,
        utilisation=utilisation,
        baseline_cost=None,  # Baseline against itself
    )

    baseline_monthly_cost = current_summary.projected_monthly_cost

    # -------------------------------------------------------------------------
    # Scenario 2: Recommended Placement (Decision Engine)
    # -------------------------------------------------------------------------
    recommendations = evaluate_workloads(
        workloads=workloads,
        dc=dc,
        cloud_regions=cloud_regions,
        dependency_graph=dependency_graph,
        utilisation=utilisation,
    )
    rec_assignments = {
        r.workload_id: r.recommended_placement for r in recommendations
    }

    recommended_summary = evaluate_scenario(
        scenario_id="scenario-recommended",
        scenario_name="Recommended Feasible Placement",
        description="Optimal compliant placement determined by the deterministic decision engine.",
        assignments=rec_assignments,
        workloads=workloads,
        dc=dc,
        cloud_regions=cloud_regions,
        dependency_graph=dependency_graph,
        utilisation=utilisation,
        baseline_cost=baseline_monthly_cost,
    )

    # -------------------------------------------------------------------------
    # Scenario 3: Alternative A - Private-DC-First Feasible Scenario
    # -------------------------------------------------------------------------
    # Retain all compliant workloads in the private DC; spill to cloud only if DC capacity is exhausted
    dc_first_assignments: dict[str, Optional[str]] = {}
    remaining_dc_cpu = dc.usable_cpu_cores
    remaining_dc_ram = dc.usable_ram_gib
    remaining_dc_storage = dc.usable_storage_gib

    # Index approved clouds in India
    approved_india_clouds = [
        r for r in cloud_regions
        if r.approval_status.value in ("APPROVED", "PROVISIONAL") and r.location_country == "IN"
    ]

    for w in workloads:
        # Check if DC is compliant for this workload
        dc_comp = evaluate_placement_compliance(w, dc)
        fits_headroom = (
            w.allocated_cpu_cores <= remaining_dc_cpu
            and w.allocated_ram_gib <= remaining_dc_ram
            and w.allocated_storage_gib <= remaining_dc_storage
        )

        if dc_comp.is_eligible and fits_headroom:
            dc_first_assignments[w.id] = dc.dc_id
            remaining_dc_cpu -= w.allocated_cpu_cores
            remaining_dc_ram -= w.allocated_ram_gib
            remaining_dc_storage -= w.allocated_storage_gib
        else:
            # Spill over to first eligible cloud region if permitted
            eligible_cloud = None
            for c in approved_india_clouds:
                if evaluate_placement_compliance(w, c).is_eligible:
                    eligible_cloud = c.region_id
                    break
            dc_first_assignments[w.id] = eligible_cloud

    dc_first_summary = evaluate_scenario(
        scenario_id="scenario-dc-first",
        scenario_name="Private-DC-First Feasible Scenario",
        description="Maximizes on-premise Private DC workload retention subject to usable hardware headroom.",
        assignments=dc_first_assignments,
        workloads=workloads,
        dc=dc,
        cloud_regions=cloud_regions,
        dependency_graph=dependency_graph,
        utilisation=utilisation,
        baseline_cost=baseline_monthly_cost,
    )

    # -------------------------------------------------------------------------
    # Scenario 4: Alternative B - Cloud-Prioritized Feasible Scenario
    # -------------------------------------------------------------------------
    # Move every compliant workload to public cloud; retain only RESTRICTED / Karnataka-only in DC
    cloud_prioritized_assignments: dict[str, Optional[str]] = {}
    for w in workloads:
        if w.residency_requirement == DataResidencyRequirement.KARNATAKA_DC_ONLY or w.data_sensitivity == DataSensitivity.RESTRICTED:
            cloud_prioritized_assignments[w.id] = dc.dc_id
        else:
            # Pick lowest cost approved cloud
            best_cloud = None
            best_cloud_cost = float("inf")
            for c in approved_india_clouds:
                if evaluate_placement_compliance(w, c).is_eligible:
                    cost = calculate_cloud_workload_cost(w, c, egress_by_workload.get(w.id))
                    if cost < best_cloud_cost:
                        best_cloud_cost = cost
                        best_cloud = c.region_id
            cloud_prioritized_assignments[w.id] = best_cloud or dc.dc_id

    cloud_prioritized_summary = evaluate_scenario(
        scenario_id="scenario-cloud-prioritized",
        scenario_name="Cloud-Prioritized Feasible Scenario",
        description="Migrates all non-restricted eligible workloads to approved Indian public cloud regions.",
        assignments=cloud_prioritized_assignments,
        workloads=workloads,
        dc=dc,
        cloud_regions=cloud_regions,
        dependency_graph=dependency_graph,
        utilisation=utilisation,
        baseline_cost=baseline_monthly_cost,
    )

    audit_notes = [
        SIGN_CONVENTION_NOTE,
        ESTIMATE_DISCLAIMER,
        "Compliance Rule: Compliance violations must be 0 for any scenario considered acceptable for production migration.",
        "Shared Resources: Workload allocations are summed once per dimension to prevent double-counting of infrastructure capacity.",
    ]

    return ScenarioEvaluationReport(
        generated_at=now_utc,
        currency=Currency.INR,
        billing_period=BillingPeriod.MONTHLY,
        current_scenario=current_summary,
        recommended_scenario=recommended_summary,
        alternative_scenarios=[dc_first_summary, cloud_prioritized_summary],
        audit_notes=audit_notes,
    )
