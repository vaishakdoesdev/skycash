import React from 'react';
import { EstateOverview, PlacementRecommendation, Workload } from '../types';

interface ExecutiveDashboardProps {
  overview: EstateOverview;
  recommendations: PlacementRecommendation[];
  workloads: Workload[];
  onSelectWorkload: (workload: Workload) => void;
  onNavigateToInventory: () => void;
}

export const ExecutiveDashboard: React.FC<ExecutiveDashboardProps> = ({
  overview,
  recommendations,
  workloads,
  onSelectWorkload,
  onNavigateToInventory,
}) => {
  const workloadsMap = new Map<string, Workload>(workloads.map((w) => [w.id, w]));

  const cpuPct = Math.round((overview.dc_cpu_used / overview.dc_cpu_usable) * 100);
  const ramPct = Math.round((overview.dc_ram_used_gib / overview.dc_ram_usable_gib) * 100);
  const storagePct = Math.round((overview.dc_storage_used_gib / overview.dc_storage_usable_gib) * 100);

  return (
    <div className="dashboard-container">
      {/* KPI Cards Row */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">Current Estate Run Cost</div>
          <div className="kpi-value">₹{overview.total_current_monthly_cost.toLocaleString('en-IN')}</div>
          <div className="kpi-subtext">All {overview.total_workloads} workloads hosted on-premise in Karnataka DC</div>
        </div>

        <div className="kpi-card highlight">
          <div className="kpi-label">Recommended Monthly Cost</div>
          <div className="kpi-value text-emerald">₹{overview.total_recommended_monthly_cost.toLocaleString('en-IN')}</div>
          <div className="kpi-subtext">Hybrid optimal placement under confirmed residency rules</div>
        </div>

        <div className="kpi-card highlight-green">
          <div className="kpi-label">Net Projected Monthly Savings</div>
          <div className="kpi-value text-emerald">
            ₹{overview.total_monthly_savings.toLocaleString('en-IN')}
            <span className="kpi-pill">-{overview.savings_percentage}%</span>
          </div>
          <div className="kpi-subtext">₹{(overview.total_monthly_savings * 12).toLocaleString('en-IN')}/year recurring operational dividend</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">Placement Eligibility Split</div>
          <div className="kpi-split">
            <div className="split-item">
              <span className="split-num">{overview.retained_in_dc_count}</span>
              <span className="split-desc">Retained in Private DC</span>
            </div>
            <div className="split-divider"></div>
            <div className="split-item">
              <span className="split-num text-emerald">{overview.moved_to_cloud_count}</span>
              <span className="split-desc">Eligible for Public Cloud</span>
            </div>
          </div>
          <div className="kpi-subtext">Zero data-residency or compliance breaches permitted</div>
        </div>
      </div>

      {/* Capacity Impact Section */}
      <div className="section-card">
        <div className="section-header">
          <div>
            <h2 className="section-title">Karnataka Private Data Centre Capacity & Headroom</h2>
            <p className="section-subtitle">
              Current hardware allocation vs usable thresholds ({overview.dc_freed_cpu} cores, {overview.dc_freed_ram_gib} GiB RAM, and {(overview.dc_freed_storage_gib / 1000).toFixed(1)} TB storage reclaimed by cloud recommendations)
            </p>
          </div>
          <span className="badge badge-success">Sovereign Compliance Verified</span>
        </div>

        <div className="capacity-grid">
          {/* CPU Bar */}
          <div className="capacity-item">
            <div className="capacity-top">
              <span className="capacity-name">Compute Allocation (vCPU Cores)</span>
              <span className="capacity-stat">
                <strong>{overview.dc_cpu_used}</strong> / {overview.dc_cpu_usable} Usable ({cpuPct}%)
              </span>
            </div>
            <div className="progress-track">
              <div
                className={`progress-fill ${cpuPct > 80 ? 'critical' : cpuPct > 60 ? 'warning' : 'safe'}`}
                style={{ width: `${Math.min(100, cpuPct)}%` }}
              ></div>
            </div>
            <div className="capacity-footer">
              <span>Installed Total: {overview.dc_cpu_total} cores</span>
              <span className="text-emerald">Reclaims {overview.dc_freed_cpu} cores</span>
            </div>
          </div>

          {/* RAM Bar */}
          <div className="capacity-item">
            <div className="capacity-top">
              <span className="capacity-name">Memory Allocation (RAM GiB)</span>
              <span className="capacity-stat">
                <strong>{overview.dc_ram_used_gib}</strong> / {overview.dc_ram_usable_gib} GiB ({ramPct}%)
              </span>
            </div>
            <div className="progress-track">
              <div
                className={`progress-fill ${ramPct > 80 ? 'critical' : ramPct > 60 ? 'warning' : 'safe'}`}
                style={{ width: `${Math.min(100, ramPct)}%` }}
              ></div>
            </div>
            <div className="capacity-footer">
              <span>Installed Total: {overview.dc_ram_total_gib} GiB</span>
              <span className="text-emerald">Reclaims {overview.dc_freed_ram_gib} GiB</span>
            </div>
          </div>

          {/* Storage Bar */}
          <div className="capacity-item">
            <div className="capacity-top">
              <span className="capacity-name">SAN / NAS Storage (Persistent GiB)</span>
              <span className="capacity-stat">
                <strong>{overview.dc_storage_used_gib.toLocaleString('en-IN')}</strong> / {overview.dc_storage_usable_gib.toLocaleString('en-IN')} GiB ({storagePct}%)
              </span>
            </div>
            <div className="progress-track">
              <div
                className={`progress-fill ${storagePct > 80 ? 'critical' : storagePct > 60 ? 'warning' : 'safe'}`}
                style={{ width: `${Math.min(100, storagePct)}%` }}
              ></div>
            </div>
            <div className="capacity-footer">
              <span>Installed Total: {(overview.dc_storage_total_gib / 1000).toFixed(0)} TB</span>
              <span className="text-emerald">Reclaims {(overview.dc_freed_storage_gib / 1000).toFixed(1)} TB</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recommendations & Placements Overview */}
      <div className="two-col-grid">
        <div className="section-card">
          <div className="section-header">
            <div>
              <h3 className="section-title">Optimal Placement Distribution</h3>
              <p className="section-subtitle">Deterministic target environments by residency & workload profile</p>
            </div>
          </div>

          <div className="placement-list">
            <div className="placement-target-card dc">
              <div className="target-top">
                <span className="target-badge dc">Karnataka Private DC (karnataka-dc-1)</span>
                <span className="target-count">2 Workloads (Mission-Critical)</span>
              </div>
              <p className="target-desc">
                Core Banking Ledger DB (RESTRICTED sensitivity, RBI Localization requirement) and Core Transaction API (mandatory co-location &lt;2ms latency).
              </p>
              <div className="target-cost">
                Monthly Retained Spend: <strong>₹71,500</strong>
              </div>
            </div>

            <div className="placement-target-card aws">
              <div className="target-top">
                <span className="target-badge aws">AWS Asia Pacific (aws-ap-south-1 Mumbai)</span>
                <span className="target-count">3 Workloads Recommended</span>
              </div>
              <p className="target-desc">
                Retail Customer Portal (stateless public tier), Document KYC Archive (infrequent access storage tier), and Fintech Dev Sandbox.
              </p>
              <div className="target-cost">
                Projected Cloud Spend: <strong>₹36,340</strong> · Net Savings: <span className="text-emerald">₹24,500/mo</span>
              </div>
            </div>

            <div className="placement-target-card azure">
              <div className="target-top">
                <span className="target-badge azure">Azure Central India (azure-central-india Pune)</span>
                <span className="target-count">1 Workload Recommended</span>
              </div>
              <p className="target-desc">
                Batch Regulatory & Management Reporting Pipeline (benefiting from elastic off-peak scheduling).
              </p>
              <div className="target-cost">
                Projected Cloud Spend: <strong>₹22,220</strong> · Net Savings: <span className="text-emerald">₹12,000/mo</span>
              </div>
            </div>
          </div>
        </div>

        <div className="section-card">
          <div className="section-header">
            <div>
              <h3 className="section-title">Key Placement Decisions & Explanations</h3>
              <p className="section-subtitle">Reviewable in &lt; 2 minutes by an infrastructure lead</p>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={onNavigateToInventory}>
              View All ({recommendations.length})
            </button>
          </div>

          <div className="rec-summary-list">
            {recommendations.slice(0, 4).map((rec) => {
              const workload = workloadsMap.get(rec.workload_id);
              if (!workload) return null;

              return (
                <div
                  key={rec.workload_id}
                  className="rec-summary-item"
                  onClick={() => onSelectWorkload(workload)}
                >
                  <div className="rec-summary-top">
                    <div>
                      <span className="rec-item-title">{workload.name}</span>
                      <span className="rec-item-id">{workload.id}</span>
                    </div>
                    {rec.status === 'CHANGE_RECOMMENDED' ? (
                      <span className="badge badge-success">
                        Save ₹{rec.projected_monthly_savings.toLocaleString('en-IN')}/mo
                      </span>
                    ) : (
                      <span className="badge badge-neutral">Retain in DC</span>
                    )}
                  </div>
                  <p className="rec-item-explanation">{rec.audit_explanation}</p>
                  <div className="rec-item-footer">
                    <span>
                      {rec.current_placement} → <strong>{rec.recommended_placement}</strong>
                    </span>
                    <span className="rec-item-action">Audit Factors →</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
