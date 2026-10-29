import React, { useState } from 'react';
import { PrivateDCAssumptions, PlacementRecommendation, CostCapacityScenario } from '../types';

interface ScenarioSimulatorProps {
  dc: PrivateDCAssumptions;
  recommendations: PlacementRecommendation[];
  scenarios: CostCapacityScenario[];
}

export const ScenarioSimulator: React.FC<ScenarioSimulatorProps> = ({
  dc,
  recommendations,
  scenarios,
}) => {
  const [cpuGrowth, setCpuGrowth] = useState<number>(20);
  const [ramGrowth, setRamGrowth] = useState<number>(15);
  const [storageGrowth, setStorageGrowth] = useState<number>(25);
  const [cloudPriceAdj, setCloudPriceAdj] = useState<number>(-5);
  const [dcCostAdj, setDcCostAdj] = useState<number>(3);
  const [timeframeMonths, setTimeframeMonths] = useState<number>(12);

  // Apply a preset
  const applyPreset = (s: CostCapacityScenario) => {
    setCpuGrowth(s.cpu_growth_rate_pct);
    setRamGrowth(s.ram_growth_rate_pct);
    setStorageGrowth(s.storage_growth_rate_pct);
    setCloudPriceAdj(s.cloud_cost_adjustment_pct);
    setDcCostAdj(s.private_dc_cost_adjustment_pct);
    setTimeframeMonths(s.timeframe_months);
  };

  // Base resources
  const baseDcCpu = recommendations
    .filter((r) => r.recommended_placement === dc.dc_id)
    .reduce((acc, r) => acc + r.capacity_allocated_cpu, 0);

  const baseDcRam = recommendations
    .filter((r) => r.recommended_placement === dc.dc_id)
    .reduce((acc, r) => acc + r.capacity_allocated_ram_gib, 0);

  const baseDcStorage = recommendations
    .filter((r) => r.recommended_placement === dc.dc_id)
    .reduce((acc, r) => acc + r.capacity_allocated_storage_gib, 0);

  // If 100% retained in DC
  const allDcCpu = recommendations.reduce((acc, r) => acc + r.capacity_allocated_cpu, 0);
  const allDcRam = recommendations.reduce((acc, r) => acc + r.capacity_allocated_ram_gib, 0);
  const allDcStorage = recommendations.reduce((acc, r) => acc + r.capacity_allocated_storage_gib, 0);

  // Growth calculations
  const projectedRecommendedDcCpu = Math.round(baseDcCpu * (1 + cpuGrowth / 100) * 10) / 10;
  const projectedRecommendedDcRam = Math.round(baseDcRam * (1 + ramGrowth / 100) * 10) / 10;
  const projectedRecommendedDcStorage = Math.round(baseDcStorage * (1 + storageGrowth / 100) * 10) / 10;

  const projectedUnoptimizedDcCpu = Math.round(allDcCpu * (1 + cpuGrowth / 100) * 10) / 10;
  const projectedUnoptimizedDcRam = Math.round(allDcRam * (1 + ramGrowth / 100) * 10) / 10;
  const projectedUnoptimizedDcStorage = Math.round(allDcStorage * (1 + storageGrowth / 100) * 10) / 10;

  // Cost calculations
  const baseCurrentSpend = recommendations.reduce((acc, r) => acc + r.current_monthly_cost, 0);
  const baseRecommendedSpend = recommendations.reduce((acc, r) => acc + r.recommended_monthly_cost, 0);

  const projectedCurrentSpend = Math.round(
    baseCurrentSpend * (1 + dcCostAdj / 100) * (1 + (cpuGrowth * 0.4 + ramGrowth * 0.3 + storageGrowth * 0.3) / 100)
  );

  const projectedRecommendedSpend = Math.round(
    baseRecommendedSpend *
      (1 + (cloudPriceAdj * 0.4 + dcCostAdj * 0.6) / 100) *
      (1 + (cpuGrowth * 0.35 + ramGrowth * 0.3 + storageGrowth * 0.25) / 100)
  );

  const projectedSavings = projectedCurrentSpend - projectedRecommendedSpend;

  // Threshold breach checks
  const storageBreachedUnoptimized = projectedUnoptimizedDcStorage > dc.usable_storage_gib * 0.8;
  const cpuBreachedUnoptimized = projectedUnoptimizedDcCpu > dc.usable_cpu_cores * 0.8;
  const ramBreachedUnoptimized = projectedUnoptimizedDcRam > dc.usable_ram_gib * 0.8;

  return (
    <div className="simulator-container">
      {/* Header and Presets */}
      <div className="section-card">
        <div className="section-header">
          <div>
            <h2 className="section-title">Forward-Looking Cost & Capacity Simulator</h2>
            <p className="section-subtitle">
              Simulate estate organic expansion, demand spikes, and provider price trends over {timeframeMonths} months
            </p>
          </div>

          <div className="preset-buttons">
            <span className="preset-label">Load Preset:</span>
            {scenarios.map((s) => (
              <button
                key={s.scenario_id}
                className="btn btn-secondary btn-sm"
                onClick={() => applyPreset(s)}
              >
                {s.name}
              </button>
            ))}
          </div>
        </div>

        {/* Sliders Grid */}
        <div className="sliders-grid">
          <div className="slider-box">
            <div className="slider-header">
              <span>Compute Growth Rate</span>
              <strong className="slider-val">+{cpuGrowth}%</strong>
            </div>
            <input
              type="range"
              min="0"
              max="80"
              step="5"
              value={cpuGrowth}
              onChange={(e) => setCpuGrowth(Number(e.target.value))}
            />
            <span className="slider-meta">Organic transaction demand increase</span>
          </div>

          <div className="slider-box">
            <div className="slider-header">
              <span>Memory Demand Growth</span>
              <strong className="slider-val">+{ramGrowth}%</strong>
            </div>
            <input
              type="range"
              min="0"
              max="80"
              step="5"
              value={ramGrowth}
              onChange={(e) => setRamGrowth(Number(e.target.value))}
            />
            <span className="slider-meta">Caching & in-memory dataset scaling</span>
          </div>

          <div className="slider-box">
            <div className="slider-header">
              <span>Storage Accumulation</span>
              <strong className="slider-val">+{storageGrowth}%</strong>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={storageGrowth}
              onChange={(e) => setStorageGrowth(Number(e.target.value))}
            />
            <span className="slider-meta">KYC uploads & audit history growth</span>
          </div>

          <div className="slider-box">
            <div className="slider-header">
              <span>Cloud Price Trend Adjustment</span>
              <strong className="slider-val">{cloudPriceAdj > 0 ? `+${cloudPriceAdj}%` : `${cloudPriceAdj}%`}</strong>
            </div>
            <input
              type="range"
              min="-20"
              max="20"
              step="2"
              value={cloudPriceAdj}
              onChange={(e) => setCloudPriceAdj(Number(e.target.value))}
            />
            <span className="slider-meta">Provider discounts or commodity inflation</span>
          </div>

          <div className="slider-box">
            <div className="slider-header">
              <span>Private DC Power & Capex Shift</span>
              <strong className="slider-val">{dcCostAdj > 0 ? `+${dcCostAdj}%` : `${dcCostAdj}%`}</strong>
            </div>
            <input
              type="range"
              min="-15"
              max="25"
              step="1"
              value={dcCostAdj}
              onChange={(e) => setDcCostAdj(Number(e.target.value))}
            />
            <span className="slider-meta">Electricity tariff and facility lease variance</span>
          </div>

          <div className="slider-box">
            <div className="slider-header">
              <span>Forecast Timeframe</span>
              <strong className="slider-val">{timeframeMonths} Months</strong>
            </div>
            <input
              type="range"
              min="3"
              max="24"
              step="3"
              value={timeframeMonths}
              onChange={(e) => setTimeframeMonths(Number(e.target.value))}
            />
            <span className="slider-meta">Projection window duration</span>
          </div>
        </div>
      </div>

      {/* Simulation Results Comparison */}
      <div className="two-col-grid">
        {/* Cost Projection */}
        <div className="section-card">
          <div className="section-header">
            <div>
              <h3 className="section-title">Projected Monthly Spend at Month {timeframeMonths}</h3>
              <p className="section-subtitle">Cost variance under unoptimized baseline vs recommended placement</p>
            </div>
          </div>

          <div className="cost-sim-results">
            <div className="sim-spend-row">
              <span className="sim-label">Unoptimized (100% in DC):</span>
              <span className="sim-value text-muted">₹{projectedCurrentSpend.toLocaleString('en-IN')}/mo</span>
            </div>

            <div className="sim-spend-row highlight">
              <span className="sim-label">Recommended Hybrid Placement:</span>
              <span className="sim-value text-emerald">₹{projectedRecommendedSpend.toLocaleString('en-IN')}/mo</span>
            </div>

            <div className="sim-savings-callout">
              <div>
                <div className="savings-callout-title">Projected Monthly Cost Avoidance</div>
                <div className="savings-callout-num">₹{projectedSavings.toLocaleString('en-IN')}/month</div>
              </div>
              <div className="savings-annual">
                ₹{(projectedSavings * 12).toLocaleString('en-IN')} cumulative annual avoidance
              </div>
            </div>
          </div>
        </div>

        {/* Capacity Threshold Forecasting */}
        <div className="section-card">
          <div className="section-header">
            <div>
              <h3 className="section-title">Private DC Capacity Headroom Forecast</h3>
              <p className="section-subtitle">Forecasted resource utilization vs {dc.usable_cpu_cores} cores & {(dc.usable_storage_gib / 1000).toFixed(0)} TB storage</p>
            </div>
          </div>

          <div className="capacity-sim-list">
            {/* Storage Comparison */}
            <div className="sim-cap-item">
              <div className="sim-cap-header">
                <span>SAN Storage Load ({timeframeMonths}m Forecast)</span>
                <span>
                  Hybrid: <strong>{(projectedRecommendedDcStorage / 1000).toFixed(1)} TB</strong> vs Unoptimized:{' '}
                  <strong className={storageBreachedUnoptimized ? 'text-danger' : ''}>
                    {(projectedUnoptimizedDcStorage / 1000).toFixed(1)} TB
                  </strong>
                </span>
              </div>
              <div className="progress-track">
                <div
                  className="progress-fill safe"
                  style={{ width: `${Math.min(100, (projectedRecommendedDcStorage / dc.usable_storage_gib) * 100)}%` }}
                ></div>
              </div>
              <div className="sim-cap-footer">
                <span>Usable DC SAN: {(dc.usable_storage_gib / 1000).toFixed(0)} TB</span>
                {storageBreachedUnoptimized ? (
                  <span className="badge badge-restricted">Unoptimized Breaches 80% Watermark</span>
                ) : (
                  <span className="text-emerald">Safe Headroom</span>
                )}
              </div>
            </div>

            {/* CPU Comparison */}
            <div className="sim-cap-item">
              <div className="sim-cap-header">
                <span>Compute vCPU Cores ({timeframeMonths}m Forecast)</span>
                <span>
                  Hybrid: <strong>{projectedRecommendedDcCpu} cores</strong> vs Unoptimized:{' '}
                  <strong className={cpuBreachedUnoptimized ? 'text-danger' : ''}>
                    {projectedUnoptimizedDcCpu} cores
                  </strong>
                </span>
              </div>
              <div className="progress-track">
                <div
                  className="progress-fill safe"
                  style={{ width: `${Math.min(100, (projectedRecommendedDcCpu / dc.usable_cpu_cores) * 100)}%` }}
                ></div>
              </div>
              <div className="sim-cap-footer">
                <span>Usable DC Cores: {dc.usable_cpu_cores}</span>
                {cpuBreachedUnoptimized ? (
                  <span className="badge badge-restricted">Unoptimized Breaches Cores</span>
                ) : (
                  <span className="text-emerald">Safe Headroom</span>
                )}
              </div>
            </div>

            {/* RAM Comparison */}
            <div className="sim-cap-item">
              <div className="sim-cap-header">
                <span>Memory RAM ({timeframeMonths}m Forecast)</span>
                <span>
                  Hybrid: <strong>{projectedRecommendedDcRam} GiB</strong> vs Unoptimized:{' '}
                  <strong className={ramBreachedUnoptimized ? 'text-danger' : ''}>
                    {projectedUnoptimizedDcRam} GiB
                  </strong>
                </span>
              </div>
              <div className="progress-track">
                <div
                  className="progress-fill safe"
                  style={{ width: `${Math.min(100, (projectedRecommendedDcRam / dc.usable_ram_gib) * 100)}%` }}
                ></div>
              </div>
              <div className="sim-cap-footer">
                <span>Usable DC RAM: {dc.usable_ram_gib} GiB</span>
                {ramBreachedUnoptimized ? (
                  <span className="badge badge-restricted">Unoptimized Breaches RAM</span>
                ) : (
                  <span className="text-emerald">Safe Headroom</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
