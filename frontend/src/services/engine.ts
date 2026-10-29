import {
  Workload,
  PrivateDCAssumptions,
  PublicCloudRegion,
  DependencyGraph,
  PlacementRecommendation,
  ComplianceViolation,
  EstateOverview,
} from '../types';

export class PlacementDecisionEngine {
  /**
   * Calculate monthly amortized cost for a workload hosted in the Karnataka Private DC.
   */
  static calculatePrivateDCCost(
    workload: Workload,
    dc: PrivateDCAssumptions
  ): number {
    const computeCost = workload.allocated_cpu_cores * dc.amortized_cost_per_cpu_core_month;
    const memoryCost = workload.allocated_ram_gib * dc.amortized_cost_per_ram_gib_month;
    const storageCost = workload.allocated_storage_gib * dc.amortized_cost_per_storage_gib_month;
    const directHardware = computeCost + memoryCost + storageCost;
    const pueOverhead = directHardware * (dc.power_cooling_pue_overhead_pct / 100);

    return Math.round((directHardware + pueOverhead) * 100) / 100;
  }

  /**
   * Calculate monthly pay-as-you-go run cost in an approved public cloud region.
   */
  static calculateCloudRegionCost(
    workload: Workload,
    region: PublicCloudRegion,
    estimatedEgressGib: number = 100
  ): number {
    const compute = workload.allocated_cpu_cores * region.compute_rate_per_vcpu_month;
    const memory = workload.allocated_ram_gib * region.memory_rate_per_gib_month;
    const storage = workload.allocated_storage_gib * region.storage_ssd_rate_per_gib_month;
    const egress = estimatedEgressGib * region.egress_rate_per_gib;

    return Math.round((compute + memory + storage + egress) * 100) / 100;
  }

  /**
   * Deterministically evaluate candidate placement eligibility for a workload.
   */
  static evaluatePlacementEligibility(
    workload: Workload,
    candidateRegion: PublicCloudRegion,
    depGraph: DependencyGraph,
    workloadsMap: Map<string, Workload>
  ): { isEligible: boolean; violations: ComplianceViolation[] } {
    const violations: ComplianceViolation[] = [];

    // 1. Data Residency Hard Check
    if (workload.residency_requirement === 'KARNATAKA_DC_ONLY') {
      violations.push({
        id: `viol-${workload.id}-residency-dc-only`,
        workload_id: workload.id,
        placement_id: candidateRegion.region_id,
        rule_name: 'DATA_RESIDENCY_KARNATAKA_DC_ONLY',
        severity: 'HARD_VIOLATION',
        description: `${workload.name} mandates physical hosting inside Karnataka Private Data Centre under RBI data localization directives.`,
        conflicting_attribute: 'location_state',
        required_value: 'Karnataka',
        actual_value: candidateRegion.location_city,
      });
    } else if (
      workload.residency_requirement === 'INDIA_ONLY' &&
      candidateRegion.location_country !== 'IN'
    ) {
      violations.push({
        id: `viol-${workload.id}-residency-india-only`,
        workload_id: workload.id,
        placement_id: candidateRegion.region_id,
        rule_name: 'DATA_RESIDENCY_INDIA_ONLY',
        severity: 'HARD_VIOLATION',
        description: `${workload.name} requires sovereign residency within India jurisdiction.`,
        conflicting_attribute: 'location_country',
        required_value: 'IN',
        actual_value: candidateRegion.location_country,
      });
    }

    // 2. Data Sensitivity Hard Check
    if (workload.data_sensitivity === 'RESTRICTED') {
      violations.push({
        id: `viol-${workload.id}-restricted-cloud-block`,
        workload_id: workload.id,
        placement_id: candidateRegion.region_id,
        rule_name: 'DATA_SENSITIVITY_RESTRICTED_ISOLATION',
        severity: 'HARD_VIOLATION',
        description: `RESTRICTED workloads cannot be placed in multi-tenant or public cloud environments.`,
        conflicting_attribute: 'data_sensitivity',
        required_value: 'PRIVATE_DC',
        actual_value: 'PUBLIC_CLOUD',
      });
    } else if (!candidateRegion.allowed_sensitivities.includes(workload.data_sensitivity)) {
      violations.push({
        id: `viol-${workload.id}-sensitivity-unsupported`,
        workload_id: workload.id,
        placement_id: candidateRegion.region_id,
        rule_name: 'CLOUD_REGION_SENSITIVITY_DISALLOWED',
        severity: 'HARD_VIOLATION',
        description: `${candidateRegion.region_name} does not permit ${workload.data_sensitivity} classified data.`,
        conflicting_attribute: 'allowed_sensitivities',
        required_value: workload.data_sensitivity,
        actual_value: candidateRegion.allowed_sensitivities.join(', '),
      });
    }

    // 3. Dependency & Co-Location Hard Check
    for (const [groupId, memberIds] of Object.entries(depGraph.co_location_groups)) {
      if (memberIds.includes(workload.id)) {
        // Find companion workloads
        for (const companionId of memberIds) {
          if (companionId === workload.id) continue;
          const companion = workloadsMap.get(companionId);
          if (companion) {
            // If companion is restricted to Karnataka DC, this workload is anchored to Karnataka DC!
            if (
              companion.residency_requirement === 'KARNATAKA_DC_ONLY' ||
              companion.data_sensitivity === 'RESTRICTED'
            ) {
              violations.push({
                id: `viol-${workload.id}-colocation-anchor`,
                workload_id: workload.id,
                placement_id: candidateRegion.region_id,
                rule_name: 'CO_LOCATION_MANDATORY_RESIDENCY_ANCHOR',
                severity: 'HARD_VIOLATION',
                description: `Mandatory co-location with anchor workload ${companion.name} (${companion.id}) locks placement to Karnataka DC.`,
                conflicting_attribute: 'co_location_groups',
                required_value: groupId,
                actual_value: `Cannot split companion ${companion.id}`,
              });
            }
          }
        }
      }
    }

    return {
      isEligible: violations.length === 0,
      violations,
    };
  }

  /**
   * Run the full placement decision policy for all workloads.
   */
  static generatePlacementRecommendations(
    workloads: Workload[],
    dc: PrivateDCAssumptions,
    regions: PublicCloudRegion[],
    depGraph: DependencyGraph
  ): PlacementRecommendation[] {
    const workloadsMap = new Map<string, Workload>(workloads.map((w) => [w.id, w]));
    const approvedRegions = regions.filter((r) => r.approval_status === 'APPROVED');

    return workloads.map((workload) => {
      const currentCost = this.calculatePrivateDCCost(workload, dc);

      // Check co-location group
      let coLocationGroupId: string | null = null;
      let coLocatedWorkloadIds: string[] = [];
      for (const [groupId, memberIds] of Object.entries(depGraph.co_location_groups)) {
        if (memberIds.includes(workload.id)) {
          coLocationGroupId = groupId;
          coLocatedWorkloadIds = memberIds.filter((id) => id !== workload.id);
          break;
        }
      }

      // Evaluate candidate cloud regions
      let bestPlacement = dc.dc_id;
      let bestCost = currentCost;
      const factors: string[] = [];
      const assumptions: string[] = [
        `Private DC cost based on Karnataka DC amortized baseline (₹${dc.amortized_cost_per_cpu_core_month}/vCPU, ₹${dc.amortized_cost_per_ram_gib_month}/GiB RAM, ₹${dc.amortized_cost_per_storage_gib_month}/GiB SAN).`,
      ];
      let auditExplanation = '';

      // Check if hard residency or sensitivity blocks cloud
      if (workload.residency_requirement === 'KARNATAKA_DC_ONLY') {
        factors.push('Mandatory Karnataka DC residency (RBI regulatory localization mandate).');
        factors.push(`Data sensitivity is ${workload.data_sensitivity}.`);
        if (coLocationGroupId) {
          factors.push(`Anchor member of ${coLocationGroupId}.`);
        }
        auditExplanation = `${workload.name} mandates local physical hosting in Karnataka DC under regulatory rules. Disqualified from all public cloud regions.`;

        return {
          workload_id: workload.id,
          current_placement: workload.current_placement,
          recommended_placement: dc.dc_id,
          status: 'NO_CHANGE',
          current_monthly_cost: currentCost,
          recommended_monthly_cost: currentCost,
          projected_monthly_savings: 0,
          currency: 'INR',
          billing_period: 'MONTHLY',
          capacity_allocated_cpu: workload.allocated_cpu_cores,
          capacity_allocated_ram_gib: workload.allocated_ram_gib,
          capacity_allocated_storage_gib: workload.allocated_storage_gib,
          co_location_group_id: coLocationGroupId,
          co_located_workload_ids: coLocatedWorkloadIds,
          hard_compliance_passed: true,
          factors,
          assumptions,
          audit_explanation: auditExplanation,
          rule_engine_version: '0.1.0',
        };
      }

      // Check co-location lock
      let isCoLocationLocked = false;
      for (const companionId of coLocatedWorkloadIds) {
        const companion = workloadsMap.get(companionId);
        if (
          companion &&
          (companion.residency_requirement === 'KARNATAKA_DC_ONLY' ||
            companion.data_sensitivity === 'RESTRICTED')
        ) {
          isCoLocationLocked = true;
          factors.push(
            `Mandatory co-location with ${companion.name} (${companion.id}) in ${coLocationGroupId}.`
          );
          factors.push('Max tolerable round-trip latency ceiling: 2.0 ms.');
          auditExplanation = `Although data sensitivity is ${workload.data_sensitivity}, mandatory co-location with ${companion.name} requires co-residency in Karnataka DC to satisfy low-latency requirements.`;
          break;
        }
      }

      if (isCoLocationLocked) {
        return {
          workload_id: workload.id,
          current_placement: workload.current_placement,
          recommended_placement: dc.dc_id,
          status: 'NO_CHANGE',
          current_monthly_cost: currentCost,
          recommended_monthly_cost: currentCost,
          projected_monthly_savings: 0,
          currency: 'INR',
          billing_period: 'MONTHLY',
          capacity_allocated_cpu: workload.allocated_cpu_cores,
          capacity_allocated_ram_gib: workload.allocated_ram_gib,
          capacity_allocated_storage_gib: workload.allocated_storage_gib,
          co_location_group_id: coLocationGroupId,
          co_located_workload_ids: coLocatedWorkloadIds,
          hard_compliance_passed: true,
          factors,
          assumptions,
          audit_explanation: auditExplanation,
          rule_engine_version: '0.1.0',
        };
      }

      // Evaluate eligible cloud regions
      const preferredProvider = workload.soft_preferences?.preferred_provider;
      let evaluatedCandidate: { region: PublicCloudRegion; cost: number } | null = null;

      for (const region of approvedRegions) {
        const { isEligible } = this.evaluatePlacementEligibility(
          workload,
          region,
          depGraph,
          workloadsMap
        );

        if (isEligible) {
          const cloudCost = this.calculateCloudRegionCost(workload, region);

          // If provider matches soft preference or is cheaper
          if (!evaluatedCandidate) {
            evaluatedCandidate = { region, cost: cloudCost };
          } else if (
            preferredProvider &&
            region.provider.toLowerCase() === preferredProvider.toLowerCase()
          ) {
            evaluatedCandidate = { region, cost: cloudCost };
          } else if (cloudCost < evaluatedCandidate.cost) {
            evaluatedCandidate = { region, cost: cloudCost };
          }
        }
      }

      if (evaluatedCandidate && evaluatedCandidate.cost < currentCost) {
        bestPlacement = evaluatedCandidate.region.region_id;
        bestCost = evaluatedCandidate.cost;
        const savings = Math.round((currentCost - bestCost) * 100) / 100;

        factors.push(
          `Cost reduction in public cloud (${evaluatedCandidate.region.provider} ${evaluatedCandidate.region.region_name}).`
        );
        factors.push(`Data sensitivity ${workload.data_sensitivity} permitted in approved sovereign cloud.`);
        if (preferredProvider) {
          factors.push(`Soft preference match: ${preferredProvider}.`);
        }
        factors.push(
          `Relieves ${workload.allocated_cpu_cores} vCPU cores and ${workload.allocated_ram_gib} GiB RAM in Karnataka DC.`
        );

        assumptions.push(
          `${evaluatedCandidate.region.provider} on-demand standard pricing in ${evaluatedCandidate.region.region_id}.`
        );

        auditExplanation = `${workload.name} is eligible for ${evaluatedCandidate.region.provider} ${evaluatedCandidate.region.region_name}, saving ₹${savings.toLocaleString('en-IN')}/month while fully respecting data residency.`;

        return {
          workload_id: workload.id,
          current_placement: workload.current_placement,
          recommended_placement: bestPlacement,
          status: 'CHANGE_RECOMMENDED',
          current_monthly_cost: currentCost,
          recommended_monthly_cost: bestCost,
          projected_monthly_savings: savings,
          currency: 'INR',
          billing_period: 'MONTHLY',
          capacity_allocated_cpu: workload.allocated_cpu_cores,
          capacity_allocated_ram_gib: workload.allocated_ram_gib,
          capacity_allocated_storage_gib: workload.allocated_storage_gib,
          co_location_group_id: coLocationGroupId,
          co_located_workload_ids: coLocatedWorkloadIds,
          hard_compliance_passed: true,
          factors,
          assumptions,
          audit_explanation: auditExplanation,
          rule_engine_version: '0.1.0',
        };
      }

      // If no cheaper eligible placement found
      factors.push('Private DC hosting remains optimal or lowest fully burdened cost.');
      auditExplanation = `${workload.name} current hosting in Karnataka DC is cost-effective and compliant. No change recommended.`;

      return {
        workload_id: workload.id,
        current_placement: workload.current_placement,
        recommended_placement: dc.dc_id,
        status: 'NO_CHANGE',
        current_monthly_cost: currentCost,
        recommended_monthly_cost: currentCost,
        projected_monthly_savings: 0,
        currency: 'INR',
        billing_period: 'MONTHLY',
        capacity_allocated_cpu: workload.allocated_cpu_cores,
        capacity_allocated_ram_gib: workload.allocated_ram_gib,
        capacity_allocated_storage_gib: workload.allocated_storage_gib,
        co_location_group_id: coLocationGroupId,
        co_located_workload_ids: coLocatedWorkloadIds,
        hard_compliance_passed: true,
        factors,
        assumptions,
        audit_explanation: auditExplanation,
        rule_engine_version: '0.1.0',
      };
    });
  }

  /**
   * Aggregate estate-level summary metrics comparing current placement vs recommendations.
   */
  static computeEstateOverview(
    workloads: Workload[],
    recommendations: PlacementRecommendation[],
    dc: PrivateDCAssumptions
  ): EstateOverview {
    const totalCurrentCost = recommendations.reduce(
      (acc, r) => acc + r.current_monthly_cost,
      0
    );
    const totalRecommendedCost = recommendations.reduce(
      (acc, r) => acc + r.recommended_monthly_cost,
      0
    );
    const totalSavings = Math.round((totalCurrentCost - totalRecommendedCost) * 100) / 100;
    const savingsPct =
      totalCurrentCost > 0
        ? Math.round((totalSavings / totalCurrentCost) * 1000) / 10
        : 0;

    let retainedInDC = 0;
    let movedToCloud = 0;
    let dcCpuUsed = 0;
    let dcRamUsed = 0;
    let dcStorageUsed = 0;
    let freedCpu = 0;
    let freedRam = 0;
    let freedStorage = 0;

    for (const rec of recommendations) {
      if (rec.recommended_placement === dc.dc_id) {
        retainedInDC += 1;
        dcCpuUsed += rec.capacity_allocated_cpu;
        dcRamUsed += rec.capacity_allocated_ram_gib;
        dcStorageUsed += rec.capacity_allocated_storage_gib;
      } else {
        movedToCloud += 1;
        freedCpu += rec.capacity_allocated_cpu;
        freedRam += rec.capacity_allocated_ram_gib;
        freedStorage += rec.capacity_allocated_storage_gib;
      }
    }

    return {
      total_workloads: workloads.length,
      total_current_monthly_cost: Math.round(totalCurrentCost),
      total_recommended_monthly_cost: Math.round(totalRecommendedCost),
      total_monthly_savings: Math.max(0, totalSavings),
      savings_percentage: savingsPct,
      retained_in_dc_count: retainedInDC,
      moved_to_cloud_count: movedToCloud,
      dc_cpu_used: dcCpuUsed,
      dc_cpu_usable: dc.usable_cpu_cores,
      dc_cpu_total: dc.total_cpu_cores,
      dc_ram_used_gib: dcRamUsed,
      dc_ram_usable_gib: dc.usable_ram_gib,
      dc_ram_total_gib: dc.total_ram_gib,
      dc_storage_used_gib: dcStorageUsed,
      dc_storage_usable_gib: dc.usable_storage_gib,
      dc_storage_total_gib: dc.total_storage_gib,
      dc_freed_cpu: freedCpu,
      dc_freed_ram_gib: freedRam,
      dc_freed_storage_gib: freedStorage,
    };
  }
}
