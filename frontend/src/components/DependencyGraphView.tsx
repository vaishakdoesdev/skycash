import React, { useState } from 'react';
import { DependencyGraph, Workload, PlacementRecommendation } from '../types';

interface DependencyGraphViewProps {
  depGraph: DependencyGraph;
  workloads: Workload[];
  recommendations: PlacementRecommendation[];
  onSelectWorkload: (workload: Workload) => void;
}

export const DependencyGraphView: React.FC<DependencyGraphViewProps> = ({
  depGraph,
  workloads,
  recommendations,
  onSelectWorkload,
}) => {
  const [selectedWorkloadId, setSelectedWorkloadId] = useState<string>('wl-core-banking-db');

  const workloadsMap = new Map<string, Workload>(workloads.map((w) => [w.id, w]));
  const recsMap = new Map<string, PlacementRecommendation>(recommendations.map((r) => [r.workload_id, r]));

  const selectedWorkload = workloadsMap.get(selectedWorkloadId);

  // Relationships involving the selected workload
  const incomingEdges = depGraph.edges.filter((e) => e.target_workload_id === selectedWorkloadId);
  const outgoingEdges = depGraph.edges.filter((e) => e.source_workload_id === selectedWorkloadId);

  return (
    <div className="dependencies-container">
      {/* Intro Card */}
      <div className="section-card">
        <div className="section-header">
          <div>
            <h2 className="section-title">Workload Dependency & Co-Location Architecture</h2>
            <p className="section-subtitle">
              Ensures synchronous low-latency services are never separated across wide-area network boundaries
            </p>
          </div>
          <span className="badge badge-colocation">Co-Location Enclosure Active</span>
        </div>

        {/* Co-Location Group Highlight Callout */}
        <div className="colocation-callout">
          <div className="callout-header">
            <span className="callout-icon">🔗</span>
            <div>
              <div className="callout-title">
                Critical Co-Location Enclosure: <strong>group-core-banking</strong>
              </div>
              <div className="callout-subtitle">
                Mandatory same-chassis / local LAN placement enforced between Transaction API and Ledger DB
              </div>
            </div>
          </div>
          <p className="callout-text">
            <strong>wl-core-banking-api</strong> initiates high-frequency synchronous SQL transactions to{' '}
            <strong>wl-core-banking-db</strong> with a maximum tolerable latency ceiling of <strong>2.0 ms</strong>.
            Even though the API component itself has lower data sensitivity, the decision engine strictly anchors it
            to Karnataka Private DC to satisfy the co-location mandate.
          </p>
          <div className="callout-nodes">
            <div className="callout-node-item" onClick={() => setSelectedWorkloadId('wl-core-banking-api')}>
              <span>wl-core-banking-api</span>
              <span className="badge-placement dc">Karnataka DC</span>
            </div>
            <span className="callout-arrow">⇄ (2.0 ms RTT) ⇄</span>
            <div className="callout-node-item" onClick={() => setSelectedWorkloadId('wl-core-banking-db')}>
              <span>wl-core-banking-db</span>
              <span className="badge-placement dc">Karnataka DC</span>
            </div>
          </div>
        </div>
      </div>

      {/* Two Column Layout: Node Selector & Connection Details */}
      <div className="two-col-grid">
        {/* Left: Workload Nodes List */}
        <div className="section-card">
          <div className="section-header">
            <div>
              <h3 className="section-title">Workload Nodes ({workloads.length})</h3>
              <p className="section-subtitle">Click a workload to inspect its network relationships</p>
            </div>
          </div>

          <div className="nodes-list">
            {workloads.map((w) => {
              const rec = recsMap.get(w.id);
              const isSelected = w.id === selectedWorkloadId;
              const hasColocation = depGraph.co_location_groups['group-core-banking']?.includes(w.id);

              return (
                <div
                  key={w.id}
                  className={`node-card ${isSelected ? 'active' : ''}`}
                  onClick={() => setSelectedWorkloadId(w.id)}
                >
                  <div className="node-top">
                    <span className="node-title">{w.name}</span>
                    <span className={`badge-placement ${rec?.status === 'CHANGE_RECOMMENDED' ? 'cloud' : 'dc'}`}>
                      {rec?.recommended_placement || w.current_placement}
                    </span>
                  </div>
                  <div className="node-meta">
                    <code>{w.id}</code>
                    {hasColocation && <span className="badge badge-colocation">Co-Located</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Relationship Detail Panel */}
        <div className="section-card">
          {selectedWorkload ? (
            <div>
              <div className="section-header">
                <div>
                  <h3 className="section-title">{selectedWorkload.name}</h3>
                  <p className="section-subtitle">
                    Dependencies & network boundaries for <code>{selectedWorkload.id}</code>
                  </p>
                </div>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => onSelectWorkload(selectedWorkload)}
                >
                  Open Full Audit
                </button>
              </div>

              {/* Incoming Callers */}
              <div className="dep-group">
                <h4 className="dep-group-title">Upstream Callers (Depend on this workload)</h4>
                {incomingEdges.length > 0 ? (
                  <div className="edge-list">
                    {incomingEdges.map((edge) => {
                      const caller = workloadsMap.get(edge.source_workload_id);
                      return (
                        <div key={edge.id} className="edge-card">
                          <div className="edge-top">
                            <strong>{caller?.name || edge.source_workload_id}</strong>
                            <span className={`badge ${edge.is_mandatory ? 'badge-restricted' : 'badge-neutral'}`}>
                              {edge.relationship_type}
                            </span>
                          </div>
                          <p className="edge-notes">{edge.notes}</p>
                          <div className="edge-meta">
                            <span>Max Tolerable Latency: <strong>{edge.max_tolerable_latency_ms ?? '-'} ms</strong></span>
                            <span>Exchange Volume: <strong>{edge.data_exchange_gb_per_month ?? '-'} GB/mo</strong></span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-muted text-sm">No direct upstream callers identified in graph.</p>
                )}
              </div>

              {/* Outgoing Dependencies */}
              <div className="dep-group">
                <h4 className="dep-group-title">Downstream Dependencies (This workload depends on)</h4>
                {outgoingEdges.length > 0 ? (
                  <div className="edge-list">
                    {outgoingEdges.map((edge) => {
                      const target = workloadsMap.get(edge.target_workload_id);
                      return (
                        <div key={edge.id} className="edge-card">
                          <div className="edge-top">
                            <strong>{target?.name || edge.target_workload_id}</strong>
                            <span className={`badge ${edge.is_mandatory ? 'badge-restricted' : 'badge-neutral'}`}>
                              {edge.relationship_type}
                            </span>
                          </div>
                          <p className="edge-notes">{edge.notes}</p>
                          <div className="edge-meta">
                            <span>Max Tolerable Latency: <strong>{edge.max_tolerable_latency_ms ?? '-'} ms</strong></span>
                            <span>Exchange Volume: <strong>{edge.data_exchange_gb_per_month ?? '-'} GB/mo</strong></span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-muted text-sm">No downstream workload dependencies (Terminal node).</p>
                )}
              </div>

              {/* All Defined Edges Table */}
              <div className="dep-group">
                <h4 className="dep-group-title">All Estate Graph Edges ({depGraph.edges.length})</h4>
                <div className="table-card">
                  <table className="workload-table">
                    <thead>
                      <tr>
                        <th>Source Workload</th>
                        <th>Target Workload</th>
                        <th>Coupling Type</th>
                        <th>Mandatory</th>
                        <th>Max Latency</th>
                      </tr>
                    </thead>
                    <tbody>
                      {depGraph.edges.map((e) => (
                        <tr key={e.id}>
                          <td>{e.source_workload_id}</td>
                          <td>{e.target_workload_id}</td>
                          <td>{e.relationship_type}</td>
                          <td>
                            {e.is_mandatory ? (
                              <span className="badge badge-restricted">Mandatory</span>
                            ) : (
                              <span className="text-muted">Soft Preference</span>
                            )}
                          </td>
                          <td>{e.max_tolerable_latency_ms ? `${e.max_tolerable_latency_ms} ms` : 'Unconstrained'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-muted">Select a workload node from the left panel to inspect its relationships.</p>
          )}
        </div>
      </div>
    </div>
  );
};
