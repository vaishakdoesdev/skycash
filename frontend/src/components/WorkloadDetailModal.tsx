import React from 'react';
import {
  Workload,
  PlacementRecommendation,
  PrivateDCAssumptions,
  PublicCloudRegion,
  DependencyGraph,
  UtilisationHistory,
} from '../types';
import { PlacementDecisionEngine } from '../services/engine';

interface WorkloadDetailModalProps {
  workload: Workload | null;
  recommendation: PlacementRecommendation | null;
  dc: PrivateDCAssumptions;
  regions: PublicCloudRegion[];
  depGraph: DependencyGraph;
  allWorkloads: Workload[];
  utilisationHistory: UtilisationHistory[];
  onClose: () => void;
}

export const WorkloadDetailModal: React.FC<WorkloadDetailModalProps> = ({
  workload,
  recommendation,
  dc,
  regions,
  depGraph,
  allWorkloads,
  utilisationHistory,
  onClose,
}) => {
  if (!workload || !recommendation) return null;

  const workloadsMap = new Map<string, Workload>(allWorkloads.map((w) => [w.id, w]));
  const history = utilisationHistory.find((h) => h.workload_id === workload.id);

  // Evaluate all candidate targets
  const candidateEvaluations = regions.map((region) => {
    const { isEligible, violations } = PlacementDecisionEngine.evaluatePlacementEligibility(
      workload,
      region,
      depGraph,
      workloadsMap
    );
    const cost = PlacementDecisionEngine.calculateCloudRegionCost(workload, region);

    return {
      region,
      isEligible,
      violations,
      cost,
    };
  });

  const isChange = recommendation.status === 'CHANGE_RECOMMENDED';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <div className="modal-title-group">
            <div className="modal-badge-row">
              <span className={`badge-env ${workload.environment.toLowerCase()}`}>
                {workload.environment}
              </span>
              <span className="badge badge-neutral">{workload.id}</span>
              {recommendation.co_location_group_id && (
                <span className="badge badge-colocation">
                  🔗 Co-Location Group: {recommendation.co_location_group_id}
                </span>
              )}
            </div>
            <h2 className="modal-title">{workload.name}</h2>
            <div className="modal-placement-row">
              Current Location: <strong>{workload.current_placement}</strong> → Recommended Target:{' '}
              <strong className={isChange ? 'text-emerald' : ''}>
                {recommendation.recommended_placement}
              </strong>
            </div>
          </div>

          <div className="modal-header-actions">
            {isChange ? (
              <div className="modal-savings-pill">
                Save ₹{recommendation.projected_monthly_savings.toLocaleString('en-IN')}/month
              </div>
            ) : (
              <div className="modal-retain-pill">Retained in Private DC</div>
            )}
            <button className="close-btn" onClick={onClose}>
              ✕
            </button>
          </div>
        </div>

        <div className="modal-body">
          {/* Hardware Allocation & Utilisation Grid */}
          <div className="detail-section">
            <h3 className="detail-subtitle">Allocated Capacity & Historical Utilization</h3>
            <div className="resource-grid">
              <div className="resource-box">
                <span className="res-label">vCPU Cores</span>
                <span className="res-val">{workload.allocated_cpu_cores} cores</span>
                {history && (
                  <span className="res-meta">
                    Avg Util: <strong>{history.cpu_utilization_pct}%</strong> (Peak {history.cpu_peak_pct ?? '-'}%)
                  </span>
                )}
              </div>

              <div className="resource-box">
                <span className="res-label">Memory (RAM)</span>
                <span className="res-val">{workload.allocated_ram_gib} GiB</span>
                {history && (
                  <span className="res-meta">
                    Avg Util: <strong>{history.ram_utilization_pct}%</strong> ({history.ram_used_gib} GiB used)
                  </span>
                )}
              </div>

              <div className="resource-box">
                <span className="res-label">Storage Capacity</span>
                <span className="res-val">
                  {workload.allocated_storage_gib.toLocaleString('en-IN')} GiB
                </span>
                <span className="res-meta">Tier: {workload.storage_tier || 'SSD'}</span>
              </div>

              <div className="resource-box">
                <span className="res-label">Certifications & Soft Prefs</span>
                <span className="res-val">
                  {workload.required_certifications.length > 0
                    ? workload.required_certifications.join(', ')
                    : 'Standard'}
                </span>
                <span className="res-meta">
                  {workload.soft_preferences?.preferred_provider
                    ? `Prefers: ${workload.soft_preferences.preferred_provider}`
                    : 'Provider Agnostic'}
                </span>
              </div>
            </div>
          </div>

          {/* Deterministic Compliance Gateways */}
          <div className="detail-section">
            <h3 className="detail-subtitle">Deterministic Compliance Gateways (Hard Eligibility)</h3>
            <p className="detail-desc">
              Non-negotiable constraints evaluated prior to cost modeling. A breach in any gateway strictly disqualifies the candidate placement.
            </p>

            <div className="gateways-list">
              {/* Gate 1: Geographic Data Residency */}
              <div className="gateway-card">
                <div className="gw-icon success">✓</div>
                <div className="gw-content">
                  <div className="gw-header">
                    <span className="gw-name">Gateway 1: Geographic Data Residency Mandate</span>
                    <span className="badge badge-karnataka">
                      {workload.residency_requirement.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <p className="gw-desc">
                    {workload.residency_requirement === 'KARNATAKA_DC_ONLY' &&
                      'Workload strictly requires in-state physical infrastructure inside Karnataka under regulatory banking requirements. Prohibits any public cloud placement.'}
                    {workload.residency_requirement === 'INDIA_ONLY' &&
                      'Workload requires sovereign data storage within Republic of India borders. Approved Indian cloud regions (Mumbai, Pune) satisfy this mandate.'}
                    {workload.residency_requirement === 'ANY_APPROVED_REGION' &&
                      'Workload has no localized physical boundary constraints and may be placed in any approved sovereign cloud region.'}
                  </p>
                </div>
              </div>

              {/* Gate 2: Data Sensitivity Isolation */}
              <div className="gateway-card">
                <div className="gw-icon success">✓</div>
                <div className="gw-content">
                  <div className="gw-header">
                    <span className="gw-name">Gateway 2: Data Sensitivity & Classification</span>
                    <span className={`badge ${workload.data_sensitivity === 'RESTRICTED' ? 'badge-restricted' : 'badge-confidential'}`}>
                      {workload.data_sensitivity}
                    </span>
                  </div>
                  <p className="gw-desc">
                    {workload.data_sensitivity === 'RESTRICTED' &&
                      'Data classification is RESTRICTED. Corporate security and regulatory policy mandate dedicated, air-gapped private hardware isolation in Karnataka DC.'}
                    {workload.data_sensitivity === 'CONFIDENTIAL' &&
                      'Data classification is CONFIDENTIAL. Approved sovereign cloud providers with ISO27001 and SOC2 certifications are permitted.'}
                    {(workload.data_sensitivity === 'INTERNAL' || workload.data_sensitivity === 'PUBLIC') &&
                      'Data classification permits standard multi-tenant approved public cloud hosting with default encryption in transit and at rest.'}
                  </p>
                </div>
              </div>

              {/* Gate 3: Co-Location and Latency Enclosure */}
              <div className="gateway-card">
                <div className="gw-icon success">✓</div>
                <div className="gw-content">
                  <div className="gw-header">
                    <span className="gw-name">Gateway 3: Co-Location & Latency Enclosure</span>
                    <span className="badge badge-colocation">
                      {recommendation.co_location_group_id ? 'Mandatory Co-Location' : 'Independent Node'}
                    </span>
                  </div>
                  <p className="gw-desc">
                    {recommendation.co_location_group_id ? (
                      <>
                        Enclosed in <strong>{recommendation.co_location_group_id}</strong> alongside companion workload(s):{' '}
                        {recommendation.co_located_workload_ids.join(', ')}. All companion workloads must reside in the exact same physical location to preserve synchronous low-latency performance.
                      </>
                    ) : (
                      'Workload has no mandatory co-location companions and can be migrated independently without latency disruption.'
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Audit Explanation Section */}
          <div className="detail-section">
            <h3 className="detail-subtitle">Audit Explanation & Rationales</h3>
            <div className="audit-box">
              <div className="audit-text">{recommendation.audit_explanation}</div>

              <div className="audit-factors">
                <span className="factors-label">Driving Factors:</span>
                <ul>
                  {recommendation.factors.map((factor, idx) => (
                    <li key={idx}>{factor}</li>
                  ))}
                </ul>
              </div>

              <div className="audit-assumptions">
                <span className="factors-label">Operational Assumptions:</span>
                <ul>
                  {recommendation.assumptions.map((asm, idx) => (
                    <li key={idx}>{asm}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Cost Comparison Breakdown */}
          <div className="detail-section">
            <h3 className="detail-subtitle">Cost Comparison Breakdown</h3>
            <div className="cost-comparison-card">
              <div className="cost-col">
                <span className="cost-col-title">Current Location ({workload.current_placement})</span>
                <span className="cost-big-num">
                  ₹{recommendation.current_monthly_cost.toLocaleString('en-IN')}
                  <small>/month</small>
                </span>
                <p className="cost-col-desc">
                  Based on amortized facility rate (₹{dc.amortized_cost_per_cpu_core_month}/vCPU, ₹{dc.amortized_cost_per_ram_gib_month}/GiB RAM, ₹{dc.amortized_cost_per_storage_gib_month}/GiB storage + 15% PUE).
                </p>
              </div>

              <div className="cost-vs">vs</div>

              <div className="cost-col">
                <span className="cost-col-title">
                  Recommended Target ({recommendation.recommended_placement})
                </span>
                <span className="cost-big-num text-emerald">
                  ₹{recommendation.recommended_monthly_cost.toLocaleString('en-IN')}
                  <small>/month</small>
                </span>
                <p className="cost-col-desc">
                  {isChange
                    ? 'Cloud PAYG standard on-demand rate including compute, memory, tiered storage, and estimated network egress.'
                    : 'Retained in Karnataka DC as lowest fully burdened compliant run cost.'}
                </p>
              </div>
            </div>
          </div>

          {/* Alternative Candidate Placements Evaluated */}
          <div className="detail-section">
            <h3 className="detail-subtitle">Candidate Cloud Placements Evaluated</h3>
            <div className="table-card">
              <table className="workload-table">
                <thead>
                  <tr>
                    <th>Candidate Location</th>
                    <th>Jurisdiction</th>
                    <th>Compliance Gate</th>
                    <th>Projected Monthly Cost</th>
                    <th>Engine Evaluation Outcome</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className={recommendation.recommended_placement === dc.dc_id ? 'row-selected' : ''}>
                    <td>
                      <strong>{dc.name}</strong> ({dc.dc_id})
                    </td>
                    <td>Karnataka, India</td>
                    <td>
                      <span className="badge badge-success">Passed All Gates</span>
                    </td>
                    <td>₹{recommendation.current_monthly_cost.toLocaleString('en-IN')}</td>
                    <td>
                      {recommendation.recommended_placement === dc.dc_id ? (
                        <span className="text-emerald font-semibold">Recommended Placement</span>
                      ) : (
                        <span className="text-muted">Higher Amortized Spend</span>
                      )}
                    </td>
                  </tr>

                  {candidateEvaluations.map(({ region, isEligible, violations, cost }) => {
                    const isSelected = recommendation.recommended_placement === region.region_id;

                    return (
                      <tr key={region.region_id} className={isSelected ? 'row-selected' : ''}>
                        <td>
                          <strong>{region.provider} {region.region_name}</strong> ({region.region_id})
                        </td>
                        <td>{region.location_city}, India</td>
                        <td>
                          {isEligible ? (
                            <span className="badge badge-success">Eligible</span>
                          ) : (
                            <span className="badge badge-restricted">Disqualified</span>
                          )}
                        </td>
                        <td>₹{cost.toLocaleString('en-IN')}</td>
                        <td>
                          {isSelected ? (
                            <span className="text-emerald font-semibold">
                              Recommended (Saves ₹{recommendation.projected_monthly_savings.toLocaleString('en-IN')})
                            </span>
                          ) : violations.length > 0 ? (
                            <span className="text-danger text-xs">{violations[0].description}</span>
                          ) : (
                            <span className="text-muted">Alternative Eligible Target</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <div className="modal-footer-disclaimer">
            Decision support recommendation only · No cloud credentials required · No migration actions executed
          </div>
          <button className="btn btn-secondary" onClick={onClose}>
            Close Audit
          </button>
        </div>
      </div>
    </div>
  );
};
