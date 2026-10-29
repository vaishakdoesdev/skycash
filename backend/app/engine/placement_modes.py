from datetime import datetime, timezone
from typing import Optional, Union
from app.models.enums import (
    ApprovalStatus,
    BillingPeriod,
    Currency,
    DataResidencyRequirement,
    DataSensitivity,
    PlacementStrategyMode,
)
from app.models.schemas import (
    DependencyGraph,
    PlacementFlowEvaluation,
    PrivateDCAssumptions,
    PublicCloudRegion,
    ScenarioSummary,
    UtilisationHistory,
    Workload,
)
from app.engine.capacity import check_dc_capacity_fit
from app.engine.compliance import evaluate_placement_compliance
from app.engine.cost import calculate_cloud_workload_cost, calculate_private_dc_workload_cost
from app.engine.dependencies import extract_co_location_clusters
from app.engine.evaluator import evaluate_workloads
from app.engine.scenarios import evaluate_scenario


def format_infeasibility_reasons(scenario: ScenarioSummary) -> str:
    """Extracts plain-language rejection reasons from an infeasible scenario."""
    reasons: list[str] = []

    if scenario.compliance_violations_count > 0:
        viol_descs: list[str] = []
        for b in scenario.per_workload_breakdown:
            for v in b.compliance_violations:
                viol_descs.append(f"'{b.workload_id}': {v}")
        reasons.append(
            f"{scenario.compliance_violations_count} compliance violation(s) ({'; '.join(viol_descs[:4])})"
        )

    if scenario.has_capacity_violations:
        cap_descs = [
            f"{u.dimension} exceeded usable capacity by {u.violation_amount:.1f} {u.unit}"
            for u in scenario.on_premise_utilization
            if u.is_violated
        ]
        reasons.append(f"Private DC capacity overload ({'; '.join(cap_descs)})")

    if scenario.mandatory_dependency_groups_fraction < 1.0:
        reasons.append(
            f"Mandatory co-location violated: only {scenario.mandatory_dependency_groups_preserved}/"
            f"{scenario.mandatory_dependency_groups_total} groups preserved"
        )

    if any(b.assigned_placement is None for b in scenario.per_workload_breakdown):
        unassigned = [b.workload_id for b in scenario.per_workload_breakdown if b.assigned_placement is None]
        reasons.append(f"Unassigned workloads without eligible target: {unassigned}")

    return "Infeasible: " + "; ".join(reasons) if reasons else "Infeasible: Unmet placement constraints."


def evaluate_local_only_scenario(
    workloads: list[Workload],
    dc: PrivateDCAssumptions,
    cloud_regions: list[PublicCloudRegion],
    dependency_graph: Optional[DependencyGraph] = None,
    utilisation: Optional[list[UtilisationHistory]] = None,
    baseline_cost: Optional[float] = None,
) -> ScenarioSummary:
    """Evaluates placing 100% of workloads on-premise in the Private Data Centre."""
    assignments = {w.id: dc.dc_id for w in workloads}
    return evaluate_scenario(
        scenario_id="scenario-local-only",
        scenario_name="Local-Only Placement",
        description="Places 100% of estate workloads on-premise in the Private Data Centre.",
        assignments=assignments,
        workloads=workloads,
        dc=dc,
        cloud_regions=cloud_regions,
        dependency_graph=dependency_graph,
        utilisation=utilisation,
        baseline_cost=baseline_cost,
    )


def evaluate_cloud_only_scenario(
    workloads: list[Workload],
    dc: PrivateDCAssumptions,
    cloud_regions: list[PublicCloudRegion],
    dependency_graph: Optional[DependencyGraph] = None,
    utilisation: Optional[list[UtilisationHistory]] = None,
    baseline_cost: Optional[float] = None,
) -> ScenarioSummary:
    """Evaluates placing 100% of workloads in approved public cloud regions (hired servers only).
    
    Respects mandatory co-location groups by evaluating cluster members jointly.
    Any workload with strict on-premise residency or sensitivity constraints will be audited
    with compliance violations and marks the scenario infeasible.
    """
    egress_by_workload: dict[str, float] = {}
    if utilisation:
        for u in utilisation:
            egress_by_workload[u.workload_id] = u.network_egress_gib

    approved_clouds = [
        r for r in cloud_regions
        if r.approval_status in (ApprovalStatus.APPROVED, ApprovalStatus.PROVISIONAL)
    ]

    assignments: dict[str, Optional[str]] = {}
    workloads_by_id = {w.id: w for w in workloads}

    # 1. Evaluate mandatory co-location clusters jointly
    clusters = extract_co_location_clusters(dependency_graph)
    processed_workloads: set[str] = set()

    for cluster in clusters:
        cluster_workloads = [workloads_by_id[m] for m in cluster if m in workloads_by_id]
        if not cluster_workloads:
            continue

        # Find cloud regions compliant for ALL cluster members
        eligible_regions: list[PublicCloudRegion] = []
        for region in approved_clouds:
            if all(evaluate_placement_compliance(w, region).is_eligible for w in cluster_workloads):
                eligible_regions.append(region)

        if eligible_regions:
            # Pick lowest total cost region for the cluster
            best_region = min(
                eligible_regions,
                key=lambda r: sum(
                    calculate_cloud_workload_cost(w, r, egress_by_workload.get(w.id))
                    for w in cluster_workloads
                ),
            )
            for w in cluster_workloads:
                assignments[w.id] = best_region.region_id
                processed_workloads.add(w.id)
        else:
            # No cloud region compliant for the entire cluster; assign to lowest-cost approved region
            # so compliance violations are formally logged during scenario evaluation
            fallback_region = approved_clouds[0].region_id if approved_clouds else None
            for w in cluster_workloads:
                assignments[w.id] = fallback_region
                processed_workloads.add(w.id)

    # 2. Evaluate remaining independent workloads
    for w in workloads:
        if w.id in processed_workloads:
            continue

        eligible_regions = [
            r for r in approved_clouds
            if evaluate_placement_compliance(w, r).is_eligible
        ]

        if eligible_regions:
            best_region = min(
                eligible_regions,
                key=lambda r: calculate_cloud_workload_cost(w, r, egress_by_workload.get(w.id)),
            )
            assignments[w.id] = best_region.region_id
        else:
            # Fallback to first approved cloud region so violation is audited
            assignments[w.id] = approved_clouds[0].region_id if approved_clouds else None

    return evaluate_scenario(
        scenario_id="scenario-cloud-only",
        scenario_name="Cloud-Only Placement (Hired Servers)",
        description="Places 100% of estate workloads across approved public cloud regions with zero on-premise hardware utilization.",
        assignments=assignments,
        workloads=workloads,
        dc=dc,
        cloud_regions=cloud_regions,
        dependency_graph=dependency_graph,
        utilisation=utilisation,
        baseline_cost=baseline_cost,
    )


def evaluate_hybrid_scenario(
    workloads: list[Workload],
    dc: PrivateDCAssumptions,
    cloud_regions: list[PublicCloudRegion],
    dependency_graph: Optional[DependencyGraph] = None,
    utilisation: Optional[list[UtilisationHistory]] = None,
    baseline_cost: Optional[float] = None,
) -> ScenarioSummary:
    """Evaluates a hybrid distribution between Private DC and public cloud using the deterministic decision engine."""
    recommendations = evaluate_workloads(
        workloads=workloads,
        dc=dc,
        cloud_regions=cloud_regions,
        dependency_graph=dependency_graph,
        utilisation=utilisation,
    )
    assignments = {r.workload_id: r.recommended_placement for r in recommendations}

    return evaluate_scenario(
        scenario_id="scenario-hybrid",
        scenario_name="Hybrid Placement (Local + Hired)",
        description="Distributes workloads between the Private Data Centre and approved cloud regions based on hard compliance gates, usable headroom, and burdened run costs.",
        assignments=assignments,
        workloads=workloads,
        dc=dc,
        cloud_regions=cloud_regions,
        dependency_graph=dependency_graph,
        utilisation=utilisation,
        baseline_cost=baseline_cost,
    )


def evaluate_placement_flow(
    mode: PlacementStrategyMode,
    workloads: list[Workload],
    dc: PrivateDCAssumptions,
    cloud_regions: list[PublicCloudRegion],
    dependency_graph: Optional[DependencyGraph] = None,
    utilisation: Optional[list[UtilisationHistory]] = None,
) -> PlacementFlowEvaluation:
    """Implements the dashboard workload-placement logic flow:
      1. Mode selection:
         - CLOUD_ONLY: evaluates hired servers only.
         - HYBRID: evaluates and compares Local-Only and Hybrid placements.
      2. Audits capacity underutilisation (e.g. idle DC in cloud-only) or capacity overload (DC deficit in local-only).
      3. Recommends lowest-cost FEASIBLE alternative respecting residency, sensitivity, capacity, and co-location.
      4. Never recommends an infeasible option. Explains reasons if all options fail.
    """
    now_utc = datetime.now(timezone.utc)

    # Calculate baseline cost from current placement
    current_assignments = {w.id: w.current_placement for w in workloads}
    baseline_summary = evaluate_scenario(
        scenario_id="scenario-current-baseline",
        scenario_name="Current Baseline",
        description="Current baseline placement.",
        assignments=current_assignments,
        workloads=workloads,
        dc=dc,
        cloud_regions=cloud_regions,
        dependency_graph=dependency_graph,
        utilisation=utilisation,
        baseline_cost=None,
    )
    baseline_cost = baseline_summary.projected_monthly_cost

    evaluated_scenarios: list[ScenarioSummary] = []
    capacity_analysis: dict[str, str] = {}
    assumptions: list[str] = [
        f"Private DC Amortization: Hardware costs amortized over 4-year lifecycle with {dc.power_cooling_pue_overhead_pct}% PUE power/cooling overhead.",
        "Public Cloud Pricing: Standard pay-as-you-go hourly/monthly on-demand rates in approved Indian sovereign cloud regions.",
        "Deterministic Hard Gates: Data residency boundaries and sensitivity ceilings can never be relaxed for cost savings.",
        "Capacity Bounds: On-premise allocation is strictly capped by usable hardware headroom (preventing double-counting).",
    ]

    if mode == PlacementStrategyMode.CLOUD_ONLY:
        cloud_summary = evaluate_cloud_only_scenario(
            workloads=workloads,
            dc=dc,
            cloud_regions=cloud_regions,
            dependency_graph=dependency_graph,
            utilisation=utilisation,
            baseline_cost=baseline_cost,
        )
        evaluated_scenarios.append(cloud_summary)

        # Capacity analysis for cloud-only
        capacity_analysis["private_dc_utilization"] = (
            f"Underutilisation: 0.0% of Private DC compute/memory/storage is utilised. "
            f"All {dc.usable_cpu_cores:.0f} vCPU cores, {dc.usable_ram_gib:.0f} GiB RAM, and {dc.usable_storage_gib:.0f} GiB storage "
            f"remain idle, stranding amortized facility investment while incurring 100% operational cloud spend."
        )
        if not cloud_summary.is_feasible:
            capacity_analysis["feasibility_status"] = (
                "Infeasible: One or more workloads cannot legally be hosted in public cloud due to sovereign residency "
                "or data sensitivity rules."
            )
        else:
            capacity_analysis["feasibility_status"] = "Feasible: All workloads meet public cloud compliance and quota rules."

    elif mode == PlacementStrategyMode.HYBRID:
        local_summary = evaluate_local_only_scenario(
            workloads=workloads,
            dc=dc,
            cloud_regions=cloud_regions,
            dependency_graph=dependency_graph,
            utilisation=utilisation,
            baseline_cost=baseline_cost,
        )
        hybrid_summary = evaluate_hybrid_scenario(
            workloads=workloads,
            dc=dc,
            cloud_regions=cloud_regions,
            dependency_graph=dependency_graph,
            utilisation=utilisation,
            baseline_cost=baseline_cost,
        )
        evaluated_scenarios.extend([local_summary, hybrid_summary])

        # Capacity analysis for local-only vs hybrid
        if local_summary.has_capacity_violations:
            overloaded_dims = [
                f"{u.dimension} (allocated {u.allocated:.1f} vs usable {u.usable_capacity:.1f} {u.unit}, deficit: {u.violation_amount:.1f} {u.unit})"
                for u in local_summary.on_premise_utilization
                if u.is_violated
            ]
            capacity_analysis["local_only_capacity"] = (
                f"Capacity Overload: Local-only placement exceeds Private DC usable capacity in: {'; '.join(overloaded_dims)}. "
                f"Hardware expansion or selective cloud offloading is required."
            )
        else:
            capacity_analysis["local_only_capacity"] = (
                "Sufficient Headroom: Local-only placement fits within existing Private DC physical capacity."
            )

        if hybrid_summary.is_feasible:
            dc_cpu_util = next((u.utilization_pct for u in hybrid_summary.on_premise_utilization if "CPU" in u.dimension), 0.0)
            capacity_analysis["hybrid_capacity"] = (
                f"Balanced Utilization: Hybrid placement achieves {dc_cpu_util:.1f}% on-premise CPU utilization without "
                f"breaching hardware headroom, placing remaining compliant workloads in approved cloud regions."
            )

    # -------------------------------------------------------------------------
    # Recommendation Selection
    # -------------------------------------------------------------------------
    feasible_candidates = [s for s in evaluated_scenarios if s.is_feasible]
    rejected_scenarios: dict[str, str] = {}

    if feasible_candidates:
        # Lowest cost feasible alternative
        winner = min(feasible_candidates, key=lambda s: s.projected_monthly_cost)
        has_feasible_recommendation = True
        recommended_scenario = winner

        recommendation_rationale = (
            f"'{winner.scenario_name}' is recommended as the lowest-cost feasible placement option "
            f"(₹{winner.projected_monthly_cost:,.2f}/month). It satisfies all data residency, data sensitivity, "
            f"usable hardware headroom limits, and mandatory co-location dependencies."
        )

        for s in evaluated_scenarios:
            if s.scenario_id == winner.scenario_id:
                continue
            if s.is_feasible:
                cost_diff = s.projected_monthly_cost - winner.projected_monthly_cost
                rejected_scenarios[s.scenario_id] = (
                    f"Higher cost alternative: Projected spend of ₹{s.projected_monthly_cost:,.2f}/month is "
                    f"₹{cost_diff:,.2f}/month higher than the recommended option."
                )
            else:
                rejected_scenarios[s.scenario_id] = format_infeasibility_reasons(s)

    else:
        has_feasible_recommendation = False
        recommended_scenario = None

        recommendation_rationale = (
            f"No feasible placement option exists under '{mode.value}' mode. "
            f"Every candidate scenario breaches one or more mandatory compliance, capacity, or co-location constraints. "
            f"Review the rejection reasons below for remediation guidance."
        )

        for s in evaluated_scenarios:
            rejected_scenarios[s.scenario_id] = format_infeasibility_reasons(s)

    return PlacementFlowEvaluation(
        mode=mode,
        generated_at=now_utc,
        currency=Currency.INR,
        billing_period=BillingPeriod.MONTHLY,
        has_feasible_recommendation=has_feasible_recommendation,
        recommended_scenario=recommended_scenario,
        recommendation_rationale=recommendation_rationale,
        evaluated_scenarios=evaluated_scenarios,
        rejected_scenarios=rejected_scenarios,
        capacity_analysis=capacity_analysis,
        assumptions=assumptions,
    )
