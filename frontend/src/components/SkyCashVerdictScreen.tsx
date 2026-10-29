import React, { useState, useMemo } from 'react';
import { ServerConfigurationState, CapacityAnalysisResult } from '../types';
import { CapacityEngine } from '../services/capacityEngine';
import { validateConfiguration } from '../services/configurationValidator';
import { BackgroundCyberGrid } from './3d/BackgroundCyberGrid';
import { Verdict3DScene } from './3d/Verdict3DScene';
import { StepProgressIndicator } from './StepProgressIndicator';

interface SkyCashVerdictScreenProps {
  baselineConfig: ServerConfigurationState;
  baselineResult: CapacityAnalysisResult;
  testScenarioConfig: ServerConfigurationState | null;
  selectedSetup: 'hired' | 'hybrid';
  maxUnlockedStep: number;
  hasTestedComparison: boolean;
  onNavigateStep: (step: number) => void;
  onBackToTesting: () => void;
  onBackToConfig: () => void;
  onStartNewAssessment: () => void;
  onLoadDemoData: () => void;
}

export type VerdictStatus =
  | 'UNDER_PROVISIONED'
  | 'SUFFICIENT'
  | 'OVER_PROVISIONED'
  | 'HYBRID_SUITABLE'
  | 'INSUFFICIENT_INFO';

export const SkyCashVerdictScreen: React.FC<SkyCashVerdictScreenProps> = ({
  baselineConfig,
  baselineResult,
  testScenarioConfig,
  selectedSetup,
  maxUnlockedStep,
  hasTestedComparison,
  onNavigateStep,
  onBackToTesting,
  onBackToConfig,
  onStartNewAssessment,
  onLoadDemoData,
}) => {
  const isHybrid = selectedSetup === 'hybrid';
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isBreakdownExpanded, setIsBreakdownExpanded] = useState(false);

  // 1. STRICT DATA GATE VALIDATION
  const validation = useMemo(() => {
    return validateConfiguration(selectedSetup, baselineConfig);
  }, [selectedSetup, baselineConfig]);

  // Recalculate test scenario results if available
  const testScenarioResult = useMemo(() => {
    if (!testScenarioConfig || !validation.isValid) return null;
    return CapacityEngine.evaluate(selectedSetup, testScenarioConfig);
  }, [selectedSetup, testScenarioConfig, validation.isValid]);

  // Cost difference against test scenario
  const costDeltaAgainstTest = useMemo(() => {
    if (
      !testScenarioResult ||
      baselineResult.monthlyEstimatedCost === null ||
      testScenarioResult.monthlyEstimatedCost === null
    ) {
      return null;
    }
    return baselineResult.monthlyEstimatedCost - testScenarioResult.monthlyEstimatedCost;
  }, [baselineResult.monthlyEstimatedCost, testScenarioResult]);

  // 2. DETERMINISTIC FINAL VERDICT DERIVATION
  const verdict = useMemo<{
    type: VerdictStatus;
    title: string;
    badgeClass: string;
    summary: string;
    details: string;
  }>(() => {
    const { demandCpu, demandRamGb, cpuShortfall, ramShortfall, totalAvailableCpu, totalAvailableRamGb, cpuUtilizationPct } = baselineResult;

    // Check if demand information was omitted
    if (demandCpu === null || demandRamGb === null) {
      if (cpuUtilizationPct !== null) {
        if (cpuUtilizationPct > 85) {
          return {
            type: 'UNDER_PROVISIONED',
            title: 'Under-provisioned',
            badgeClass: 'under',
            summary: 'Average reported utilization exceeds safe operational limits (85%+), creating high contention and queuing risk.',
            details: 'Workload demand metrics were not explicitly specified, but telemetric utilization indicates severe pressure on server compute.',
          };
        }
        if (cpuUtilizationPct < 30) {
          return {
            type: 'OVER_PROVISIONED',
            title: 'Potentially Over-provisioned',
            badgeClass: 'over',
            summary: 'Average reported utilization is low (<30%), indicating significant unutilized hardware capacity and excess rental expenditure.',
            details: 'The infrastructure operates with excess idle headroom that could be scaled down to economize monthly cloud spend.',
          };
        }
        return {
          type: 'SUFFICIENT',
          title: 'Capacity Appears Sufficient',
          badgeClass: 'sufficient',
          summary: 'Reported telemetry indicates steady capacity headroom without severe resource contention.',
          details: 'Average utilization falls within the recommended 40%–80% operating envelope for mission-critical enterprise workloads.',
        };
      }
      return {
        type: 'INSUFFICIENT_INFO',
        title: 'Insufficient Information for a Reliable Verdict',
        badgeClass: 'insufficient',
        summary: 'Target workload demand and utilization telemetry were omitted or marked unknown.',
        details: 'SkyCash cannot mathematically certify whether your hardware satisfies demand without confirmed peak load parameters.',
      };
    }

    // When demand is supplied:
    if (cpuShortfall || ramShortfall) {
      return {
        type: 'UNDER_PROVISIONED',
        title: 'Under-provisioned',
        badgeClass: 'under',
        summary: `Available hardware falls short of total workload demand by ${
          baselineResult.cpuDelta !== null && baselineResult.cpuDelta < 0
            ? `${Math.abs(baselineResult.cpuDelta)} CPU cores`
            : ''
        }${
          baselineResult.cpuDelta !== null && baselineResult.cpuDelta < 0 && baselineResult.ramDelta !== null && baselineResult.ramDelta < 0
            ? ' and '
            : ''
        }${
          baselineResult.ramDelta !== null && baselineResult.ramDelta < 0
            ? `${Math.abs(baselineResult.ramDelta)} GB RAM`
            : ''
        }.`,
        details: 'Hardware capacity cannot safely execute concurrent workloads without queuing delays, degraded throughput, or out-of-memory errors.',
      };
    }

    if (isHybrid) {
      return {
        type: 'HYBRID_SUITABLE',
        title: 'Hybrid Configuration May Be Suitable',
        badgeClass: 'hybrid',
        summary: `Local Karnataka DC (${baselineConfig.localCpuCores || 0} cores) provides deterministic sovereignty, while cloud fleet (${baselineResult.rentedAvailableCpu} cores) handles burst capacity.`,
        details: 'IMPORTANT CONSTRAINT: Combined capacity is NOT a single fungible pool. Workloads subject to RBI data residency localization or microsecond database latency must remain strictly anchored to Karnataka DC.',
      };
    }

    // Pure Hired Server
    const cpuBuffer = totalAvailableCpu - demandCpu;
    const cpuBufferPct = (cpuBuffer / totalAvailableCpu) * 100;
    if (cpuBufferPct > 45) {
      return {
        type: 'OVER_PROVISIONED',
        title: 'Potentially Over-provisioned',
        badgeClass: 'over',
        summary: `Rented cloud fleet provides substantial surplus capacity (~${Math.round(cpuBufferPct)}% buffer above target demand).`,
        details: 'While operational headroom prevents throttling, you are incurring continuous monthly lease spend for idle cores and memory.',
      };
    }

    return {
      type: 'SUFFICIENT',
      title: 'Capacity Appears Sufficient',
      badgeClass: 'sufficient',
      summary: `Your rented infrastructure provides balanced compute (${totalAvailableCpu} cores) and memory (${totalAvailableRamGb} GB) with a healthy buffer of ${cpuBuffer} cores.`,
      details: 'Available capacity accommodates the specified workload demand with adequate headroom to absorb transient traffic spikes.',
    };
  }, [baselineResult, baselineConfig, isHybrid]);

  // STRICT DATA GATE: Check prerequisites
  const isPrerequisiteMet = validation.isValid && hasTestedComparison;

  if (!isPrerequisiteMet) {
    return (
      <div className="verdict-page-container">
        <BackgroundCyberGrid />

        {/* 5-Step Progress Stepper */}
        <StepProgressIndicator
          currentStep={5}
          maxUnlockedStep={maxUnlockedStep}
          onNavigateStep={onNavigateStep}
        />

        <div className="validation-gate-container">
          <div className="gate-locked-card">
            <div className="gate-icon-pulse">
              <span className="gate-lock-icon">🔒</span>
            </div>

            <div className="gate-status-badge">PREREQUISITES INCOMPLETE</div>

            <h1 className="gate-title">Step 5 — Final Verdict Locked</h1>
            <p className="gate-subtitle">
              SkyCash does not produce speculative final verdicts. To unlock your verified infrastructure verdict,
              you must complete valid server configuration in Step 2 and test comparison scenarios in Step 4.
            </p>

            <div className="gate-checklist">
              <div className={`gate-check-item ${validation.isValid ? 'done' : 'pending'}`}>
                <span className="check-status-icon">{validation.isValid ? '✓' : '○'}</span>
                <div>
                  <strong>Step 2: Server Configuration Completed</strong>
                  <p>
                    {validation.isValid
                      ? 'Valid configuration parameters confirmed.'
                      : `Missing required fields (${validation.missingFields.length} remaining).`}
                  </p>
                </div>
              </div>

              <div className={`gate-check-item ${hasTestedComparison ? 'done' : 'pending'}`}>
                <span className="check-status-icon">{hasTestedComparison ? '✓' : '○'}</span>
                <div>
                  <strong>Step 4: Scenario Testing & Comparison Reviewed</strong>
                  <p>
                    {hasTestedComparison
                      ? 'Alternative scenario variations evaluated.'
                      : 'Must review baseline vs alternative scenario in Step 4.'}
                  </p>
                </div>
              </div>
            </div>

            <div className="gate-actions-row">
              {!validation.isValid ? (
                <>
                  <button
                    type="button"
                    className="btn-action primary"
                    onClick={onBackToConfig}
                  >
                    ✏ Return to Server Configuration (Step 2)
                  </button>
                  <button
                    type="button"
                    className="btn-action secondary demo-load-btn"
                    onClick={onLoadDemoData}
                  >
                    ✨ Load Illustrative Demo Data
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="btn-action primary"
                  onClick={onBackToTesting}
                >
                  🧪 Return to Testing & Comparison (Step 4)
                </button>
              )}
            </div>

            <div className="gate-notice-footer">
              SkyCash maintains deterministic audit integrity. No verdict is presented without verified inputs.
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Derived recommendation text for Item 05
  const recommendedActionSummary = useMemo(() => {
    if (verdict.type === 'UNDER_PROVISIONED') {
      return 'Scale up compute and memory allocations to eliminate the operational deficit before migration.';
    }
    if (verdict.type === 'OVER_PROVISIONED') {
      return 'Right-size the cloud instance fleet to reduce monthly lease run-rate without compromising peak buffer.';
    }
    if (verdict.type === 'HYBRID_SUITABLE') {
      return 'Maintain private datacenter for Tier-0 sovereign ledgers; route elastic burst workloads to approved cloud zones.';
    }
    if (verdict.type === 'SUFFICIENT') {
      return 'Retain the current infrastructure sizing; monitor monthly peak traffic variations.';
    }
    return 'Collect workload demand telemetry to enable definitive automated placement.';
  }, [verdict.type]);

  // --- UNLOCKED FINAL VERDICT CONTENT ---
  return (
    <div className="verdict-page-container screen5-container">
      <BackgroundCyberGrid />

      {/* 5-Step Progress Stepper */}
      <StepProgressIndicator
        currentStep={5}
        maxUnlockedStep={5}
        onNavigateStep={onNavigateStep}
      />

      {/* Page Header */}
      <header className="screen5-header">
        <div className="screen5-header-main">
          <div className="screen5-badge-row">
            <span className="screen5-step-pill">Step 5 of 5 — Final Verdict</span>
            <span className="screen5-arch-badge">
              {isHybrid ? 'OPTION B · HYBRID ARCHITECTURE' : 'OPTION A · HIRED FLEET'}
            </span>
            {validation.isDemo && (
              <span className="screen5-demo-pill">Illustrative Demo Assessment</span>
            )}
          </div>
          <h1 className="screen5-title">SkyCash Final Verdict</h1>
          <p className="screen5-subtitle">Your infrastructure assessment, explained.</p>
        </div>

        <div className="screen5-header-actions">
          <button
            type="button"
            className="btn-screen5-secondary"
            onClick={onBackToTesting}
            title="Return to Step 4 Testing & Comparison"
          >
            ← Back to Testing
          </button>
          <button
            type="button"
            className="btn-screen5-secondary"
            onClick={onBackToConfig}
            title="Edit configuration inputs in Step 2"
          >
            ✏ Edit Configuration
          </button>
          <button
            type="button"
            className="btn-screen5-danger"
            onClick={() => setIsResetModalOpen(true)}
            title="Reset assessment and start fresh"
          >
            ↺ Start New Assessment
          </button>
        </div>
      </header>

      {/* 1. Verdict Summary Panel */}
      <section className="screen5-summary-panel">
        <div className="screen5-summary-layout">
          {/* Left: 3D Evaluated Infrastructure Visualizer */}
          <div className="screen5-3d-side">
            <Verdict3DScene
              setup={selectedSetup}
              verdictType={verdict.type}
              totalCpu={baselineResult.totalAvailableCpu}
              totalRam={baselineResult.totalAvailableRamGb}
            />
            <div className="screen5-3d-caption">
              <span>Evaluated Architecture: {isHybrid ? 'On-Premises DC + Cloud Fleet' : 'Cloud Compute Fleet'}</span>
            </div>
          </div>

          {/* Right: Primary Status Synthesis */}
          <div className="screen5-verdict-content">
            <div className="screen5-verdict-header">
              <span className="screen5-status-kicker">PRIMARY STATUS</span>
              <span className={`screen5-verdict-badge ${verdict.badgeClass}`}>
                {verdict.title}
              </span>
            </div>

            <h2 className="screen5-verdict-headline">{verdict.summary}</h2>
            <p className="screen5-verdict-subtext">{verdict.details}</p>

            {/* Core Metrics Strip */}
            <div className="screen5-metrics-strip">
              <div className="strip-metric-item">
                <span className="strip-metric-label">Available CPU</span>
                <span className="strip-metric-val teal">{baselineResult.totalAvailableCpu} vCPU</span>
              </div>
              <div className="strip-metric-item">
                <span className="strip-metric-label">Required CPU</span>
                <span className="strip-metric-val">
                  {baselineResult.demandCpu !== null ? `${baselineResult.demandCpu} vCPU` : 'Unspecified'}
                </span>
              </div>
              <div className="strip-metric-item">
                <span className="strip-metric-label">Available RAM</span>
                <span className="strip-metric-val blue">{baselineResult.totalAvailableRamGb} GB</span>
              </div>
              <div className="strip-metric-item">
                <span className="strip-metric-label">Required RAM</span>
                <span className="strip-metric-val">
                  {baselineResult.demandRamGb !== null ? `${baselineResult.demandRamGb} GB` : 'Unspecified'}
                </span>
              </div>
              <div className="strip-metric-item">
                <span className="strip-metric-label">Monthly Run-Rate</span>
                <span className="strip-metric-val highlight">
                  {baselineResult.monthlyEstimatedCost !== null
                    ? `₹ ${baselineResult.monthlyEstimatedCost.toLocaleString('en-IN')}`
                    : 'Unspecified'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. "How SkyCash Reached This Verdict" Section (Description-List Layout) */}
      <section className="screen5-ordered-explanation-section">
        <div className="screen5-section-title-bar">
          <div className="title-wrap">
            <span className="section-pill">Step-by-Step Audit Breakdown</span>
            <h2 className="section-main-heading">How SkyCash Reached This Verdict</h2>
          </div>
          <span className="section-meta-tag">Point-by-Point Evaluation</span>
        </div>

        <div className="screen5-explanation-cards-list">
          {/* ITEM 01 — Your Configuration */}
          <div className="screen5-item-card">
            <div className="item-card-header">
              <span className="item-num-marker">01</span>
              <div className="item-heading-wrap">
                <h3 className="item-heading">Your Configuration</h3>
                <span className="item-subheading">Supplied infrastructure specifications and data provenance</span>
              </div>
            </div>

            {/* Fact List (Description-list rows) */}
            <div className="screen5-dl-grid">
              <div className="screen5-dl-item">
                <span className="screen5-dl-label">Configuration Type</span>
                <span className="screen5-dl-val highlight">
                  {isHybrid ? 'Option B: Local + Hired Server' : 'Option A: Hired Server'}
                </span>
              </div>
              <div className="screen5-dl-item">
                <span className="screen5-dl-label">Rented Server Fleet</span>
                <span className="screen5-dl-val">
                  {baselineConfig.rentedServerCount || 0} instances ({baselineConfig.cpuCoresPerServer || 0} vCPU, {baselineConfig.ramGbPerServer || 0} GB each)
                </span>
              </div>
              {isHybrid && (
                <div className="screen5-dl-item">
                  <span className="screen5-dl-label">Local Datacenter Capacity</span>
                  <span className="screen5-dl-val">
                    {baselineConfig.localCpuCores || 0} vCPU cores, {baselineConfig.localRamGb || 0} GB RAM
                  </span>
                </div>
              )}
              <div className="screen5-dl-item">
                <span className="screen5-dl-label">Data Provenance</span>
                <span className={`screen5-dl-val ${validation.isDemo ? 'text-amber' : 'text-teal'}`}>
                  {validation.isDemo ? 'Illustrative Demo Data' : 'User-Entered Custom Specification'}
                </span>
              </div>
            </div>

            <p className="screen5-item-explanation">
              SkyCash evaluated your {isHybrid ? 'hybrid infrastructure deployment' : 'pure cloud rental fleet'} utilizing{' '}
              {isHybrid
                ? `${baselineConfig.localCpuCores || 0} local cores alongside ${baselineConfig.rentedServerCount || 0} rented server instances.`
                : `${baselineConfig.rentedServerCount || 0} rented server instances.`}{' '}
              {validation.isDemo
                ? 'All fields were populated via explicitly loaded demo parameters for illustrative review.'
                : 'All fields were provided directly through your configuration inputs in Step 2.'}
            </p>
          </div>

          {/* ITEM 02 — Capacity Assessment */}
          <div className="screen5-item-card">
            <div className="item-card-header">
              <span className="item-num-marker">02</span>
              <div className="item-heading-wrap">
                <h3 className="item-heading">Capacity Assessment</h3>
                <span className="item-subheading">Mathematical compute and memory comparison against workload demand</span>
              </div>
            </div>

            {/* Fact List (Description-list rows) */}
            <div className="screen5-dl-grid">
              <div className="screen5-dl-item">
                <span className="screen5-dl-label">Available CPU</span>
                <span className="screen5-dl-val teal">{baselineResult.totalAvailableCpu} vCPU</span>
              </div>
              <div className="screen5-dl-item">
                <span className="screen5-dl-label">Required CPU</span>
                <span className="screen5-dl-val">
                  {baselineResult.demandCpu !== null ? `${baselineResult.demandCpu} vCPU` : 'Unspecified'}
                </span>
              </div>
              <div className="screen5-dl-item">
                <span className="screen5-dl-label">Available RAM</span>
                <span className="screen5-dl-val blue">{baselineResult.totalAvailableRamGb} GB</span>
              </div>
              <div className="screen5-dl-item">
                <span className="screen5-dl-label">Required RAM</span>
                <span className="screen5-dl-val">
                  {baselineResult.demandRamGb !== null ? `${baselineResult.demandRamGb} GB` : 'Unspecified'}
                </span>
              </div>
              <div className="screen5-dl-item">
                <span className="screen5-dl-label">Compute Headroom / Deficit</span>
                <span className={`screen5-dl-val ${baselineResult.cpuDelta !== null && baselineResult.cpuDelta >= 0 ? 'text-positive' : 'text-negative'}`}>
                  {baselineResult.cpuDelta !== null
                    ? baselineResult.cpuDelta >= 0
                      ? `+${baselineResult.cpuDelta} vCPU Headroom`
                      : `${baselineResult.cpuDelta} vCPU Shortfall`
                    : 'Unspecified'}
                </span>
              </div>
              <div className="screen5-dl-item">
                <span className="screen5-dl-label">Capacity Fit Status</span>
                <span className={`screen5-dl-val ${verdict.badgeClass}`}>
                  {verdict.title}
                </span>
              </div>
            </div>

            <p className="screen5-item-explanation">
              {baselineResult.demandCpu !== null && baselineResult.demandRamGb !== null
                ? baselineResult.cpuShortfall || baselineResult.ramShortfall
                  ? `Supplied capacity falls short of stated demand by ${baselineResult.cpuDelta !== null && baselineResult.cpuDelta < 0 ? `${Math.abs(baselineResult.cpuDelta)} vCPU` : ''}${baselineResult.cpuDelta !== null && baselineResult.cpuDelta < 0 && baselineResult.ramDelta !== null && baselineResult.ramDelta < 0 ? ' and ' : ''}${baselineResult.ramDelta !== null && baselineResult.ramDelta < 0 ? `${Math.abs(baselineResult.ramDelta)} GB RAM` : ''}. Additional server capacity is required to prevent throttling.`
                  : `Supplied capacity comfortably accommodates peak demand with a healthy operational buffer of ${baselineResult.cpuDelta} vCPU and ${baselineResult.ramDelta} GB RAM.`
                : 'Demand values were not explicitly stated; capacity assessment is derived from your reported utilization rate of ' + (baselineResult.cpuUtilizationPct !== null ? `${baselineResult.cpuUtilizationPct}% CPU` : 'unspecified telemetry') + '.'}
            </p>
          </div>

          {/* ITEM 03 — Cost Assessment */}
          <div className="screen5-item-card">
            <div className="item-card-header">
              <span className="item-num-marker">03</span>
              <div className="item-heading-wrap">
                <h3 className="item-heading">Cost Assessment</h3>
                <span className="item-subheading">Itemized monthly expenditure run-rate and scenario variance</span>
              </div>
            </div>

            {/* Fact List (Description-list rows) */}
            <div className="screen5-dl-grid">
              <div className="screen5-dl-item">
                <span className="screen5-dl-label">Estimated Monthly Total</span>
                <span className="screen5-dl-val highlight">
                  {baselineResult.monthlyEstimatedCost !== null
                    ? `₹ ${baselineResult.monthlyEstimatedCost.toLocaleString('en-IN')}`
                    : 'Unspecified'}
                </span>
              </div>
              <div className="screen5-dl-item">
                <span className="screen5-dl-label">Cloud Server Leases</span>
                <span className="screen5-dl-val">
                  {baselineConfig.rentalCostUnknown
                    ? 'Marked Unknown by User'
                    : `₹ ${Number(Number(baselineConfig.rentedServerCount || 0) * Number(baselineConfig.monthlyRentalCostPerServer || 0)).toLocaleString('en-IN')}/mo`}
                </span>
              </div>
              {isHybrid && (
                <div className="screen5-dl-item">
                  <span className="screen5-dl-label">Local Facility Costs</span>
                  <span className="screen5-dl-val">
                    {baselineConfig.localCostUnknown
                      ? 'Marked Unknown by User'
                      : `₹ ${Number(baselineConfig.localOperatingCostMonthly || 0).toLocaleString('en-IN')}/mo`}
                  </span>
                </div>
              )}
              <div className="screen5-dl-item">
                <span className="screen5-dl-label">Variance vs Step 4 Test</span>
                <span className={`screen5-dl-val ${costDeltaAgainstTest !== null && costDeltaAgainstTest < 0 ? 'text-positive' : 'text-neutral'}`}>
                  {costDeltaAgainstTest !== null
                    ? costDeltaAgainstTest === 0
                      ? '₹ 0 (Identical Monthly Cost)'
                      : costDeltaAgainstTest < 0
                      ? `-₹ ${Math.abs(costDeltaAgainstTest).toLocaleString('en-IN')}/mo Lower than Test`
                      : `+₹ ${costDeltaAgainstTest.toLocaleString('en-IN')}/mo Higher than Test`
                    : 'No Step 4 Test Scenario Evaluated'}
                </span>
              </div>
            </div>

            <p className="screen5-item-explanation">
              Total monthly expenditure is computed deterministically by aggregating monthly cloud server rental fees (
              {baselineConfig.rentalCostUnknown ? 'unspecified' : `${baselineConfig.rentedServerCount || 0} instances × ₹${Number(baselineConfig.monthlyRentalCostPerServer || 0).toLocaleString('en-IN')}`}
              ){isHybrid && !baselineConfig.localCostUnknown ? ` and on-premise datacenter facility operating costs (₹${Number(baselineConfig.localOperatingCostMonthly || 0).toLocaleString('en-IN')})` : ''}.{' '}
              {costDeltaAgainstTest !== null && `Comparing against your Step 4 test scenario yields a monthly delta of ₹${Math.abs(costDeltaAgainstTest).toLocaleString('en-IN')}.`}
            </p>
          </div>

          {/* ITEM 04 — Constraints and Assumptions */}
          <div className="screen5-item-card">
            <div className="item-card-header">
              <span className="item-num-marker">04</span>
              <div className="item-heading-wrap">
                <h3 className="item-heading">Constraints and Assumptions</h3>
                <span className="item-subheading">Regulatory data residency, network latency, and operational boundaries</span>
              </div>
            </div>

            {/* Fact List (Description-list rows) */}
            <div className="screen5-dl-grid">
              <div className="screen5-dl-item">
                <span className="screen5-dl-label">Data Residency Policy</span>
                <span className="screen5-dl-val">
                  {baselineConfig.residencyConstraint === 'KARNATAKA_DC_ONLY'
                    ? 'Strict Karnataka DC Only (RBI Localization)'
                    : baselineConfig.residencyConstraint || 'Karnataka DC Local'}
                </span>
              </div>
              <div className="screen5-dl-item">
                <span className="screen5-dl-label">Database Co-Location</span>
                <span className="screen5-dl-val">
                  {baselineConfig.coLocationRequirement
                    ? 'Enforced (<2.0ms round-trip latency ceiling)'
                    : 'Standard Network Tolerances'}
                </span>
              </div>
              <div className="screen5-dl-item">
                <span className="screen5-dl-label">Workload Fungibility</span>
                <span className="screen5-dl-val text-amber">
                  {isHybrid
                    ? 'Non-Fungible (Local regulated workloads cannot burst to public cloud)'
                    : 'Fungible across rented cloud instances'}
                </span>
              </div>
            </div>

            {/* Bullet List for Unresolved Constraints */}
            <div className="screen5-bullets-wrapper">
              <span className="bullets-title">Key Operational Caveats:</span>
              <ul className="screen5-bullet-list">
                <li className="screen5-bullet-item">
                  <strong>Regulatory Sovereign Boundary:</strong> Regulated core banking ledgers cannot be migrated to public cloud regions outside the state boundary under current RBI data localization guidelines.
                </li>
                <li className="screen5-bullet-item">
                  <strong>Network Round-Trip Latency:</strong> Synchronous OLTP transactions between application gateways and database ledgers require sub-2ms network round-trip time.
                </li>
                <li className="screen5-bullet-item">
                  <strong>Peak Traffic Headroom:</strong> Estimates assume steady-state load; transient spikes (e.g. month-end salary processing) may require additional N+1 buffer reservations.
                </li>
              </ul>
            </div>

            <div className="screen5-disclaimer-callout">
              Notice: SkyCash provides mathematical decision-support estimates. It does not imply regulatory compliance approval or guaranteed throughput.
            </div>
          </div>

          {/* ITEM 05 — Recommended Next Action */}
          <div className="screen5-item-card highlight-action-card">
            <div className="item-card-header">
              <span className="item-num-marker action">05</span>
              <div className="item-heading-wrap">
                <h3 className="item-heading">Recommended Next Action</h3>
                <span className="item-subheading">Actionable operational guidance and verification checklist</span>
              </div>
            </div>

            {/* Fact List (Description-list rows) */}
            <div className="screen5-dl-grid">
              <div className="screen5-dl-item full-width">
                <span className="screen5-dl-label">Strategic Placement Recommendation</span>
                <span className="screen5-dl-val highlight-large">
                  {recommendedActionSummary}
                </span>
              </div>
              <div className="screen5-dl-item">
                <span className="screen5-dl-label">Decision Support Model</span>
                <span className="screen5-dl-val">Deterministic Capacity Sizing (Rule Engine v0.1)</span>
              </div>
              <div className="screen5-dl-item">
                <span className="screen5-dl-label">Audit Confidence</span>
                <span className="screen5-dl-val text-teal">Grounded in Validated User Parameters</span>
              </div>
            </div>

            {/* Verification Checklist */}
            <div className="screen5-bullets-wrapper">
              <span className="bullets-title">Verification Checklist Before Final Infrastructure Procurement:</span>
              <ul className="screen5-bullet-list">
                <li className="screen5-bullet-item">
                  <strong>1. Verify Peak IOPS and Storage Bandwidth:</strong> Conduct synthetic benchmark tests under peak transaction volumes to ensure storage tiering (NVMe/SSD) meets latency targets.
                </li>
                <li className="screen5-bullet-item">
                  <strong>2. Validate Round-Trip Network Latency:</strong> Measure physical ping and packet jitter between Karnataka DC and target cloud availability zones under simulated load.
                </li>
                <li className="screen5-bullet-item">
                  <strong>3. Obtain Compliance Audit Approval:</strong> Confirm that proposed cloud network isolation (VPC, private interconnect, customer-managed keys) satisfies internal security and legal requirements.
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Expandable Calculation Breakdown */}
        <div className="calculation-breakdown-wrapper">
          <button
            type="button"
            className="btn-toggle-breakdown"
            onClick={() => setIsBreakdownExpanded(!isBreakdownExpanded)}
            aria-expanded={isBreakdownExpanded}
          >
            <span>{isBreakdownExpanded ? '▼ Hide' : '▶ Show'} Expandable Mathematical Formulas & Arithmetic</span>
            <span className="breakdown-hint">Inspect exact equations used by CapacityEngine</span>
          </button>

          {isBreakdownExpanded && (
            <div className="breakdown-details-panel">
              <div className="breakdown-section">
                <h4>Capacity Equation</h4>
                <div className="math-block">
                  {isHybrid ? (
                    <code>
                      Total Available Compute = Local CPU ({baselineConfig.localCpuCores || 0} vCPU) + [Rented Servers ({baselineConfig.rentedServerCount || 0}) × Cores ({baselineConfig.cpuCoresPerServer || 0} vCPU)] = {baselineResult.totalAvailableCpu} vCPU
                      <br />
                      Total Available Memory = Local RAM ({baselineConfig.localRamGb || 0} GB) + [Rented Servers ({baselineConfig.rentedServerCount || 0}) × RAM ({baselineConfig.ramGbPerServer || 0} GB)] = {baselineResult.totalAvailableRamGb} GB
                    </code>
                  ) : (
                    <code>
                      Total Available Compute = Rented Servers ({baselineConfig.rentedServerCount || 0}) × Cores ({baselineConfig.cpuCoresPerServer || 0} vCPU) = {baselineResult.totalAvailableCpu} vCPU
                      <br />
                      Total Available Memory = Rented Servers ({baselineConfig.rentedServerCount || 0}) × RAM ({baselineConfig.ramGbPerServer || 0} GB) = {baselineResult.totalAvailableRamGb} GB
                    </code>
                  )}
                </div>
              </div>

              <div className="breakdown-section">
                <h4>Monthly Run-Rate Equation</h4>
                <div className="math-block">
                  <code>
                    {isHybrid ? (
                      <>
                        Monthly Cost = Local Facility (₹{Number(baselineConfig.localOperatingCostMonthly || 0).toLocaleString('en-IN')}) + [Rented Count ({baselineConfig.rentedServerCount || 0}) × Rate (₹{Number(baselineConfig.monthlyRentalCostPerServer || 0).toLocaleString('en-IN')})] = ₹{baselineResult.monthlyEstimatedCost ? baselineResult.monthlyEstimatedCost.toLocaleString('en-IN') : 'Unspecified'}
                      </>
                    ) : (
                      <>
                        Monthly Cost = Rented Count ({baselineConfig.rentedServerCount || 0}) × Rate (₹{Number(baselineConfig.monthlyRentalCostPerServer || 0).toLocaleString('en-IN')}) = ₹{baselineResult.monthlyEstimatedCost ? baselineResult.monthlyEstimatedCost.toLocaleString('en-IN') : 'Unspecified'}
                      </>
                    )}
                  </code>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 3. Final Actions Footer */}
      <footer className="screen5-footer-actions">
        <button
          type="button"
          className="btn-screen5-secondary"
          onClick={onBackToTesting}
        >
          ← Back to Testing & Comparison
        </button>
        <button
          type="button"
          className="btn-screen5-secondary"
          onClick={onBackToConfig}
        >
          ✏ Edit Configuration
        </button>
        <button
          type="button"
          className="btn-screen5-danger"
          onClick={() => setIsResetModalOpen(true)}
        >
          ↺ Start New Assessment
        </button>
      </footer>

      {/* Confirmation Modal for Resetting Assessment */}
      {isResetModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <span className="modal-warn-icon">⚠️</span>
              <h3>Start New Assessment?</h3>
            </div>
            <p className="modal-text">
              Starting a new assessment will reset your configuration inputs, comparison tests, and generated verdict.
              This action cannot be undone.
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="btn-modal-cancel"
                onClick={() => setIsResetModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-modal-confirm"
                onClick={() => {
                  setIsResetModalOpen(false);
                  onStartNewAssessment();
                }}
              >
                Yes, Start New Assessment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
