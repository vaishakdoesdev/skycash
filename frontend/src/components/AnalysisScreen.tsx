import React, { useState } from 'react';
import { ServerConfigurationState, CapacityAnalysisResult } from '../types';
import { CapacityComparisonScene } from './3d/CapacityComparisonScene';
import { BackgroundCyberGrid } from './3d/BackgroundCyberGrid';
import { StepProgressIndicator } from './StepProgressIndicator';

interface AnalysisScreenProps {
  result: CapacityAnalysisResult;
  config: ServerConfigurationState;
  onBackToConfig: () => void;
  onBackToSetup: () => void;
  onExploreCatalog?: () => void;
  onNavigateToTrends?: () => void;
  maxUnlockedStep?: number;
  onNavigateStep?: (step: number) => void;
}

export const AnalysisScreen: React.FC<AnalysisScreenProps> = ({
  result,
  config,
  onBackToConfig,
  onBackToSetup,
  onExploreCatalog,
  onNavigateToTrends,
  maxUnlockedStep = 3,
  onNavigateStep,
}) => {
  const [selectedInspectComponent, setSelectedInspectComponent] = useState<{
    title: string;
    subtitle: string;
    specs: string[];
  } | null>(null);

  const isHybrid = result.setup === 'hybrid';
  const isUnder = result.classification === 'UNDER_PROVISIONED';
  const isMatched = result.classification === 'APPROXIMATELY_MATCHED';
  const isOver = result.classification === 'POTENTIALLY_OVER_PROVISIONED';

  return (
    <div className="analysis-screen-container">
      <BackgroundCyberGrid />

      {/* 5-Step Progress Stepper */}
      {onNavigateStep ? (
        <StepProgressIndicator
          currentStep={3}
          maxUnlockedStep={maxUnlockedStep}
          onNavigateStep={onNavigateStep}
          className="analysis-main-stepper"
        />
      ) : (
        <nav className="config-stepper-header">
          <div className="stepper-track">
            <div className="step-item completed" onClick={onBackToSetup} role="button" tabIndex={0}>
              <div className="step-icon">✓</div>
              <div className="step-label">1. Infrastructure Setup</div>
            </div>
            <div className="step-divider active"></div>
            <div className="step-item completed" onClick={onBackToConfig} role="button" tabIndex={0}>
              <div className="step-icon">✓</div>
              <div className="step-label">2. Server Configuration</div>
            </div>
            <div className="step-divider active"></div>
            <div className="step-item active">
              <div className="step-icon">3</div>
              <div className="step-label">3. Analysis & Recommendation</div>
            </div>
          </div>
        </nav>
      )}

      {/* Top Banner with Action Buttons */}
      <header className="analysis-top-banner">
        <div className="analysis-banner-content">
          <div className="analysis-banner-left">
            <div className="analysis-tag-group">
              <span className="setup-badge">
                {isHybrid ? 'OPTION B: LOCAL + HIRED SERVER' : 'OPTION A: HIRED SERVER'}
              </span>
              <span className={`classification-badge ${isUnder ? 'under' : isMatched ? 'matched' : isOver ? 'over' : 'neutral'}`}>
                {result.classificationLabel}
              </span>
            </div>
            <h1 className="analysis-title">Infrastructure Capacity Assessment</h1>
            <p className="analysis-subtitle">
              Calculated comparison of available server capacity against workload demand.
            </p>
          </div>

          <div className="analysis-banner-actions">
            <button type="button" className="btn btn-secondary btn-sm" onClick={onBackToConfig}>
              ✏ Adjust Configuration
            </button>
            {onExploreCatalog && (
              <button type="button" className="btn btn-secondary btn-sm" onClick={onExploreCatalog}>
                📊 View Workload Inventory
              </button>
            )}
            {onNavigateToTrends && (
              <button type="button" className="btn btn-primary btn-sm btn-nav-action-trends" onClick={onNavigateToTrends}>
                🧪 Step 4: Testing & Comparison →
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Analysis Layout: Left 3D Viewport & Right Decision Cards */}
      <div className="analysis-grid-layout">
        {/* Left Column: Interactive 3D Capacity Scene */}
        <div className="analysis-3d-column">
          <div className="analysis-card scene-card">
            <div className="card-header-clean">
              <div className="card-title-row">
                <span className="pulsing-beacon"></span>
                <h3>3D Capacity vs Demand Representation</h3>
              </div>
              <span className="unit-tag">Interactive Three.js Scene</span>
            </div>

            <CapacityComparisonScene
              result={result}
              onSelectComponent={(info) => setSelectedInspectComponent(info)}
            />

            {/* Inspect Overlay Card if user clicked a 3D element */}
            {selectedInspectComponent ? (
              <div className="inspection-detail-box">
                <div className="inspection-header">
                  <div>
                    <h4>{selectedInspectComponent.title}</h4>
                    <span className="inspection-sub">{selectedInspectComponent.subtitle}</span>
                  </div>
                  <button
                    type="button"
                    className="close-inspect-btn"
                    onClick={() => setSelectedInspectComponent(null)}
                  >
                    ✕
                  </button>
                </div>
                <ul className="inspection-specs-list">
                  {selectedInspectComponent.specs.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="scene-legend-bar">
                <div className="legend-item">
                  <span className="legend-swatch local"></span>
                  <span>{isHybrid ? 'Local On-Premises Server' : 'Rented Server Chassis'}</span>
                </div>
                {isHybrid && (
                  <div className="legend-item">
                    <span className="legend-swatch cloud"></span>
                    <span>Rented Cloud Server</span>
                  </div>
                )}
                <div className="legend-item">
                  <span className="legend-swatch demand"></span>
                  <span>Workload Demand Pod</span>
                </div>
              </div>
            )}
          </div>

          {/* Missing Data Warnings Box if any */}
          {result.missingDataWarnings.length > 0 && (
            <div className="missing-data-alert-card">
              <div className="alert-card-header">
                <span className="alert-icon">⚠️</span>
                <h4>Unspecified Inputs & Calculation Limitations</h4>
              </div>
              <ul className="missing-data-list">
                {result.missingDataWarnings.map((warning, idx) => (
                  <li key={idx}>{warning}</li>
                ))}
              </ul>
              <div className="missing-data-action">
                <button type="button" className="btn btn-outline-warning btn-sm" onClick={onBackToConfig}>
                  Provide Missing Details
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Calculated Arithmetic & Recommendations */}
        <div className="analysis-metrics-column">
          {/* Recommendation Overview Card */}
          <div className="analysis-card recommendation-card">
            <div className="rec-header-row">
              <span className="rec-icon">
                {isUnder ? '⚠️' : isMatched ? '✅' : isOver ? '⚡' : 'ℹ️'}
              </span>
              <div>
                <span className="rec-kicker">SkyCash Sizing Assessment</span>
                <h3 className="rec-heading">{result.classificationLabel}</h3>
              </div>
            </div>

            <p className="rec-explanation-text">{result.explanation}</p>

            {/* Hybrid Suggested Allocation Breakdown */}
            {isHybrid && result.suggestedAllocation && (
              <div className="hybrid-allocation-panel">
                <h4 className="allocation-title">Suggested Placement Allocation</h4>
                <p className="allocation-rationale">{result.suggestedAllocation.rationale}</p>

                <div className="allocation-splits-grid">
                  <div className="split-box local">
                    <span className="split-label">Local Karnataka DC</span>
                    <span className="split-val">{result.suggestedAllocation.localWorkloadCores} Cores</span>
                    <span className="split-sub">{result.suggestedAllocation.localWorkloadRamGb} GB RAM (Baseline)</span>
                  </div>
                  <div className="split-box cloud">
                    <span className="split-label">Rented Cloud Fleet</span>
                    <span className="split-val">{result.suggestedAllocation.rentedWorkloadCores} Cores</span>
                    <span className="split-sub">{result.suggestedAllocation.rentedWorkloadRamGb} GB RAM (Elastic)</span>
                  </div>
                </div>

                <div className="policy-check-note">
                  <span className="check-mark">✓</span>
                  <span>
                    Respects configured data residency (
                    {config.residencyConstraint === 'KARNATAKA_DC_ONLY'
                      ? 'Strict Karnataka DC Only'
                      : config.residencyConstraint === 'INDIA_ONLY'
                      ? 'India Sovereign Cloud Only'
                      : 'Any Approved Region'}
                    )
                    {config.coLocationRequirement && ' & Co-location network enclosure constraints'}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Quantitative Capacity Breakdown Grid */}
          <div className="analysis-card metrics-summary-card">
            <h4 className="card-subheading">Calculated Capacity & Demand Metrics</h4>

            <div className="capacity-metrics-grid">
              {/* Total Compute Available */}
              <div className="metric-cell">
                <span className="metric-label">Total Compute Available</span>
                <span className="metric-number highlight">{result.totalAvailableCpu} Cores</span>
                <span className="metric-context">
                  {isHybrid
                    ? `${result.localAvailableCpu} local + ${result.rentedAvailableCpu} rented`
                    : `${config.rentedServerCount || 0} rented server(s)`}
                </span>
              </div>

              {/* Workload Compute Demand */}
              <div className="metric-cell">
                <span className="metric-label">Workload CPU Demand</span>
                <span className="metric-number">
                  {result.demandCpu !== null ? `${result.demandCpu} Cores` : 'Unknown'}
                </span>
                <span className={`metric-delta ${result.cpuDelta !== null ? (result.cpuDelta >= 0 ? 'positive' : 'negative') : ''}`}>
                  {result.cpuDelta !== null
                    ? `${result.cpuDelta >= 0 ? `+${result.cpuDelta} cores excess` : `${result.cpuDelta} cores deficit`}`
                    : 'Demand not entered'}
                </span>
              </div>

              {/* Total Memory Available */}
              <div className="metric-cell">
                <span className="metric-label">Total Memory Available</span>
                <span className="metric-number highlight">{result.totalAvailableRamGb} GB</span>
                <span className="metric-context">
                  {isHybrid
                    ? `${result.localAvailableRamGb} GB local + ${result.rentedAvailableRamGb} GB rented`
                    : `${config.rentedServerCount || 0} rented server(s)`}
                </span>
              </div>

              {/* Workload Memory Demand */}
              <div className="metric-cell">
                <span className="metric-label">Workload RAM Demand</span>
                <span className="metric-number">
                  {result.demandRamGb !== null ? `${result.demandRamGb} GB` : 'Unknown'}
                </span>
                <span className={`metric-delta ${result.ramDelta !== null ? (result.ramDelta >= 0 ? 'positive' : 'negative') : ''}`}>
                  {result.ramDelta !== null
                    ? `${result.ramDelta >= 0 ? `+${result.ramDelta} GB excess` : `${result.ramDelta} GB deficit`}`
                    : 'Demand not entered'}
                </span>
              </div>

              {/* Average Utilization */}
              <div className="metric-cell">
                <span className="metric-label">Average Fleet Utilization</span>
                <span className="metric-number">
                  {result.cpuUtilizationPct !== null ? `${result.cpuUtilizationPct}% CPU` : 'Unknown'}
                </span>
                <span className="metric-context">
                  {result.ramUtilizationPct !== null ? `${result.ramUtilizationPct}% RAM` : 'RAM unknown'}
                </span>
              </div>

              {/* Estimated Monthly Cost */}
              <div className="metric-cell">
                <span className="metric-label">Estimated Monthly Spend</span>
                <span className="metric-number">
                  {result.monthlyEstimatedCost !== null
                    ? `₹ ${result.monthlyEstimatedCost.toLocaleString('en-IN')}`
                    : 'Cost Unknown'}
                </span>
                <span className="metric-context">
                  {result.monthlyEstimatedCost !== null
                    ? (isHybrid ? 'Local facility + cloud lease' : 'Rented cloud server lease')
                    : 'Marked as unknown by user'}
                </span>
              </div>
            </div>
          </div>

          {/* Section: How SkyCash Works */}
          <div className="analysis-card how-it-works-card">
            <h4 className="card-subheading">How SkyCash Works</h4>
            <ol className="how-it-works-steps">
              <li>
                <div className="step-num-circle">1</div>
                <div>
                  <strong>Enter server specifications:</strong> Provide your hardware capacity (cores, RAM, cost) and estimated workload demand.
                </div>
              </li>
              <li>
                <div className="step-num-circle">2</div>
                <div>
                  <strong>SkyCash compares resources:</strong> Explicit deterministic calculation evaluates available resources vs workload demand and costs.
                </div>
              </li>
              <li>
                <div className="step-num-circle">3</div>
                <div>
                  <strong>Identify capacity mismatches:</strong> Sizing classifications reveal whether capacity is under-provisioned, matched, or over-provisioned.
                </div>
              </li>
              <li>
                <div className="step-num-circle">4</div>
                <div>
                  <strong>Review before deciding:</strong> You review the recommendation and adjust sizing before making infrastructure decisions.
                </div>
              </li>
            </ol>
          </div>

          {/* Explicit MVP Notice Banner */}
          <div className="mvp-disclaimer-banner">
            <div className="disclaimer-icon">🛡️</div>
            <div className="disclaimer-text">
              <strong>Notice:</strong> Results are estimates based on the information provided. This MVP does not connect to, inspect, or migrate real servers.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
