import { ServerConfigurationState, CapacityAnalysisResult, CapacityClassification } from '../types';

/**
 * Deterministic Capacity Analysis Engine for SkyCash MVP
 * Evaluates available vs required capacity and classifies provisioning status
 * without making false claims or connecting to external services.
 */
export class CapacityEngine {
  public static evaluate(
    setup: 'hired' | 'hybrid',
    config: ServerConfigurationState
  ): CapacityAnalysisResult {
    const isHybrid = setup === 'hybrid';

    // Rented capacity
    const rentedCount = Number(config.rentedServerCount) || 0;
    const rentedCpuPerServer = Number(config.cpuCoresPerServer) || 0;
    const rentedRamPerServer = Number(config.ramGbPerServer) || 0;
    const rentedCostPerServer = config.rentalCostUnknown
      ? null
      : (config.monthlyRentalCostPerServer !== '' && config.monthlyRentalCostPerServer !== undefined
          ? Number(config.monthlyRentalCostPerServer)
          : null);

    const rentedAvailableCpu = rentedCount * rentedCpuPerServer;
    const rentedAvailableRamGb = rentedCount * rentedRamPerServer;
    const rentedMonthlyCost = rentedCostPerServer !== null ? rentedCount * rentedCostPerServer : null;

    // Local capacity
    const localAvailableCpu = isHybrid ? (Number(config.localCpuCores) || 0) : 0;
    const localAvailableRamGb = isHybrid ? (Number(config.localRamGb) || 0) : 0;
    const localMonthlyCost = (isHybrid && !config.localCostUnknown && config.localOperatingCostMonthly !== '' && config.localOperatingCostMonthly !== undefined)
      ? Number(config.localOperatingCostMonthly)
      : null;

    // Total available
    const totalAvailableCpu = localAvailableCpu + rentedAvailableCpu;
    const totalAvailableRamGb = localAvailableRamGb + rentedAvailableRamGb;

    // Costs
    let monthlyEstimatedCost: number | null = null;
    if (rentedMonthlyCost !== null || localMonthlyCost !== null) {
      monthlyEstimatedCost = (rentedMonthlyCost || 0) + (localMonthlyCost || 0);
    }

    // Workload demand
    const demandCpu = (!config.workloadDemandUnknown && config.workloadDemandCpu !== '' && config.workloadDemandCpu !== undefined)
      ? Number(config.workloadDemandCpu)
      : null;

    const demandRamGb = (!config.workloadDemandUnknown && config.workloadDemandRam !== '' && config.workloadDemandRam !== undefined)
      ? Number(config.workloadDemandRam)
      : null;

    // Utilization
    const cpuUtilizationPct = (!config.cpuUtilizationUnknown && config.avgCpuUtilizationPct !== '' && config.avgCpuUtilizationPct !== undefined)
      ? Number(config.avgCpuUtilizationPct)
      : null;

    const ramUtilizationPct = (!config.ramUtilizationUnknown && config.avgRamUtilizationPct !== '' && config.avgRamUtilizationPct !== undefined)
      ? Number(config.avgRamUtilizationPct)
      : null;

    // Missing Data Warnings
    const missingDataWarnings: string[] = [];
    if (demandCpu === null || demandRamGb === null) {
      missingDataWarnings.push('Target workload demand (CPU/RAM) was not provided or marked unknown. Shortfall and headroom are estimated from utilization metrics.');
    }
    if (config.rentalCostUnknown) {
      missingDataWarnings.push('Rented server cost was marked unknown; overall spend calculation excludes cloud lease expenses.');
    }
    if (isHybrid && config.localCostUnknown) {
      missingDataWarnings.push('Local operating cost was marked unknown; local datacenter facility expenses are omitted.');
    }
    if (cpuUtilizationPct === null) {
      missingDataWarnings.push('Average CPU utilization is unknown; peak capacity headroom cannot be derived.');
    }
    if (ramUtilizationPct === null) {
      missingDataWarnings.push('Average RAM utilization is unknown.');
    }

    // Capacity Deltas (Available - Demand)
    const cpuDelta = demandCpu !== null ? totalAvailableCpu - demandCpu : null;
    const ramDelta = demandRamGb !== null ? totalAvailableRamGb - demandRamGb : null;

    const cpuShortfall = cpuDelta !== null ? cpuDelta < 0 : (cpuUtilizationPct !== null && cpuUtilizationPct > 85);
    const ramShortfall = ramDelta !== null ? ramDelta < 0 : (ramUtilizationPct !== null && ramUtilizationPct > 85);

    // Classification
    let classification: CapacityClassification = 'INSUFFICIENT_DATA';
    let classificationLabel = 'Insufficient Data for Definitive Assessment';
    let explanation = '';

    if (!isHybrid) {
      // Hired Server classification
      if (demandCpu !== null && demandRamGb !== null) {
        if (cpuShortfall || ramShortfall) {
          classification = 'UNDER_PROVISIONED';
          classificationLabel = 'Under-provisioned';
          const cpuDeficit = cpuDelta !== null && cpuDelta < 0 ? Math.abs(cpuDelta) : 0;
          const ramDeficit = ramDelta !== null && ramDelta < 0 ? Math.abs(ramDelta) : 0;
          explanation = `Your rented capacity cannot accommodate current workload demand. You have a shortfall of ${cpuDeficit > 0 ? `${cpuDeficit} CPU cores` : ''}${cpuDeficit > 0 && ramDeficit > 0 ? ' and ' : ''}${ramDeficit > 0 ? `${ramDeficit} GB RAM` : ''}. Workloads risk performance degradation, queue congestion, or out-of-memory crashes.`;
        } else {
          const cpuBufferPct = totalAvailableCpu > 0 ? (cpuDelta! / totalAvailableCpu) * 100 : 0;
          const ramBufferPct = totalAvailableRamGb > 0 ? (ramDelta! / totalAvailableRamGb) * 100 : 0;

          if (cpuBufferPct > 40 && ramBufferPct > 40) {
            classification = 'POTENTIALLY_OVER_PROVISIONED';
            classificationLabel = 'Potentially over-provisioned';
            explanation = `Your rented fleet provides significant excess capacity (${cpuDelta} excess CPU cores, ${ramDelta} GB excess RAM, ~${Math.round(cpuBufferPct)}% buffer above demand). You may be incurring unnecessary monthly rental spend on idle resources.`;
          } else {
            classification = 'APPROXIMATELY_MATCHED';
            classificationLabel = 'Approximately matched to demand';
            explanation = `Your rented capacity comfortably accommodates the workload demand with an appropriate operational headroom buffer of ${cpuDelta} CPU cores (${Math.round(cpuBufferPct)}%) and ${ramDelta} GB RAM.`;
          }
        }
      } else if (cpuUtilizationPct !== null) {
        // Evaluate based on utilization alone
        if (cpuUtilizationPct > 85 || (ramUtilizationPct !== null && ramUtilizationPct > 85)) {
          classification = 'UNDER_PROVISIONED';
          classificationLabel = 'Under-provisioned';
          explanation = `Average utilization is dangerously high (${cpuUtilizationPct}% CPU, ${ramUtilizationPct ?? '—'}% RAM). System exhibits severe resource contention and risks thermal/queuing bottlenecks during peak traffic.`;
        } else if (cpuUtilizationPct < 30 && (ramUtilizationPct === null || ramUtilizationPct < 35)) {
          classification = 'POTENTIALLY_OVER_PROVISIONED';
          classificationLabel = 'Potentially over-provisioned';
          explanation = `Average utilization is only ${cpuUtilizationPct}% CPU. Rented hardware appears considerably oversized for active workload patterns.`;
        } else {
          classification = 'APPROXIMATELY_MATCHED';
          classificationLabel = 'Approximately matched to demand';
          explanation = `Average utilization of ${cpuUtilizationPct}% CPU indicates balanced resource allocation with sufficient burst room.`;
        }
      } else {
        explanation = 'Provide either workload demand or average utilization metrics to generate an automated capacity sizing classification.';
      }
    } else {
      // Local + Hired Server (Hybrid) evaluation
      if (demandCpu !== null && demandRamGb !== null) {
        if (cpuShortfall || ramShortfall) {
          classification = 'UNDER_PROVISIONED';
          classificationLabel = 'Under-provisioned';
          explanation = `Combined local and rented capacity falls short of total workload demand by ${cpuDelta !== null && cpuDelta < 0 ? `${Math.abs(cpuDelta)} cores` : ''}${cpuDelta !== null && cpuDelta < 0 && ramDelta !== null && ramDelta < 0 ? ' and ' : ''}${ramDelta !== null && ramDelta < 0 ? `${Math.abs(ramDelta)} GB RAM` : ''}.`;
        } else {
          const cpuExcess = cpuDelta || 0;
          if (cpuExcess > (totalAvailableCpu * 0.4)) {
            classification = 'POTENTIALLY_OVER_PROVISIONED';
            classificationLabel = 'Potentially over-provisioned';
            explanation = `Combined hybrid infrastructure provides substantial surplus capacity (${cpuExcess} excess cores) beyond confirmed demand.`;
          } else {
            classification = 'APPROXIMATELY_MATCHED';
            classificationLabel = 'Approximately matched to demand';
            explanation = `Combined hybrid capacity matches workload requirements effectively, providing healthy resilience across on-premises and rented cloud resources.`;
          }
        }
      } else {
        classification = 'APPROXIMATELY_MATCHED';
        classificationLabel = 'Hybrid Architecture Configured';
        explanation = 'Hybrid capacity model configured. Workload placement allocation derived based on local baseline and cloud burst capacity.';
      }
    }

    // Suggested Allocation for Hybrid Setup
    let suggestedAllocation: CapacityAnalysisResult['suggestedAllocation'] = undefined;
    if (isHybrid) {
      const targetCpu = demandCpu ?? (localAvailableCpu * 0.75 + rentedAvailableCpu * 0.5);
      const targetRam = demandRamGb ?? (localAvailableRamGb * 0.75 + rentedAvailableRamGb * 0.5);

      // Prioritize local datacenter for baseline / compliance
      const localWorkloadCores = Math.min(localAvailableCpu, Math.round(targetCpu * 0.7));
      const localWorkloadRamGb = Math.min(localAvailableRamGb, Math.round(targetRam * 0.7));

      const rentedWorkloadCores = Math.max(0, targetCpu - localWorkloadCores);
      const rentedWorkloadRamGb = Math.max(0, targetRam - localWorkloadRamGb);

      const residency = config.residencyConstraint || 'KARNATAKA_DC_ONLY';
      const coLocate = !!config.coLocationRequirement;

      let rationale = `Allocate ${localWorkloadCores} cores and ${localWorkloadRamGb} GB RAM to the local Karnataka DC facility for low-latency baseline operations`;
      if (residency === 'KARNATAKA_DC_ONLY') {
        rationale += `, satisfying strict local data residency compliance`;
      }
      if (coLocate) {
        rationale += ` and ensuring zero-latency co-location with local databases`;
      }
      rationale += `. Allocate the remaining ${rentedWorkloadCores} cores and ${rentedWorkloadRamGb} GB RAM to rented cloud servers for elastic burstage and peripheral services.`;

      suggestedAllocation = {
        localWorkloadCores,
        localWorkloadRamGb,
        rentedWorkloadCores,
        rentedWorkloadRamGb,
        rationale,
      };
    }

    return {
      setup,
      totalAvailableCpu,
      totalAvailableRamGb,
      localAvailableCpu,
      localAvailableRamGb,
      rentedAvailableCpu,
      rentedAvailableRamGb,
      demandCpu,
      demandRamGb,
      cpuUtilizationPct,
      ramUtilizationPct,
      monthlyEstimatedCost,
      cpuDelta,
      ramDelta,
      cpuShortfall,
      ramShortfall,
      classification,
      classificationLabel,
      explanation,
      suggestedAllocation,
      missingDataWarnings,
    };
  }
}
