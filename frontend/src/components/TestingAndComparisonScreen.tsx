import React, { useState, useMemo } from 'react';
import { ServerConfigurationState, CapacityAnalysisResult } from '../types';
import { CapacityEngine } from '../services/capacityEngine';
import { validateConfiguration } from '../services/configurationValidator';
import { ScenarioComparison3DScene } from './3d/ScenarioComparison3DScene';
import { BackgroundCyberGrid } from './3d/BackgroundCyberGrid';
import { StepProgressIndicator } from './StepProgressIndicator';

interface TestingAndComparisonScreenProps {
  baselineConfig: ServerConfigurationState;
  baselineResult: CapacityAnalysisResult;
  selectedSetup: 'hired' | 'hybrid';
  maxUnlockedStep: number;
  onNavigateStep: (step: number) => void;
  onBackToAnalysis: () => void;
  onBackToConfig: () => void;
  onProceedToVerdict: (testScenarioConfig: ServerConfigurationState) => void;
  onLoadDemoData: () => void;
  onNavigateToInventory?: () => void;
}

export const TestingAndComparisonScreen: React.FC<TestingAndComparisonScreenProps> = ({
  baselineConfig,
  baselineResult,
  selectedSetup,
  maxUnlockedStep,
  onNavigateStep,
  onBackToAnalysis,
  onBackToConfig,
  onProceedToVerdict,
  onLoadDemoData,
  onNavigateToInventory,
}) => {
  const isHybrid = selectedSetup === 'hybrid';

  // 1. STRICT VALIDATION GATE (Mandatory check)
  const validation = useMemo(() => {
    return validateConfiguration(selectedSetup, baselineConfig);
  }, [selectedSetup, baselineConfig]);

  // Initial test scenario configuration: slightly adjusted alternative scenario
  const defaultTestScenario = useMemo<ServerConfigurationState>(() => {
    if (!validation.isValid) {
      return {};
    }
    if (isHybrid) {
      return {
        ...baselineConfig,
        rentedServerCount: Math.max(1, Number(baselineConfig.rentedServerCount || 2) + 1),
        cpuCoresPerServer: Number(baselineConfig.cpuCoresPerServer || 16),
        ramGbPerServer: Number(baselineConfig.ramGbPerServer || 64),
        monthlyRentalCostPerServer: Number(baselineConfig.monthlyRentalCostPerServer || 14500),
        localCpuCores: Number(baselineConfig.localCpuCores || 64),
        localRamGb: Number(baselineConfig.localRamGb || 256),
        localOperatingCostMonthly: Number(baselineConfig.localOperatingCostMonthly || 35000),
      };
    } else {
      return {
        ...baselineConfig,
        rentedServerCount: Math.max(1, Number(baselineConfig.rentedServerCount || 4) - 1),
        cpuCoresPerServer: Number(baselineConfig.cpuCoresPerServer || 16),
        ramGbPerServer: Number(baselineConfig.ramGbPerServer || 64),
        monthlyRentalCostPerServer: Number(baselineConfig.monthlyRentalCostPerServer || 16000),
      };
    }
  }, [isHybrid, baselineConfig, validation.isValid]);

  // State for the test scenario being evaluated
  const [testConfig, setTestConfig] = useState<ServerConfigurationState>(defaultTestScenario);
  const [scenarioName, setScenarioName] = useState<string>('What-If Scenario: Alternative Sizing Test');
  const [isComparing, setIsComparing] = useState<boolean>(true);

  // Recalculate test scenario results using existing deterministic CapacityEngine
  const testResult = useMemo(() => {
    if (!validation.isValid) return null;
    return CapacityEngine.evaluate(selectedSetup, testConfig);
  }, [selectedSetup, testConfig, validation.isValid]);

  // Update a test scenario field
  const updateTestField = (field: keyof ServerConfigurationState, val: number | string) => {
    setTestConfig((prev) => ({
      ...prev,
      [field]: val === '' ? '' : Number(val),
    }));
  };

  // Reset test scenario to default alternative
  const handleResetTestScenario = () => {
    setTestConfig(defaultTestScenario);
    setScenarioName('What-If Scenario: Alternative Sizing Test');
  };

  // Cost variance calculations (Test vs Baseline)
  const costDiff = useMemo(() => {
    if (
      !testResult ||
      baselineResult.monthlyEstimatedCost === null ||
      testResult.monthlyEstimatedCost === null
    ) {
      return null;
    }
    return testResult.monthlyEstimatedCost - baselineResult.monthlyEstimatedCost;
  }, [baselineResult.monthlyEstimatedCost, testResult]);

  // Capacity differences
  const cpuDiff = testResult
    ? testResult.totalAvailableCpu - baselineResult.totalAvailableCpu
    : 0;
  const ramDiff = testResult
    ? testResult.totalAvailableRamGb - baselineResult.totalAvailableRamGb
    : 0;

  // Render STRICT VALIDATION GATE LOCKED STATE if configuration is incomplete
  if (!validation.isValid) {
    return (
      <div className="trends-page-container">
        <BackgroundCyberGrid />

        {/* 5-Step Progress Stepper */}
        <StepProgressIndicator
          currentStep={4}
          maxUnlockedStep={maxUnlockedStep}
          onNavigateStep={onNavigateStep}
        />

        <div className="validation-gate-container">
          <div className="gate-locked-card">
            <div className="gate-icon-pulse">
              <span className="gate-lock-icon">🔒</span>
            </div>

            <div className="gate-status-badge">PREREQUISITE REQUIRED</div>

            <h1 className="gate-title">Configuration Incomplete — Testing & Comparison Locked</h1>
            <p className="gate-subtitle">
              Step 4 requires a completed server configuration or explicitly loaded illustrative demo data
              from Step 2 to run scenario tests. No arbitrary or fabricated values will be displayed.
            </p>

            <div className="missing-fields-box">
              <div className="missing-box-header">
                <span className="missing-alert-dot"></span>
                <strong>Identified Missing Required Configuration Fields ({validation.missingFields.length})</strong>
              </div>
              <ul className="missing-fields-list">
                {validation.missingFields.map((field, idx) => (
                  <li key={idx} className="missing-field-item">
                    <span className="field-bullet">✕</span>
                    <span className="field-name">{field}</span>
                    <span className="field-req">Required for capacity calculation</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="gate-actions-row">
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
                title="Populate Step 2 with clearly labeled illustrative demo parameters"
              >
                ✨ Load Illustrative Demo Data
              </button>
            </div>

            <div className="gate-notice-footer">
              SkyCash enforces strict local data integrity. Unknown values are never assumed to be zero.
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Calculate percentages for capacity comparison bars
  const maxCpuForBar = Math.max(
    baselineResult.totalAvailableCpu,
    testResult ? testResult.totalAvailableCpu : 0,
    baselineResult.demandCpu || 0,
    1
  );
  const baselineCpuPercent = Math.min(100, Math.round((baselineResult.totalAvailableCpu / maxCpuForBar) * 100));
  const testCpuPercent = testResult
    ? Math.min(100, Math.round((testResult.totalAvailableCpu / maxCpuForBar) * 100))
    : 0;

  const maxRamForBar = Math.max(
    baselineResult.totalAvailableRamGb,
    testResult ? testResult.totalAvailableRamGb : 0,
    baselineResult.demandRamGb || 0,
    1
  );
  const baselineRamPercent = Math.min(100, Math.round((baselineResult.totalAvailableRamGb / maxRamForBar) * 100));
  const testRamPercent = testResult
    ? Math.min(100, Math.round((testResult.totalAvailableRamGb / maxRamForBar) * 100))
    : 0;

  // --- UNLOCKED STEP 4 ENTERPRISE CONSOLE ---
  return (
    <div className="trends-page-container screen4-container">
      <BackgroundCyberGrid />

      {/* 5-Step Progress Stepper */}
      <StepProgressIndicator
        currentStep={4}
        maxUnlockedStep={maxUnlockedStep}
        onNavigateStep={onNavigateStep}
      />

      {/* 1. Page Header */}
      <header className="screen4-header">
        <div className="screen4-header-main">
          <div className="screen4-badge-row">
            <span className="screen4-step-pill">Step 4 of 5 — Testing & Comparison</span>
            <span className="screen4-arch-badge">
              {isHybrid ? 'OPTION B · HYBRID SETUP' : 'OPTION A · HIRED FLEET'}
            </span>
            {validation.isDemo && (
              <span className="screen4-demo-pill">Illustrative Demo Data</span>
            )}
          </div>
          <h1 className="screen4-title">Test Your Infrastructure Scenario</h1>
          <p className="screen4-subtitle">
            Adjust an alternative configuration and compare capacity and cost against your baseline before making a decision.
          </p>
        </div>

        <div className="screen4-header-nav-actions">
          {onNavigateToInventory && (
            <button
              type="button"
              className="btn-screen4-secondary"
              onClick={onNavigateToInventory}
              title="Inspect workload inventory and placement details"
            >
              📊 Workload Inventory
            </button>
          )}
          <button
            type="button"
            className="btn-screen4-secondary"
            onClick={onBackToAnalysis}
            title="Return to Step 3 Capacity Analysis"
          >
            ← Back to Analysis
          </button>
          <button
            type="button"
            className="btn-screen4-proceed"
            onClick={() => onProceedToVerdict(testConfig)}
          >
            <span>Proceed to Final Verdict</span>
            <span className="btn-arrow">→</span>
          </button>
        </div>
      </header>

      {/* 2. Interactive 3D Comparison Viewport */}
      <section className="screen4-viewport-section">
        <div className="screen4-section-header">
          <div className="screen4-section-title-wrap">
            <span className="screen4-section-tag">Interactive Simulation Visualizer</span>
            <h2 className="screen4-section-heading">Live 3D Infrastructure Sizing Comparison</h2>
          </div>
          <div className="screen4-legend-chips">
            <span className="legend-chip baseline">Baseline Rack (Left)</span>
            <span className="legend-chip test">Test Scenario Rack (Right)</span>
            {baselineResult.demandCpu !== null && (
              <span className="legend-chip demand">Holographic Demand Target</span>
            )}
          </div>
        </div>

        <div className="screen4-3d-box">
          <ScenarioComparison3DScene
            baselineCpu={baselineResult.totalAvailableCpu}
            baselineRam={baselineResult.totalAvailableRamGb}
            baselineCost={baselineResult.monthlyEstimatedCost}
            scenarioCpu={testResult ? testResult.totalAvailableCpu : baselineResult.totalAvailableCpu}
            scenarioRam={testResult ? testResult.totalAvailableRamGb : baselineResult.totalAvailableRamGb}
            scenarioCost={testResult ? testResult.monthlyEstimatedCost : baselineResult.monthlyEstimatedCost}
            demandCpu={baselineResult.demandCpu}
            demandRam={baselineResult.demandRamGb}
          />
          <div className="screen4-3d-overlay-hint">
            <span>⟲ Drag cursor to rotate and observe real-time chassis height changes</span>
          </div>
        </div>
      </section>

      {/* 3. Grouped Adjustment Controls Grid */}
      <section className="screen4-controls-section">
        <div className="screen4-section-header">
          <div className="screen4-section-title-wrap">
            <span className="screen4-section-tag">Scenario Parameters</span>
            <h2 className="screen4-section-heading">Adjust Infrastructure Test Assumptions</h2>
          </div>
          <div className="screen4-actions-bar">
            <button
              type="button"
              className={`btn-screen4-action ${isComparing ? 'active' : ''}`}
              onClick={() => setIsComparing(!isComparing)}
              title="Toggle scenario comparison view"
            >
              {isComparing ? '✓ Comparing Scenarios' : 'Compare Scenarios'}
            </button>
            <button
              type="button"
              className="btn-screen4-action secondary"
              onClick={handleResetTestScenario}
              title="Reset test scenario assumptions"
            >
              ↺ Reset Test Scenario
            </button>
            <button
              type="button"
              className="btn-screen4-action secondary"
              onClick={onBackToConfig}
              title="Edit original baseline inputs in Step 2"
            >
              ✏ Edit Baseline (Step 2)
            </button>
          </div>
        </div>

        {/* 4 Grouped Cards Grid */}
        <div className="screen4-cards-grid">
          {/* CARD A — Scenario Configuration */}
          <div className="screen4-card card-scenario-meta">
            <div className="screen4-card-header">
              <span className="card-badge meta">Card A</span>
              <h3 className="card-title">Scenario Configuration</h3>
            </div>
            <p className="card-description">
              Changes made here affect this test scenario only. Your saved baseline configuration remains unchanged.
            </p>

            <div className="screen4-fields-col">
              <div className="screen4-form-group">
                <label htmlFor="screen4-scenario-name" className="screen4-label">
                  Scenario Identifier
                </label>
                <input
                  id="screen4-scenario-name"
                  type="text"
                  value={scenarioName}
                  onChange={(e) => setScenarioName(e.target.value)}
                  className="screen4-input text"
                  placeholder="e.g. Alternative Sizing Test"
                />
                <span className="screen4-help-text">Descriptive label for this what-if scenario.</span>
              </div>

              <div className="scenario-distinction-box">
                <div className="distinction-row">
                  <span className="distinction-tag baseline">Baseline</span>
                  <span className="distinction-val">
                    {isHybrid ? 'Saved Hybrid Setup' : 'Saved Hired Fleet'}
                  </span>
                </div>
                <div className="distinction-row">
                  <span className="distinction-tag test">Test Scenario</span>
                  <span className="distinction-val">Interactive What-If Model</span>
                </div>
              </div>
            </div>
          </div>

          {/* CARD B — Rented Server Capacity */}
          <div className="screen4-card card-rented">
            <div className="screen4-card-header">
              <span className="card-badge rented">Card B</span>
              <h3 className="card-title">Rented Server Capacity</h3>
            </div>
            <p className="card-description">
              Simulate resizing or scaling your rented cloud server fleet.
            </p>

            <div className="screen4-fields-grid-2col">
              {/* Rented Server Count */}
              <div className="screen4-form-group">
                <div className="screen4-label-row">
                  <label htmlFor="test-server-count" className="screen4-label">
                    Rented Server Count
                  </label>
                  <span className="screen4-value-badge">{testConfig.rentedServerCount || 1} servers</span>
                </div>
                <div className="screen4-input-wrap">
                  <input
                    id="test-server-count"
                    type="number"
                    min="1"
                    max="32"
                    value={testConfig.rentedServerCount || 1}
                    onChange={(e) => updateTestField('rentedServerCount', e.target.value)}
                    className="screen4-input"
                  />
                  <span className="screen4-unit-affix">servers</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="16"
                  step="1"
                  value={testConfig.rentedServerCount || 1}
                  onChange={(e) => updateTestField('rentedServerCount', e.target.value)}
                  className="screen4-slider"
                  aria-label="Slider for rented server count"
                />
                <span className="screen4-help-text">Number of leased cloud instances.</span>
              </div>

              {/* CPU Cores per Server */}
              <div className="screen4-form-group">
                <div className="screen4-label-row">
                  <label htmlFor="test-cpu-cores" className="screen4-label">
                    CPU Cores per Server
                  </label>
                  <span className="screen4-value-badge">{testConfig.cpuCoresPerServer || 8} vCPU</span>
                </div>
                <div className="screen4-input-wrap">
                  <input
                    id="test-cpu-cores"
                    type="number"
                    min="2"
                    max="128"
                    value={testConfig.cpuCoresPerServer || 8}
                    onChange={(e) => updateTestField('cpuCoresPerServer', e.target.value)}
                    className="screen4-input"
                  />
                  <span className="screen4-unit-affix">vCPU</span>
                </div>
                <input
                  type="range"
                  min="4"
                  max="64"
                  step="4"
                  value={testConfig.cpuCoresPerServer || 8}
                  onChange={(e) => updateTestField('cpuCoresPerServer', e.target.value)}
                  className="screen4-slider"
                  aria-label="Slider for CPU cores per server"
                />
                <span className="screen4-help-text">Processor cores on each instance.</span>
              </div>

              {/* RAM per Server */}
              <div className="screen4-form-group">
                <div className="screen4-label-row">
                  <label htmlFor="test-ram-gb" className="screen4-label">
                    RAM per Server
                  </label>
                  <span className="screen4-value-badge">{testConfig.ramGbPerServer || 32} GB</span>
                </div>
                <div className="screen4-input-wrap">
                  <input
                    id="test-ram-gb"
                    type="number"
                    min="8"
                    max="512"
                    value={testConfig.ramGbPerServer || 32}
                    onChange={(e) => updateTestField('ramGbPerServer', e.target.value)}
                    className="screen4-input"
                  />
                  <span className="screen4-unit-affix">GB</span>
                </div>
                <input
                  type="range"
                  min="16"
                  max="256"
                  step="16"
                  value={testConfig.ramGbPerServer || 32}
                  onChange={(e) => updateTestField('ramGbPerServer', e.target.value)}
                  className="screen4-slider"
                  aria-label="Slider for RAM per server"
                />
                <span className="screen4-help-text">System memory on each instance.</span>
              </div>

              {/* Monthly Rental Cost per Server */}
              <div className="screen4-form-group">
                <div className="screen4-label-row">
                  <label htmlFor="test-rental-cost" className="screen4-label">
                    Rental Cost per Server
                  </label>
                  <span className="screen4-value-badge">
                    ₹ {Number(testConfig.monthlyRentalCostPerServer || 0).toLocaleString('en-IN')}/mo
                  </span>
                </div>
                <div className="screen4-input-wrap">
                  <input
                    id="test-rental-cost"
                    type="number"
                    min="1000"
                    max="100000"
                    step="500"
                    value={testConfig.monthlyRentalCostPerServer || 10000}
                    onChange={(e) => updateTestField('monthlyRentalCostPerServer', e.target.value)}
                    className="screen4-input"
                  />
                  <span className="screen4-unit-affix">₹/month</span>
                </div>
                <input
                  type="range"
                  min="5000"
                  max="60000"
                  step="1000"
                  value={testConfig.monthlyRentalCostPerServer || 10000}
                  onChange={(e) => updateTestField('monthlyRentalCostPerServer', e.target.value)}
                  className="screen4-slider"
                  aria-label="Slider for monthly rental cost"
                />
                <span className="screen4-help-text">Monthly cloud provider lease fee.</span>
              </div>
            </div>
          </div>

          {/* CARD C — Local Infrastructure (Only for Hybrid Setup) */}
          {isHybrid && (
            <div className="screen4-card card-local">
              <div className="screen4-card-header">
                <span className="card-badge local">Card C</span>
                <h3 className="card-title">Local Infrastructure</h3>
              </div>
              <p className="card-description">
                Simulate changes to on-premises Karnataka DC physical server capacity.
              </p>

              <div className="screen4-fields-grid-2col">
                {/* Local CPU Cores */}
                <div className="screen4-form-group">
                  <div className="screen4-label-row">
                    <label htmlFor="test-local-cpu" className="screen4-label">
                      Local CPU Cores
                    </label>
                    <span className="screen4-value-badge">{testConfig.localCpuCores || 64} vCPU</span>
                  </div>
                  <div className="screen4-input-wrap">
                    <input
                      id="test-local-cpu"
                      type="number"
                      min="8"
                      max="256"
                      value={testConfig.localCpuCores || 64}
                      onChange={(e) => updateTestField('localCpuCores', e.target.value)}
                      className="screen4-input"
                    />
                    <span className="screen4-unit-affix">vCPU</span>
                  </div>
                  <input
                    type="range"
                    min="16"
                    max="128"
                    step="8"
                    value={testConfig.localCpuCores || 64}
                    onChange={(e) => updateTestField('localCpuCores', e.target.value)}
                    className="screen4-slider"
                    aria-label="Slider for local CPU cores"
                  />
                  <span className="screen4-help-text">Karnataka DC on-premise cores.</span>
                </div>

                {/* Local RAM */}
                <div className="screen4-form-group">
                  <div className="screen4-label-row">
                    <label htmlFor="test-local-ram" className="screen4-label">
                      Local RAM
                    </label>
                    <span className="screen4-value-badge">{testConfig.localRamGb || 256} GB</span>
                  </div>
                  <div className="screen4-input-wrap">
                    <input
                      id="test-local-ram"
                      type="number"
                      min="16"
                      max="1024"
                      value={testConfig.localRamGb || 256}
                      onChange={(e) => updateTestField('localRamGb', e.target.value)}
                      className="screen4-input"
                    />
                    <span className="screen4-unit-affix">GB</span>
                  </div>
                  <input
                    type="range"
                    min="64"
                    max="512"
                    step="32"
                    value={testConfig.localRamGb || 256}
                    onChange={(e) => updateTestField('localRamGb', e.target.value)}
                    className="screen4-slider"
                    aria-label="Slider for local RAM"
                  />
                  <span className="screen4-help-text">Karnataka DC memory capacity.</span>
                </div>

                {/* Local Operating Cost */}
                <div className="screen4-form-group" style={{ gridColumn: 'span 2' }}>
                  <div className="screen4-label-row">
                    <label htmlFor="test-local-cost" className="screen4-label">
                      Known Local Operating Cost
                    </label>
                    <span className="screen4-value-badge">
                      ₹ {Number(testConfig.localOperatingCostMonthly || 0).toLocaleString('en-IN')}/mo
                    </span>
                  </div>
                  <div className="screen4-input-wrap">
                    <input
                      id="test-local-cost"
                      type="number"
                      min="5000"
                      max="200000"
                      step="2500"
                      value={testConfig.localOperatingCostMonthly || 35000}
                      onChange={(e) => updateTestField('localOperatingCostMonthly', e.target.value)}
                      className="screen4-input"
                    />
                    <span className="screen4-unit-affix">₹/month</span>
                  </div>
                  <input
                    type="range"
                    min="10000"
                    max="100000"
                    step="2500"
                    value={testConfig.localOperatingCostMonthly || 35000}
                    onChange={(e) => updateTestField('localOperatingCostMonthly', e.target.value)}
                    className="screen4-slider"
                    aria-label="Slider for local operating cost"
                  />
                  <span className="screen4-help-text">Amortized power, cooling, and facility expenses.</span>
                </div>
              </div>
            </div>
          )}

          {/* CARD D — Workload Demand (Read-only Reference Card) */}
          <div className="screen4-card card-demand-ref">
            <div className="screen4-card-header">
              <span className="card-badge demand">Card D</span>
              <h3 className="card-title">Workload Demand Reference</h3>
            </div>
            <p className="card-description">
              Configured target demand parameters serve as the fixed benchmark for both scenarios.
            </p>

            <div className="screen4-demand-ref-list">
              <div className="demand-ref-row">
                <span className="ref-label">Target Compute Demand:</span>
                <strong className="ref-value teal">
                  {baselineResult.demandCpu !== null ? `${baselineResult.demandCpu} vCPU` : 'Unspecified'}
                </strong>
              </div>
              <div className="demand-ref-row">
                <span className="ref-label">Target Memory Demand:</span>
                <strong className="ref-value blue">
                  {baselineResult.demandRamGb !== null ? `${baselineResult.demandRamGb} GB` : 'Unspecified'}
                </strong>
              </div>
              <div className="demand-ref-row">
                <span className="ref-label">Residency Policy:</span>
                <span className="ref-badge">
                  {baselineConfig.residencyConstraint || 'KARNATAKA_DC_ONLY'}
                </span>
              </div>
              <div className="demand-ref-row">
                <span className="ref-label">Database Co-Location:</span>
                <span className="ref-badge">
                  {baselineConfig.coLocationRequirement ? 'Enforced (<2ms latency)' : 'Standard'}
                </span>
              </div>
            </div>

            <div className="demand-ref-note">
              To edit workload demand targets, return to Step 2 Server Configuration.
            </div>
          </div>
        </div>
      </section>

      {/* 4. Comparison Results Panel */}
      {isComparing && testResult && (
        <section className="screen4-results-section">
          <div className="screen4-section-header">
            <div className="screen4-section-title-wrap">
              <span className="screen4-section-tag">Calculated Variance</span>
              <h2 className="screen4-section-heading">Baseline vs Test Scenario Comparison Results</h2>
            </div>
            <span className={`screen4-verdict-chip ${testResult.classification.toLowerCase()}`}>
              Test Fit: {testResult.classificationLabel}
            </span>
          </div>

          {/* Compact Comparison Cards Grid */}
          <div className="screen4-comparison-cards-grid">
            {/* Card 1: Monthly Cost Difference */}
            <div className="screen4-stat-card">
              <span className="stat-card-label">Monthly Cost Difference</span>
              <div className="stat-card-main-val">
                {costDiff !== null ? (
                  costDiff === 0 ? (
                    <span className="text-neutral">₹ 0 (Identical)</span>
                  ) : costDiff < 0 ? (
                    <span className="text-positive">-₹ {Math.abs(costDiff).toLocaleString('en-IN')}/mo</span>
                  ) : (
                    <span className="text-negative">+₹ {costDiff.toLocaleString('en-IN')}/mo</span>
                  )
                ) : (
                  <span className="text-neutral">Cost Unspecified</span>
                )}
              </div>
              <div className="stat-card-details">
                <span>Baseline: {baselineResult.monthlyEstimatedCost !== null ? `₹${baselineResult.monthlyEstimatedCost.toLocaleString('en-IN')}` : 'Unspecified'}</span>
                <span> → Test: {testResult.monthlyEstimatedCost !== null ? `₹${testResult.monthlyEstimatedCost.toLocaleString('en-IN')}` : 'Unspecified'}</span>
              </div>
            </div>

            {/* Card 2: CPU Capacity Comparison */}
            <div className="screen4-stat-card">
              <span className="stat-card-label">CPU Capacity Comparison</span>
              <div className="stat-card-main-val">
                {cpuDiff === 0 ? (
                  <span className="text-neutral">No Change ({testResult.totalAvailableCpu} vCPU)</span>
                ) : cpuDiff > 0 ? (
                  <span className="text-positive">+{cpuDiff} vCPU Headroom</span>
                ) : (
                  <span className="text-negative">{cpuDiff} vCPU Reduction</span>
                )}
              </div>
              {/* Visual CPU Progress Bar */}
              <div className="stat-card-bar-wrap">
                <div className="bar-track">
                  <div
                    className="bar-fill baseline"
                    style={{ width: `${baselineCpuPercent}%` }}
                    title={`Baseline: ${baselineResult.totalAvailableCpu} vCPU`}
                  />
                  <div
                    className="bar-fill test"
                    style={{ width: `${testCpuPercent}%` }}
                    title={`Test Scenario: ${testResult.totalAvailableCpu} vCPU`}
                  />
                </div>
                <div className="bar-labels">
                  <span>Base: {baselineResult.totalAvailableCpu}c</span>
                  <span>Test: {testResult.totalAvailableCpu}c</span>
                </div>
              </div>
            </div>

            {/* Card 3: RAM Capacity Comparison */}
            <div className="screen4-stat-card">
              <span className="stat-card-label">RAM Capacity Comparison</span>
              <div className="stat-card-main-val">
                {ramDiff === 0 ? (
                  <span className="text-neutral">No Change ({testResult.totalAvailableRamGb} GB)</span>
                ) : ramDiff > 0 ? (
                  <span className="text-positive">+{ramDiff} GB Headroom</span>
                ) : (
                  <span className="text-negative">{ramDiff} GB Reduction</span>
                )}
              </div>
              {/* Visual RAM Progress Bar */}
              <div className="stat-card-bar-wrap">
                <div className="bar-track">
                  <div
                    className="bar-fill baseline"
                    style={{ width: `${baselineRamPercent}%` }}
                    title={`Baseline: ${baselineResult.totalAvailableRamGb} GB`}
                  />
                  <div
                    className="bar-fill test"
                    style={{ width: `${testRamPercent}%` }}
                    title={`Test Scenario: ${testResult.totalAvailableRamGb} GB`}
                  />
                </div>
                <div className="bar-labels">
                  <span>Base: {baselineResult.totalAvailableRamGb} GB</span>
                  <span>Test: {testResult.totalAvailableRamGb} GB</span>
                </div>
              </div>
            </div>

            {/* Card 4: Sizing & Capacity Status */}
            <div className="screen4-stat-card">
              <span className="stat-card-label">Test Scenario Capacity Fit</span>
              <div className="stat-card-main-val">
                <span className={`status-pill ${testResult.classification.toLowerCase()}`}>
                  {testResult.classificationLabel}
                </span>
              </div>
              <p className="stat-card-note">
                {testResult.cpuDelta !== null
                  ? testResult.cpuDelta >= 0
                    ? `Provides +${testResult.cpuDelta} cores headroom beyond stated demand.`
                    : `Exhibits ${testResult.cpuDelta} cores shortfall against stated demand.`
                  : 'Derived from reported average utilization metrics.'}
              </p>
            </div>
          </div>

          {/* Side-by-Side Detailed Specification Matrix */}
          <div className="screen4-matrix-box">
            <div className="matrix-title">Detailed Specification Breakdown</div>
            <div className="matrix-table-wrap">
              <table className="screen4-table">
                <thead>
                  <tr>
                    <th>Metric Specification</th>
                    <th>Configured Baseline</th>
                    <th>Test Scenario Variation</th>
                    <th>Calculated Variance</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Total Available Compute</td>
                    <td>{baselineResult.totalAvailableCpu} vCPU</td>
                    <td className="highlight-test">{testResult.totalAvailableCpu} vCPU</td>
                    <td className={cpuDiff >= 0 ? 'text-positive' : 'text-negative'}>
                      {cpuDiff >= 0 ? `+${cpuDiff}` : cpuDiff} vCPU
                    </td>
                  </tr>
                  <tr>
                    <td>Total Available Memory</td>
                    <td>{baselineResult.totalAvailableRamGb} GB</td>
                    <td className="highlight-test">{testResult.totalAvailableRamGb} GB</td>
                    <td className={ramDiff >= 0 ? 'text-positive' : 'text-negative'}>
                      {ramDiff >= 0 ? `+${ramDiff}` : ramDiff} GB
                    </td>
                  </tr>
                  <tr>
                    <td>Rented Cloud Servers</td>
                    <td>{baselineConfig.rentedServerCount || 0} instances</td>
                    <td className="highlight-test">{testConfig.rentedServerCount || 1} instances</td>
                    <td>
                      {Number(testConfig.rentedServerCount || 1) - Number(baselineConfig.rentedServerCount || 0) >= 0 ? '+' : ''}
                      {Number(testConfig.rentedServerCount || 1) - Number(baselineConfig.rentedServerCount || 0)} instances
                    </td>
                  </tr>
                  {isHybrid && (
                    <tr>
                      <td>Local Datacenter Compute</td>
                      <td>{baselineConfig.localCpuCores || 0} vCPU</td>
                      <td className="highlight-test">{testConfig.localCpuCores || 0} vCPU</td>
                      <td>
                        {Number(testConfig.localCpuCores || 0) - Number(baselineConfig.localCpuCores || 0) >= 0 ? '+' : ''}
                        {Number(testConfig.localCpuCores || 0) - Number(baselineConfig.localCpuCores || 0)} vCPU
                      </td>
                    </tr>
                  )}
                  <tr>
                    <td>Estimated Monthly Spend</td>
                    <td>
                      {baselineResult.monthlyEstimatedCost !== null
                        ? `₹ ${baselineResult.monthlyEstimatedCost.toLocaleString('en-IN')}`
                        : 'Unspecified'}
                    </td>
                    <td className="highlight-test">
                      {testResult.monthlyEstimatedCost !== null
                        ? `₹ ${testResult.monthlyEstimatedCost.toLocaleString('en-IN')}`
                        : 'Unspecified'}
                    </td>
                    <td className={costDiff !== null && costDiff <= 0 ? 'text-positive' : 'text-negative'}>
                      {costDiff !== null
                        ? `${costDiff >= 0 ? '+' : ''}₹ ${costDiff.toLocaleString('en-IN')}/mo`
                        : 'Unspecified'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="matrix-explanation-callout">
              {cpuDiff > 0
                ? `The test scenario scales available compute by +${cpuDiff} vCPU and +${ramDiff} GB memory${
                    costDiff !== null
                      ? ` with a projected monthly budget delta of ${costDiff >= 0 ? `+₹${costDiff.toLocaleString('en-IN')}` : `-₹${Math.abs(costDiff).toLocaleString('en-IN')}`}`
                      : ''
                  }.`
                : cpuDiff < 0
                ? `The test scenario scales down compute by ${Math.abs(cpuDiff)} vCPU${
                    costDiff !== null && costDiff < 0
                      ? `, lowering monthly spend by ₹${Math.abs(costDiff).toLocaleString('en-IN')}`
                      : ''
                  }.`
                : 'The test scenario maintains identical compute capacity to your configured baseline.'}
            </div>
          </div>

          {/* Bottom Action Footer */}
          <div className="screen4-footer-action-bar">
            <button
              type="button"
              className="btn-screen4-secondary"
              onClick={onBackToAnalysis}
            >
              ← Back to Capacity Analysis
            </button>
            <button
              type="button"
              className="btn-screen4-proceed large"
              onClick={() => onProceedToVerdict(testConfig)}
            >
              <span>Proceed to Step 5: SkyCash Final Verdict</span>
              <span className="btn-arrow">→</span>
            </button>
          </div>
        </section>
      )}
    </div>
  );
};
