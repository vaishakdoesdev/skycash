import React, { useState, useMemo } from 'react';
import { ServerConfigurationState, CapacityAnalysisResult } from '../types';
import { CapacityEngine } from '../services/capacityEngine';
import { ScenarioComparison3DScene } from './3d/ScenarioComparison3DScene';
import { BackgroundCyberGrid } from './3d/BackgroundCyberGrid';

interface TrendsAndComparisonScreenProps {
  baselineConfig: ServerConfigurationState;
  baselineResult: CapacityAnalysisResult;
  selectedSetup: 'hired' | 'hybrid';
  onBackToAnalysis: () => void;
  onNavigateToInventory: () => void;
  onBackToConfig: () => void;
}

export const TrendsAndComparisonScreen: React.FC<TrendsAndComparisonScreenProps> = ({
  baselineConfig,
  baselineResult,
  selectedSetup,
  onBackToAnalysis,
  onNavigateToInventory,
  onBackToConfig,
}) => {
  const isHybrid = selectedSetup === 'hybrid';

  // Alternative What-If Scenario State (strictly isolated from user's saved configuration)
  const [whatIfConfig, setWhatIfConfig] = useState<ServerConfigurationState>(() => {
    if (isHybrid) {
      // In hybrid mode, alternative explores pure hired cloud baseline vs hybrid
      return {
        ...baselineConfig,
        rentedServerCount: Number(baselineConfig.rentedServerCount || 2) + 1,
        cpuCoresPerServer: Number(baselineConfig.cpuCoresPerServer || 16),
        ramGbPerServer: Number(baselineConfig.ramGbPerServer || 64),
        monthlyRentalCostPerServer: Number(baselineConfig.monthlyRentalCostPerServer || 14500),
        localOperatingCostMonthly: Number(baselineConfig.localOperatingCostMonthly || 35000),
      };
    } else {
      // In hired mode, alternative explores an expanded or scaled fleet
      return {
        ...baselineConfig,
        rentedServerCount: Math.max(1, Number(baselineConfig.rentedServerCount || 4) - 1),
        cpuCoresPerServer: Number(baselineConfig.cpuCoresPerServer || 16),
        ramGbPerServer: Number(baselineConfig.ramGbPerServer || 64),
        monthlyRentalCostPerServer: Number(baselineConfig.monthlyRentalCostPerServer || 16000),
      };
    }
  });

  const [activeTab, setActiveTab] = useState<'comparison' | 'scenario'>('comparison');

  // Compute what-if scenario result dynamically
  const scenarioResult = useMemo(() => {
    return CapacityEngine.evaluate(selectedSetup, whatIfConfig);
  }, [selectedSetup, whatIfConfig]);

  // Reset scenario to baseline defaults
  const handleResetScenario = () => {
    if (isHybrid) {
      setWhatIfConfig({
        ...baselineConfig,
        rentedServerCount: Number(baselineConfig.rentedServerCount || 2) + 1,
        cpuCoresPerServer: Number(baselineConfig.cpuCoresPerServer || 16),
        ramGbPerServer: Number(baselineConfig.ramGbPerServer || 64),
        monthlyRentalCostPerServer: Number(baselineConfig.monthlyRentalCostPerServer || 14500),
        localOperatingCostMonthly: Number(baselineConfig.localOperatingCostMonthly || 35000),
      });
    } else {
      setWhatIfConfig({
        ...baselineConfig,
        rentedServerCount: Math.max(1, Number(baselineConfig.rentedServerCount || 4) - 1),
        cpuCoresPerServer: Number(baselineConfig.cpuCoresPerServer || 16),
        ramGbPerServer: Number(baselineConfig.ramGbPerServer || 64),
        monthlyRentalCostPerServer: Number(baselineConfig.monthlyRentalCostPerServer || 16000),
      });
    }
  };

  // Cost variance calculations (Baseline vs Alternative Scenario)
  const costDiff = useMemo(() => {
    if (baselineResult.monthlyEstimatedCost === null || scenarioResult.monthlyEstimatedCost === null) {
      return null;
    }
    return scenarioResult.monthlyEstimatedCost - baselineResult.monthlyEstimatedCost;
  }, [baselineResult.monthlyEstimatedCost, scenarioResult.monthlyEstimatedCost]);

  // Compute CPU and RAM deltas
  const cpuDiff = scenarioResult.totalAvailableCpu - baselineResult.totalAvailableCpu;
  const ramDiff = scenarioResult.totalAvailableRamGb - baselineResult.totalAvailableRamGb;

  // Sizing suitability check
  const demandCpu = baselineResult.demandCpu;
  const baselineMeetsDemand = demandCpu !== null ? baselineResult.totalAvailableCpu >= demandCpu : null;
  const scenarioMeetsDemand = demandCpu !== null ? scenarioResult.totalAvailableCpu >= demandCpu : null;

  return (
    <div className="trends-page-container">
      <BackgroundCyberGrid />

      {/* Progress Navigation Stepper */}
      <nav className="trends-stepper-header">
        <div className="trends-stepper-track">
          <button
            type="button"
            className="stepper-step completed"
            onClick={onBackToConfig}
            title="Return to Server Configuration"
          >
            <span className="step-icon">✓</span>
            <span className="step-text">2. Configuration</span>
          </button>
          <div className="step-connector active" />
          <button
            type="button"
            className="stepper-step completed"
            onClick={onBackToAnalysis}
            title="Return to Capacity Analysis"
          >
            <span className="step-icon">✓</span>
            <span className="step-text">3. Analysis</span>
          </button>
          <div className="step-connector active" />
          <div className="stepper-step active">
            <span className="step-icon">4</span>
            <span className="step-text">4. Trends & Comparison</span>
          </div>
        </div>
      </nav>

      {/* Top Banner Navigation & Context */}
      <header className="trends-hero-banner">
        <div className="trends-hero-left">
          <div className="trends-tag-row">
            <span className="trends-arch-tag">
              {isHybrid ? 'OPTION B · HYBRID PLACEMENT' : 'OPTION A · HIRED CLOUD'}
            </span>
            <span className="trends-status-tag">Scenario Comparison Engine</span>
          </div>
          <h1 className="trends-heading">Trends & Infrastructure Comparison</h1>
          <p className="trends-subtitle">
            Evaluate cost and capacity trade-offs between your configured infrastructure baseline and
            hypothetical scenario variations.
          </p>
        </div>

        <div className="trends-hero-actions">
          <button type="button" className="btn-action secondary" onClick={onNavigateToInventory}>
            📊 View Workload Inventory
          </button>
          <button type="button" className="btn-action primary" onClick={onBackToAnalysis}>
            ← Back to Analysis
          </button>
        </div>
      </header>

      {/* 1. Summary Section: Baseline Configuration */}
      <section className="trends-section-block">
        <div className="section-title-row">
          <h2 className="section-title">1. Configured Baseline Summary</h2>
          <span className="section-pill">Saved User Inputs</span>
        </div>

        <div className="summary-cards-grid">
          {/* Architecture Setup */}
          <div className="summary-card">
            <span className="card-label">Active Setup</span>
            <span className="card-value-large highlight">
              {isHybrid ? 'Local + Hired Server' : 'Hired Server Fleet'}
            </span>
            <span className="card-subline">
              {isHybrid
                ? `${baselineConfig.localCpuCores || 0}c local + ${baselineResult.rentedAvailableCpu}c cloud`
                : `${baselineConfig.rentedServerCount || 0} cloud server instances`}
            </span>
          </div>

          {/* Monthly Spend */}
          <div className="summary-card">
            <span className="card-label">Estimated Monthly Spend</span>
            <span className="card-value-large">
              {baselineResult.monthlyEstimatedCost !== null
                ? `₹ ${baselineResult.monthlyEstimatedCost.toLocaleString('en-IN')}`
                : 'Cost Unknown'}
            </span>
            <span className="card-subline">
              {baselineResult.monthlyEstimatedCost !== null ? 'Monthly combined lease & facility' : 'Marked unknown by user'}
            </span>
          </div>

          {/* Compute Capacity */}
          <div className="summary-card">
            <span className="card-label">Total Compute Capacity</span>
            <span className="card-value-large teal">{baselineResult.totalAvailableCpu} Cores</span>
            <span className="card-subline">
              {baselineResult.demandCpu !== null
                ? `Target Demand: ${baselineResult.demandCpu} Cores`
                : 'Demand not entered'}
            </span>
          </div>

          {/* Memory Capacity */}
          <div className="summary-card">
            <span className="card-label">Total Memory Capacity</span>
            <span className="card-value-large blue">{baselineResult.totalAvailableRamGb} GB</span>
            <span className="card-subline">
              {baselineResult.demandRamGb !== null
                ? `Target Demand: ${baselineResult.demandRamGb} GB`
                : 'Demand not entered'}
            </span>
          </div>

          {/* Sizing Status */}
          <div className="summary-card">
            <span className="card-label">Capacity Status</span>
            <span className={`status-badge-val ${baselineResult.classification.toLowerCase()}`}>
              {baselineResult.classificationLabel}
            </span>
            <span className="card-subline">
              {baselineResult.cpuDelta !== null
                ? baselineResult.cpuDelta >= 0
                  ? `+${baselineResult.cpuDelta} cores headroom buffer`
                  : `${baselineResult.cpuDelta} cores shortfall`
                : 'Derived from fleet utilization'}
            </span>
          </div>
        </div>
      </section>

      {/* 2 & 3. 3D Visualization & Capacity/Cost Comparison Section */}
      <section className="trends-section-block">
        <div className="tabs-nav-bar">
          <button
            type="button"
            className={`tab-btn ${activeTab === 'comparison' ? 'active' : ''}`}
            onClick={() => setActiveTab('comparison')}
          >
            📊 Cost & Capacity Trade-Offs
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'scenario' ? 'active' : ''}`}
            onClick={() => setActiveTab('scenario')}
          >
            ⚡ Interactive Scenario Simulator
          </button>
        </div>

        {/* Tab 1: Cost & Capacity Comparison */}
        {activeTab === 'comparison' && (
          <div className="comparison-content-grid">
            {/* Left 3D Visualizer */}
            <div className="trends-card 3d-viewport-card">
              <div className="card-header-row">
                <div className="header-title-box">
                  <span className="pulse-dot teal" />
                  <h3>3D Sizing & Headroom Comparison</h3>
                </div>
                <span className="scene-status-tag">Real-Time WebGL</span>
              </div>

              <ScenarioComparison3DScene
                baselineCpu={baselineResult.totalAvailableCpu}
                baselineRam={baselineResult.totalAvailableRamGb}
                baselineCost={baselineResult.monthlyEstimatedCost}
                scenarioCpu={scenarioResult.totalAvailableCpu}
                scenarioRam={scenarioResult.totalAvailableRamGb}
                scenarioCost={scenarioResult.monthlyEstimatedCost}
                demandCpu={baselineResult.demandCpu}
                demandRam={baselineResult.demandRamGb}
              />
            </div>

            {/* Right Cost & Capacity Breakdown */}
            <div className="trends-card breakdown-card">
              <h3 className="card-heading">Cost Structure Comparison</h3>
              <p className="card-desc">
                Comparative financial model evaluating cloud leasing versus hybrid on-premises amortized facility
                overhead.
              </p>

              <div className="cost-comparison-table">
                <div className="table-row header">
                  <span>Architecture</span>
                  <span>Local Facility</span>
                  <span>Rented Cloud</span>
                  <span>Total Monthly</span>
                </div>

                {/* Baseline Row */}
                <div className="table-row">
                  <span className="arch-name">
                    <strong>Baseline:</strong> {isHybrid ? 'Hybrid (Local + Hired)' : 'Pure Rented Cloud'}
                  </span>
                  <span>
                    {isHybrid && !baselineConfig.localCostUnknown && baselineConfig.localOperatingCostMonthly
                      ? `₹ ${Number(baselineConfig.localOperatingCostMonthly).toLocaleString('en-IN')}`
                      : '—'}
                  </span>
                  <span>
                    {!baselineConfig.rentalCostUnknown && baselineConfig.monthlyRentalCostPerServer
                      ? `₹ ${(Number(baselineConfig.rentedServerCount || 0) * Number(baselineConfig.monthlyRentalCostPerServer)).toLocaleString('en-IN')}`
                      : 'Unknown'}
                  </span>
                  <span className="total-highlight">
                    {baselineResult.monthlyEstimatedCost !== null
                      ? `₹ ${baselineResult.monthlyEstimatedCost.toLocaleString('en-IN')}`
                      : 'Unknown'}
                  </span>
                </div>

                {/* What-If Alternative Row */}
                <div className="table-row alternative">
                  <span className="arch-name">
                    <strong>What-If Scenario:</strong> Scaled Fleet
                  </span>
                  <span>
                    {isHybrid && whatIfConfig.localOperatingCostMonthly
                      ? `₹ ${Number(whatIfConfig.localOperatingCostMonthly).toLocaleString('en-IN')}`
                      : '—'}
                  </span>
                  <span>
                    {whatIfConfig.monthlyRentalCostPerServer
                      ? `₹ ${(Number(whatIfConfig.rentedServerCount || 0) * Number(whatIfConfig.monthlyRentalCostPerServer)).toLocaleString('en-IN')}`
                      : 'Unknown'}
                  </span>
                  <span className="total-highlight scenario">
                    {scenarioResult.monthlyEstimatedCost !== null
                      ? `₹ ${scenarioResult.monthlyEstimatedCost.toLocaleString('en-IN')}`
                      : 'Unknown'}
                  </span>
                </div>
              </div>

              {/* Cost Delta Explanation */}
              {costDiff !== null && (
                <div className="cost-delta-banner">
                  <span className="delta-icon">💰</span>
                  <p>
                    <strong>Estimated Difference:</strong>{' '}
                    {costDiff === 0 ? (
                      <span>The scenario maintains identical monthly expenditure.</span>
                    ) : costDiff > 0 ? (
                      <span>
                        The alternative scenario increases monthly spend by{' '}
                        <strong>₹ {Math.abs(costDiff).toLocaleString('en-IN')}</strong> to add compute headroom.
                      </span>
                    ) : (
                      <span>
                        The alternative scenario reduces monthly spend by{' '}
                        <strong>₹ {Math.abs(costDiff).toLocaleString('en-IN')}</strong> by trimming excess capacity.
                      </span>
                    )}
                  </p>
                </div>
              )}

              {/* Capacity Comparison Bars */}
              <div className="capacity-bars-section">
                <h4 className="bars-title">Capacity & Headroom Analysis</h4>

                {/* Compute Bar */}
                <div className="capacity-bar-group">
                  <div className="bar-labels-row">
                    <span>Compute Capacity (vCPU Cores)</span>
                    <span className="bar-values">
                      Baseline: {baselineResult.totalAvailableCpu}c · Alternative: {scenarioResult.totalAvailableCpu}c
                      {baselineResult.demandCpu !== null && ` · Target: ${baselineResult.demandCpu}c`}
                    </span>
                  </div>
                  <div className="progress-bar-track">
                    <div
                      className="progress-bar-fill baseline"
                      style={{
                        width: `${Math.min(100, Math.round((baselineResult.totalAvailableCpu / Math.max(baselineResult.totalAvailableCpu, scenarioResult.totalAvailableCpu, baselineResult.demandCpu || 1)) * 100))}%`,
                      }}
                      title={`Baseline: ${baselineResult.totalAvailableCpu} Cores`}
                    />
                    <div
                      className="progress-bar-fill scenario"
                      style={{
                        width: `${Math.min(100, Math.round((scenarioResult.totalAvailableCpu / Math.max(baselineResult.totalAvailableCpu, scenarioResult.totalAvailableCpu, baselineResult.demandCpu || 1)) * 100))}%`,
                      }}
                      title={`Scenario: ${scenarioResult.totalAvailableCpu} Cores`}
                    />
                  </div>
                </div>

                {/* Memory Bar */}
                <div className="capacity-bar-group">
                  <div className="bar-labels-row">
                    <span>Memory Capacity (RAM GB)</span>
                    <span className="bar-values">
                      Baseline: {baselineResult.totalAvailableRamGb} GB · Alternative: {scenarioResult.totalAvailableRamGb} GB
                      {baselineResult.demandRamGb !== null && ` · Target: ${baselineResult.demandRamGb} GB`}
                    </span>
                  </div>
                  <div className="progress-bar-track">
                    <div
                      className="progress-bar-fill baseline"
                      style={{
                        width: `${Math.min(100, Math.round((baselineResult.totalAvailableRamGb / Math.max(baselineResult.totalAvailableRamGb, scenarioResult.totalAvailableRamGb, baselineResult.demandRamGb || 1)) * 100))}%`,
                      }}
                      title={`Baseline: ${baselineResult.totalAvailableRamGb} GB`}
                    />
                    <div
                      className="progress-bar-fill scenario"
                      style={{
                        width: `${Math.min(100, Math.round((scenarioResult.totalAvailableRamGb / Math.max(baselineResult.totalAvailableRamGb, scenarioResult.totalAvailableRamGb, baselineResult.demandRamGb || 1)) * 100))}%`,
                      }}
                      title={`Scenario: ${scenarioResult.totalAvailableRamGb} GB`}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Interactive Scenario Simulator */}
        {activeTab === 'scenario' && (
          <div className="scenario-simulator-layout">
            <div className="trends-card simulator-controls-card">
              <div className="simulator-header-row">
                <div>
                  <h3 className="card-heading">Adjust Scenario Assumptions</h3>
                  <p className="card-desc">
                    Tweak capacity parameters to simulate how hardware sizing affects costs and demand coverage.
                    Saved configurations remain untouched.
                  </p>
                </div>
                <button type="button" className="btn-reset-scenario" onClick={handleResetScenario}>
                  ↺ Reset Scenario
                </button>
              </div>

              <div className="simulator-inputs-grid">
                {/* Rented Server Count */}
                <div className="simulator-field">
                  <label>
                    <span>Rented Server Count</span>
                    <span className="field-unit">{whatIfConfig.rentedServerCount || 0} Servers</span>
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    step="1"
                    value={whatIfConfig.rentedServerCount || 1}
                    onChange={(e) =>
                      setWhatIfConfig((prev) => ({ ...prev, rentedServerCount: Number(e.target.value) }))
                    }
                  />
                </div>

                {/* CPU Cores per server */}
                <div className="simulator-field">
                  <label>
                    <span>CPU Cores per Server</span>
                    <span className="field-unit">{whatIfConfig.cpuCoresPerServer || 0} vCPU</span>
                  </label>
                  <select
                    className="simulator-select"
                    value={whatIfConfig.cpuCoresPerServer || 16}
                    onChange={(e) =>
                      setWhatIfConfig((prev) => ({ ...prev, cpuCoresPerServer: Number(e.target.value) }))
                    }
                  >
                    <option value="8">8 Cores</option>
                    <option value="16">16 Cores</option>
                    <option value="32">32 Cores</option>
                    <option value="64">64 Cores</option>
                  </select>
                </div>

                {/* RAM per server */}
                <div className="simulator-field">
                  <label>
                    <span>RAM per Server</span>
                    <span className="field-unit">{whatIfConfig.ramGbPerServer || 0} GB</span>
                  </label>
                  <select
                    className="simulator-select"
                    value={whatIfConfig.ramGbPerServer || 64}
                    onChange={(e) =>
                      setWhatIfConfig((prev) => ({ ...prev, ramGbPerServer: Number(e.target.value) }))
                    }
                  >
                    <option value="32">32 GB</option>
                    <option value="64">64 GB</option>
                    <option value="128">128 GB</option>
                    <option value="256">256 GB</option>
                  </select>
                </div>

                {/* Monthly Rental Cost per server */}
                <div className="simulator-field">
                  <label>
                    <span>Monthly Rental Cost / Server</span>
                    <span className="field-unit">₹ {Number(whatIfConfig.monthlyRentalCostPerServer || 0).toLocaleString('en-IN')}</span>
                  </label>
                  <input
                    type="range"
                    min="5000"
                    max="45000"
                    step="1000"
                    value={whatIfConfig.monthlyRentalCostPerServer || 15000}
                    onChange={(e) =>
                      setWhatIfConfig((prev) => ({
                        ...prev,
                        monthlyRentalCostPerServer: Number(e.target.value),
                        rentalCostUnknown: false,
                      }))
                    }
                  />
                </div>

                {/* Local Operating Cost (if Hybrid) */}
                {isHybrid && (
                  <div className="simulator-field">
                    <label>
                      <span>Local Datacenter Operating Cost</span>
                      <span className="field-unit">₹ {Number(whatIfConfig.localOperatingCostMonthly || 0).toLocaleString('en-IN')}</span>
                    </label>
                    <input
                      type="range"
                      min="10000"
                      max="80000"
                      step="2500"
                      value={whatIfConfig.localOperatingCostMonthly || 35000}
                      onChange={(e) =>
                        setWhatIfConfig((prev) => ({
                          ...prev,
                          localOperatingCostMonthly: Number(e.target.value),
                          localCostUnknown: false,
                        }))
                      }
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Real-Time Outcome Comparison Card */}
            <div className="trends-card simulator-outcome-card">
              <h3 className="card-heading">Simulated Sensitivity Outcome</h3>

              <div className="outcome-comparison-boxes">
                {/* Baseline Box */}
                <div className="outcome-box baseline">
                  <span className="box-tag">Saved Baseline</span>
                  <div className="box-val">{baselineResult.totalAvailableCpu} Cores</div>
                  <div className="box-sub">{baselineResult.totalAvailableRamGb} GB RAM</div>
                  <div className="box-cost">
                    {baselineResult.monthlyEstimatedCost !== null
                      ? `₹ ${baselineResult.monthlyEstimatedCost.toLocaleString('en-IN')} / mo`
                      : 'Cost Unknown'}
                  </div>
                  <span className={`box-status ${baselineResult.classification.toLowerCase()}`}>
                    {baselineResult.classificationLabel}
                  </span>
                </div>

                {/* Comparison Arrow */}
                <div className="outcome-arrow">➔</div>

                {/* What-If Box */}
                <div className="outcome-box alternative">
                  <span className="box-tag">What-If Alternative</span>
                  <div className="box-val">{scenarioResult.totalAvailableCpu} Cores</div>
                  <div className="box-sub">{scenarioResult.totalAvailableRamGb} GB RAM</div>
                  <div className="box-cost">
                    {scenarioResult.monthlyEstimatedCost !== null
                      ? `₹ ${scenarioResult.monthlyEstimatedCost.toLocaleString('en-IN')} / mo`
                      : 'Cost Unknown'}
                  </div>
                  <span className={`box-status ${scenarioResult.classification.toLowerCase()}`}>
                    {scenarioResult.classificationLabel}
                  </span>
                </div>
              </div>

              {/* Sizing Recommendation Explanation */}
              <div className="recommendation-fit-banner">
                <span className="fit-icon">💡</span>
                <div className="fit-text">
                  <strong>Sizing Recommendation:</strong>{' '}
                  {demandCpu !== null ? (
                    baselineMeetsDemand && !scenarioMeetsDemand ? (
                      <span>
                        Your baseline configuration satisfies the target workload demand ({demandCpu} cores),
                        whereas the simulated alternative introduces an unhandled shortfall. Retain baseline.
                      </span>
                    ) : !baselineMeetsDemand && scenarioMeetsDemand ? (
                      <span>
                        The simulated alternative resolves your baseline capacity deficit, providing adequate
                        headroom ({scenarioResult.totalAvailableCpu} cores vs {demandCpu} cores demand) for an
                        adjusted monthly variance of ₹ {costDiff !== null ? Math.abs(costDiff).toLocaleString('en-IN') : '—'}.
                      </span>
                    ) : (
                      <span>
                        Both setups satisfy confirmed demand ({demandCpu} cores). The alternative alters total
                        capacity by {cpuDiff >= 0 ? `+${cpuDiff}` : cpuDiff} cores and adjusts monthly spend by{' '}
                        {costDiff !== null
                          ? `${costDiff >= 0 ? `+₹ ${costDiff.toLocaleString('en-IN')}` : `-₹ ${Math.abs(costDiff).toLocaleString('en-IN')}`}`
                          : '—'}.
                      </span>
                    )
                  ) : (
                    <span>
                      The simulated alternative provides a capacity delta of {cpuDiff >= 0 ? `+${cpuDiff}` : cpuDiff} cores
                      and {ramDiff >= 0 ? `+${ramDiff}` : ramDiff} GB RAM.
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Notice & Disclaimer Banner */}
      <footer className="trends-footer-banner">
        <span className="disclaimer-shield">🛡️</span>
        <p>
          <strong>Decision Support Notice:</strong> What-If scenarios are purely illustrative estimations calculated
          deterministically. SkyCash does not connect to, inspect, or modify production cloud subscriptions or on-premises servers.
        </p>
      </footer>
    </div>
  );
};
