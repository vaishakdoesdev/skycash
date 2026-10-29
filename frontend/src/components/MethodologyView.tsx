import React from 'react';
import { PrivateDCAssumptions, PublicCloudRegion } from '../types';

interface MethodologyViewProps {
  dc: PrivateDCAssumptions;
  regions: PublicCloudRegion[];
}

export const MethodologyView: React.FC<MethodologyViewProps> = ({ dc, regions }) => {
  return (
    <div className="methodology-container">
      {/* Scope and Non-Negotiable Boundaries */}
      <div className="section-card">
        <div className="section-header">
          <div>
            <h2 className="section-title">Decision Support Scope & Non-Negotiable Boundaries</h2>
            <p className="section-subtitle">
              Strict architectural principles governing the Sky Cash placement evaluation engine
            </p>
          </div>
          <span className="badge badge-success">Local-First · Zero Cloud Credentials</span>
        </div>

        <div className="principles-grid">
          <div className="principle-card">
            <div className="principle-icon">🔒</div>
            <h3 className="principle-title">100% Confidential Local Processing</h3>
            <p className="principle-desc">
              Customer inventory, utilization histories, and financial data remain entirely on local infrastructure.
              No workload metadata is ever uploaded to external cloud endpoints, third-party analytics, or AI services.
            </p>
          </div>

          <div className="principle-card">
            <div className="principle-icon">⚖️</div>
            <h3 className="principle-title">Hard Compliance Priority</h3>
            <p className="principle-desc">
              Data residency and data sensitivity rules are non-negotiable eligibility constraints. A candidate placement
              that offers cost savings is instantly disqualified if it violates geographic or isolation mandates.
            </p>
          </div>

          <div className="principle-card">
            <div className="principle-icon">🔗</div>
            <h3 className="principle-title">Latency & Co-Location Integrity</h3>
            <p className="principle-desc">
              Inter-dependent workloads requiring synchronous communication (&lt;2ms RTT) must remain co-located.
              If an anchor workload is locked to the Karnataka DC, all tightly-coupled companions stay on-premise.
            </p>
          </div>

          <div className="principle-card">
            <div className="principle-icon">🛡️</div>
            <h3 className="principle-title">Pure Decision Support</h3>
            <p className="principle-desc">
              Sky Cash provides transparent, auditable decision support for infrastructure leads. The tool never executes
              automated cloud migrations, modifies live hypervisors, or provisions infrastructure.
            </p>
          </div>
        </div>
      </div>

      {/* Cost Accounting Baselines */}
      <div className="two-col-grid">
        <div className="section-card">
          <div className="section-header">
            <div>
              <h3 className="section-title">Karnataka Private DC Cost Accounting</h3>
              <p className="section-subtitle">Fully burdened amortized cost baseline for {dc.name} ({dc.dc_id})</p>
            </div>
          </div>

          <div className="cost-breakdown-list">
            <div className="cost-rate-item">
              <span>Amortized Compute Rate:</span>
              <strong>₹{dc.amortized_cost_per_cpu_core_month} / vCPU core-month</strong>
            </div>
            <div className="cost-rate-item">
              <span>Amortized Memory Rate:</span>
              <strong>₹{dc.amortized_cost_per_ram_gib_month} / GiB RAM-month</strong>
            </div>
            <div className="cost-rate-item">
              <span>Amortized Persistent Storage:</span>
              <strong>₹{dc.amortized_cost_per_storage_gib_month} / GiB SAN-month</strong>
            </div>
            <div className="cost-rate-item">
              <span>Facility PUE Overhead Multiplier:</span>
              <strong>+{dc.power_cooling_pue_overhead_pct}% (Power & cooling factor)</strong>
            </div>
            <div className="cost-rate-item">
              <span>Baseline Fixed Facility Floor:</span>
              <strong>₹{dc.fixed_monthly_facility_cost.toLocaleString('en-IN')} / month</strong>
            </div>
          </div>
          <p className="text-muted text-xs mt-3">
            {dc.assumptions_notes}
          </p>
        </div>

        <div className="section-card">
          <div className="section-header">
            <div>
              <h3 className="section-title">Approved Sovereign Cloud Regions</h3>
              <p className="section-subtitle">Approved public cloud targets satisfying Indian jurisdiction</p>
            </div>
          </div>

          <div className="cloud-regions-list">
            {regions.map((r) => (
              <div key={r.region_id} className="cloud-region-card">
                <div className="cr-top">
                  <div>
                    <strong>{r.provider} {r.region_name}</strong>
                    <div className="text-xs text-muted">ID: {r.region_id} · Location: {r.location_city}, India</div>
                  </div>
                  <span className="badge badge-success">{r.approval_status}</span>
                </div>

                <div className="cr-rates">
                  <span>vCPU: ₹{r.compute_rate_per_vcpu_month}/mo</span>
                  <span>RAM: ₹{r.memory_rate_per_gib_month}/GiB</span>
                  <span>SSD: ₹{r.storage_ssd_rate_per_gib_month}/GiB</span>
                  <span>Egress: ₹{r.egress_rate_per_gib}/GiB</span>
                </div>

                <div className="cr-rules">
                  <span className="text-xs font-semibold">Eligibility Constraints:</span>
                  <ul className="text-xs">
                    {r.eligibility_rules.map((rule, idx) => (
                      <li key={idx}>{rule}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
