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
    PlacementRecommendation,
    PrivateDCAssumptions,
    PublicCloudRegion,
    UtilisationHistory,
    Workload,
)
from app.engine.capacity import check_dc_capacity_fit
from app.engine.compliance import evaluate_placement_compliance
from app.engine.cost import (
    calculate_cloud_workload_cost,
    calculate_private_dc_workload_cost,
)
from app.engine.dependencies import map_workloads_to_co_location_groups


RULE_ENGINE_VERSION = "0.1.0"


def check_conflicting_workload_data(workload: Workload) -> Optional[str]:
    """Detects mutually contradictory requirements or missing/corrupt workload specs.
    
    Returns a description of the conflict or missing data, or None if internally consistent.
    """
    # Check 1: Missing or blank current_placement identifier
    if not workload.current_placement or workload.current_placement.strip().upper() in ("", "UNKNOWN", "NONE", "UNPLACED"):
        return "Missing or unspecified current_placement identifier (must specify valid deployment location)."

    # Check 2: Hard Karnataka DC residency combined with explicit Cloud provider preference
    if (
        workload.residency_requirement == DataResidencyRequirement.KARNATAKA_DC_ONLY
        and workload.soft_preferences
        and workload.soft_preferences.preferred_provider is not None
        and workload.soft_preferences.preferred_provider.upper() in ("AWS", "AZURE", "GCP")
    ):
        return (
            f"Contradictory constraints: Workload mandates KARNATAKA_DC_ONLY residency, "
            f"but soft preferences request public cloud provider '{workload.soft_preferences.preferred_provider}'."
        )

    # Check 3: Restricted data classification combined with explicit Cloud provider preference
    if (
        workload.data_sensitivity == DataSensitivity.RESTRICTED
        and workload.soft_preferences
        and workload.soft_preferences.preferred_provider is not None
    ):
        return (
            f"Contradictory constraints: Workload has RESTRICTED sensitivity (DC only), "
            f"but soft preferences request public cloud provider '{workload.soft_preferences.preferred_provider}'."
        )

    return None


def calculate_cost_for_placement(
    workload: Workload,
    placement: Optional[Union[PrivateDCAssumptions, PublicCloudRegion]],
    egress_gib: Optional[float] = None,
) -> float:
    """Helper to compute cost regardless of placement type.
    
    Returns 0.0 if placement is None (e.g. unknown current location).
    """
    if placement is None:
        return 0.0
    if isinstance(placement, PrivateDCAssumptions):
        return calculate_private_dc_workload_cost(workload, placement)
    return calculate_cloud_workload_cost(workload, placement, monthly_egress_gib=egress_gib)


def evaluate_workloads(
    workloads: list[Workload],
    dc: PrivateDCAssumptions,
    cloud_regions: list[PublicCloudRegion],
    dependency_graph: Optional[DependencyGraph] = None,
    utilisation: Optional[list[UtilisationHistory]] = None,
    allocated_dc_cpu: float = 0.0,
    allocated_dc_ram: float = 0.0,
    allocated_dc_storage: float = 0.0,
) -> list[PlacementRecommendation]:
    """Evaluates candidate placements deterministically for a list of workloads.
    
    Adheres strictly to non-negotiables:
      1. Residency and sensitivity hard rules cannot be overridden by cost.
      2. Co-located workloads remain together; infeasible groups report failure.
      3. Explainable recommendations with audit explanations and rejected alternatives.
      4. Deterministic tie-breaking: lowest cost -> current placement -> Private DC -> alphabetical.
      5. Conflicting/missing inputs produce REVIEW_REQUIRED rather than false confidence.
    """
    # Index candidate placements
    placements_by_id: dict[str, Union[PrivateDCAssumptions, PublicCloudRegion]] = {
        dc.dc_id: dc,
    }
    for region in cloud_regions:
        placements_by_id[region.region_id] = region

    # Index telemetry egress by workload
    egress_by_workload: dict[str, float] = {}
    if utilisation:
        for u in utilisation:
            egress_by_workload[u.workload_id] = u.network_egress_gib

    # Index workloads by ID
    workloads_by_id = {w.id: w for w in workloads}

    # Discover co-location clusters
    coloc_map = map_workloads_to_co_location_groups(dependency_graph)

    recommendations: list[PlacementRecommendation] = []
    processed_clusters: set[str] = set()

    for workload in workloads:
        # ---------------------------------------------------------------------
        # Step 0: Check for Conflicting / Missing Information
        # ---------------------------------------------------------------------
        conflict_msg = check_conflicting_workload_data(workload)
        if conflict_msg:
            rec = PlacementRecommendation(
                workload_id=workload.id,
                current_placement=workload.current_placement,
                recommended_placement=None,
                status=RecommendationStatus.REVIEW_REQUIRED,
                current_monthly_cost=calculate_cost_for_placement(
                    workload,
                    placements_by_id.get(workload.current_placement),
                    egress_by_workload.get(workload.id),
                ),
                recommended_monthly_cost=None,
                projected_monthly_savings=None,
                currency=Currency.INR,
                billing_period=BillingPeriod.MONTHLY,
                capacity_allocated_cpu=workload.allocated_cpu_cores,
                capacity_allocated_ram_gib=workload.allocated_ram_gib,
                capacity_allocated_storage_gib=workload.allocated_storage_gib,
                co_location_group_id=None,
                co_located_workload_ids=[],
                hard_compliance_passed=False,
                factors=["Review required due to contradictory or invalid workload input specifications."],
                binding_constraints=[conflict_msg],
                assumptions=["No recommendation generated pending operational clarification."],
                rejected_alternatives={},
                audit_explanation=f"REVIEW REQUIRED: {conflict_msg}",
                rule_engine_version=RULE_ENGINE_VERSION,
            )
            recommendations.append(rec)
            continue

        # ---------------------------------------------------------------------
        # Step 1: Handle Mandatory Co-Location Groups
        # ---------------------------------------------------------------------
        if workload.id in coloc_map:
            group_id, member_ids = coloc_map[workload.id]
            if group_id in processed_clusters:
                # Already processed as part of group evaluation
                continue
            processed_clusters.add(group_id)

            cluster_workloads = [workloads_by_id[m] for m in member_ids if m in workloads_by_id]
            group_cpu = sum(w.allocated_cpu_cores for w in cluster_workloads)
            group_ram = sum(w.allocated_ram_gib for w in cluster_workloads)
            group_storage = sum(w.allocated_storage_gib for w in cluster_workloads)

            # Evaluate each placement for the entire cluster
            feasible_placements: list[str] = []
            cluster_rejections: dict[str, str] = {}
            cluster_binding_constraints: list[str] = [
                f"Mandatory co-location group '{group_id}' requires all {len(cluster_workloads)} workloads to share one placement."
            ]

            for p_id, placement in placements_by_id.items():
                placement_failed = False

                # 1. Compliance for every member
                for member_wl in cluster_workloads:
                    comp_res = evaluate_placement_compliance(member_wl, placement)
                    if not comp_res.is_eligible:
                        cluster_rejections[p_id] = (
                            f"Rejected for group: Member {member_wl.id} violates compliance: {comp_res.rejection_reason}"
                        )
                        placement_failed = True
                        cluster_binding_constraints.extend(comp_res.binding_constraints)
                        break

                if placement_failed:
                    continue

                # 2. Capacity for combined cluster
                if isinstance(placement, PrivateDCAssumptions):
                    fits, cap_reason = check_dc_capacity_fit(
                        placement,
                        group_cpu,
                        group_ram,
                        group_storage,
                        allocated_dc_cpu,
                        allocated_dc_ram,
                        allocated_dc_storage,
                    )
                    if not fits:
                        cluster_rejections[p_id] = f"Rejected for group: Combined capacity overflow: {cap_reason}"
                        placement_failed = True
                        cluster_binding_constraints.append(cap_reason or "DC capacity breached.")

                if not placement_failed:
                    feasible_placements.append(p_id)

            cluster_binding_constraints = list(dict.fromkeys(cluster_binding_constraints))

            # If no placement is feasible for the entire cluster
            if not feasible_placements:
                for member_wl in cluster_workloads:
                    curr_cost = calculate_cost_for_placement(
                        member_wl,
                        placements_by_id.get(member_wl.current_placement, dc),
                        egress_by_workload.get(member_wl.id),
                    )
                    rec = PlacementRecommendation(
                        workload_id=member_wl.id,
                        current_placement=member_wl.current_placement,
                        recommended_placement=None,
                        status=RecommendationStatus.INELIGIBLE,
                        current_monthly_cost=curr_cost,
                        recommended_monthly_cost=None,
                        projected_monthly_savings=None,
                        currency=Currency.INR,
                        billing_period=BillingPeriod.MONTHLY,
                        capacity_allocated_cpu=member_wl.allocated_cpu_cores,
                        capacity_allocated_ram_gib=member_wl.allocated_ram_gib,
                        capacity_allocated_storage_gib=member_wl.allocated_storage_gib,
                        co_location_group_id=group_id,
                        co_located_workload_ids=[m for m in member_ids if m != member_wl.id],
                        hard_compliance_passed=False,
                        factors=["Co-location group has no feasible common hosting environment."],
                        binding_constraints=cluster_binding_constraints,
                        assumptions=["Co-location constraint is strictly mandatory and cannot be split."],
                        rejected_alternatives=cluster_rejections,
                        audit_explanation=(
                            f"INFEASIBLE: Workload belongs to co-location group '{group_id}' with {member_ids}. "
                            f"No candidate placement satisfied both compliance and capacity constraints for all members simultaneously."
                        ),
                        rule_engine_version=RULE_ENGINE_VERSION,
                    )
                    recommendations.append(rec)
                continue

            # Compute combined cluster costs for all feasible candidates
            scored_candidates: list[tuple[float, int, int, str]] = []
            for cand_id in feasible_placements:
                cand_placement = placements_by_id[cand_id]
                total_cand_cost = sum(
                    calculate_cost_for_placement(w, cand_placement, egress_by_workload.get(w.id))
                    for w in cluster_workloads
                )
                # Tie-breaking keys:
                # 1. Total cost (ascending)
                # 2. Match current placement of group (0 if match, 1 if change)
                # 3. Prefer Private DC (0 if Private DC, 1 if cloud)
                # 4. Alphabetical candidate ID
                is_current = 0 if any(w.current_placement == cand_id for w in cluster_workloads) else 1
                is_cloud = 1 if not isinstance(cand_placement, PrivateDCAssumptions) else 0
                scored_candidates.append((total_cand_cost, is_current, is_cloud, cand_id))

            scored_candidates.sort()
            best_cost, _, _, best_placement_id = scored_candidates[0]

            # Record non-winning candidates in rejected alternatives
            for cand_cost, _, _, cand_id in scored_candidates[1:]:
                cluster_rejections[cand_id] = (
                    f"Higher aggregate cost for co-location group: {cand_cost:,.2f} INR/mo vs selected {best_cost:,.2f} INR/mo."
                )

            # Generate recommendation for each cluster member
            for member_wl in cluster_workloads:
                cand_placement = placements_by_id[best_placement_id]
                curr_cost = calculate_cost_for_placement(
                    member_wl,
                    placements_by_id.get(member_wl.current_placement, dc),
                    egress_by_workload.get(member_wl.id),
                )
                rec_cost = calculate_cost_for_placement(
                    member_wl,
                    cand_placement,
                    egress_by_workload.get(member_wl.id),
                )
                savings = round(curr_cost - rec_cost, 2)
                status = (
                    RecommendationStatus.NO_CHANGE
                    if best_placement_id == member_wl.current_placement
                    else RecommendationStatus.CHANGE_RECOMMENDED
                )

                companion_ids = [m for m in member_ids if m != member_wl.id]
                factors = [
                    f"Workload co-located in '{best_placement_id}' to satisfy mandatory dependency group '{group_id}'.",
                    f"Co-located companions: {', '.join(companion_ids)}.",
                    f"Aggregate cluster monthly cost: {best_cost:,.2f} INR.",
                ]

                audit_explanation = (
                    f"Recommended placement '{best_placement_id}' selected for mandatory co-location group '{group_id}'. "
                    f"Individual workload run cost is {rec_cost:,.2f} INR/mo (savings: {savings:,.2f} INR/mo). "
                    f"Hard compliance and joint capacity requirements are fully satisfied across all group members."
                )

                rec = PlacementRecommendation(
                    workload_id=member_wl.id,
                    current_placement=member_wl.current_placement,
                    recommended_placement=best_placement_id,
                    status=status,
                    current_monthly_cost=curr_cost,
                    recommended_monthly_cost=rec_cost,
                    projected_monthly_savings=savings,
                    currency=Currency.INR,
                    billing_period=BillingPeriod.MONTHLY,
                    capacity_allocated_cpu=member_wl.allocated_cpu_cores,
                    capacity_allocated_ram_gib=member_wl.allocated_ram_gib,
                    capacity_allocated_storage_gib=member_wl.allocated_storage_gib,
                    co_location_group_id=group_id,
                    co_located_workload_ids=companion_ids,
                    hard_compliance_passed=True,
                    factors=factors,
                    binding_constraints=cluster_binding_constraints,
                    assumptions=[
                        f"Co-location group '{group_id}' must remain unified in a single placement.",
                        f"Fully burdened DC cost baseline: PUE {dc.power_cooling_pue_overhead_pct}%.",
                    ],
                    rejected_alternatives=cluster_rejections,
                    audit_explanation=audit_explanation,
                    rule_engine_version=RULE_ENGINE_VERSION,
                )
                recommendations.append(rec)
            continue

        # ---------------------------------------------------------------------
        # Step 2: Handle Independent Workloads
        # ---------------------------------------------------------------------
        feasible_candidates: list[str] = []
        rejected_alternatives: dict[str, str] = {}
        binding_constraints: list[str] = []

        curr_cost = calculate_cost_for_placement(
            workload,
            placements_by_id.get(workload.current_placement, dc),
            egress_by_workload.get(workload.id),
        )

        for p_id, placement in placements_by_id.items():
            # 1. Compliance check
            comp_res = evaluate_placement_compliance(workload, placement)
            binding_constraints.extend(comp_res.binding_constraints)
            if not comp_res.is_eligible:
                rejected_alternatives[p_id] = comp_res.rejection_reason or "Violated compliance constraints."
                continue

            # 2. Capacity check for Private DC
            if isinstance(placement, PrivateDCAssumptions):
                fits, cap_reason = check_dc_capacity_fit(
                    placement,
                    workload.allocated_cpu_cores,
                    workload.allocated_ram_gib,
                    workload.allocated_storage_gib,
                    allocated_dc_cpu,
                    allocated_dc_ram,
                    allocated_dc_storage,
                )
                if not fits:
                    rejected_alternatives[p_id] = f"Capacity overflow: {cap_reason}"
                    binding_constraints.append(cap_reason or "DC capacity breached.")
                    continue

            feasible_candidates.append(p_id)

        binding_constraints = list(dict.fromkeys(binding_constraints))

        # Case: Infeasible
        if not feasible_candidates:
            rec = PlacementRecommendation(
                workload_id=workload.id,
                current_placement=workload.current_placement,
                recommended_placement=None,
                status=RecommendationStatus.INELIGIBLE,
                current_monthly_cost=curr_cost,
                recommended_monthly_cost=None,
                projected_monthly_savings=None,
                currency=Currency.INR,
                billing_period=BillingPeriod.MONTHLY,
                capacity_allocated_cpu=workload.allocated_cpu_cores,
                capacity_allocated_ram_gib=workload.allocated_ram_gib,
                capacity_allocated_storage_gib=workload.allocated_storage_gib,
                co_location_group_id=None,
                co_located_workload_ids=[],
                hard_compliance_passed=False,
                factors=["No candidate placement satisfies both compliance and capacity constraints."],
                binding_constraints=binding_constraints,
                assumptions=["Hard compliance rules prohibit candidate environments."],
                rejected_alternatives=rejected_alternatives,
                audit_explanation=(
                    f"INFEASIBLE: Workload '{workload.id}' has no feasible placement. "
                    f"All candidate locations were rejected due to data residency, sensitivity, or capacity limits."
                ),
                rule_engine_version=RULE_ENGINE_VERSION,
            )
            recommendations.append(rec)
            continue

        # Score feasible candidates
        scored_candidates = []
        for cand_id in feasible_candidates:
            cand_placement = placements_by_id[cand_id]
            cost = calculate_cost_for_placement(
                workload,
                cand_placement,
                egress_by_workload.get(workload.id),
            )
            # Tie-break tuple:
            # 1. cost (ascending)
            # 2. match current placement (0 if match, 1 if change)
            # 3. prefer Private DC (0 if Private DC, 1 if cloud)
            # 4. alphabetical candidate ID
            is_current = 0 if cand_id == workload.current_placement else 1
            is_cloud = 1 if not isinstance(cand_placement, PrivateDCAssumptions) else 0
            scored_candidates.append((cost, is_current, is_cloud, cand_id))

        scored_candidates.sort()
        best_cost, _, _, best_placement_id = scored_candidates[0]

        # Record higher cost rejected alternatives
        for cand_cost, _, _, cand_id in scored_candidates[1:]:
            rejected_alternatives[cand_id] = (
                f"Higher monthly cost: {cand_cost:,.2f} INR/mo vs selected {best_cost:,.2f} INR/mo."
            )

        savings = round(curr_cost - best_cost, 2)
        status = (
            RecommendationStatus.NO_CHANGE
            if best_placement_id == workload.current_placement
            else RecommendationStatus.CHANGE_RECOMMENDED
        )

        factors = [
            f"Evaluated as optimal cost placement at {best_cost:,.2f} INR/month.",
            f"All hard compliance requirements verified (Residency: {workload.residency_requirement.value}, Sensitivity: {workload.data_sensitivity.value}).",
        ]
        if savings > 0:
            factors.append(f"Delivers projected monthly operational savings of {savings:,.2f} INR.")
        elif savings < 0:
            factors.append(f"Incurs higher cost ({abs(savings):,.2f} INR) due to mandatory compliance/residency constraints.")

        audit_explanation = (
            f"Recommended placement is '{best_placement_id}' at {best_cost:,.2f} INR/month "
            f"({status.value.replace('_', ' ')} compared to current '{workload.current_placement}'). "
            f"Hard compliance constraints (Residency: {workload.residency_requirement.value}, "
            f"Sensitivity: {workload.data_sensitivity.value}) are satisfied."
        )

        rec = PlacementRecommendation(
            workload_id=workload.id,
            current_placement=workload.current_placement,
            recommended_placement=best_placement_id,
            status=status,
            current_monthly_cost=curr_cost,
            recommended_monthly_cost=best_cost,
            projected_monthly_savings=savings,
            currency=Currency.INR,
            billing_period=BillingPeriod.MONTHLY,
            capacity_allocated_cpu=workload.allocated_cpu_cores,
            capacity_allocated_ram_gib=workload.allocated_ram_gib,
            capacity_allocated_storage_gib=workload.allocated_storage_gib,
            co_location_group_id=None,
            co_located_workload_ids=[],
            hard_compliance_passed=True,
            factors=factors,
            binding_constraints=binding_constraints,
            assumptions=[
                f"DC cost baseline: PUE {dc.power_cooling_pue_overhead_pct}%, amortized rates.",
                f"Egress volume: {egress_by_workload.get(workload.id, 0.0):.1f} GiB/month.",
            ],
            rejected_alternatives=rejected_alternatives,
            audit_explanation=audit_explanation,
            rule_engine_version=RULE_ENGINE_VERSION,
        )
        recommendations.append(rec)

    # Sort final recommendations deterministically by workload_id
    recommendations.sort(key=lambda r: r.workload_id)
    return recommendations
