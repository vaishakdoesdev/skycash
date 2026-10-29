import React, { useState, useMemo } from 'react';
import { Workload, PlacementRecommendation, DependencyGraph } from '../types';
import { WorkloadPlacement3DScene } from './3d/WorkloadPlacement3DScene';

interface WorkloadInventoryScreenProps {
  workloads: Workload[];
  recommendations: PlacementRecommendation[];
  depGraph: DependencyGraph | null;
  onBackToAnalysis: () => void;
  onNavigateToTrends: () => void;
  onLoadDemoData?: () => void;
  onOpenUploader?: () => void;
}

export const WorkloadInventoryScreen: React.FC<WorkloadInventoryScreenProps> = ({
  workloads,
  recommendations,
  depGraph,
  onBackToAnalysis,
  onNavigateToTrends,
  onLoadDemoData,
  onOpenUploader,
}) => {
  const [selectedWorkloadId, setSelectedWorkloadId] = useState<string | null>(
    workloads.length > 0 ? workloads[0].id : null
  );
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [locationFilter, setLocationFilter] = useState<'ALL' | 'LOCAL_DC' | 'PUBLIC_CLOUD'>('ALL');

  // Map recommendations by workload_id for quick O(1) lookup
  const recMap = useMemo(() => {
    const map = new Map<string, PlacementRecommendation>();
    recommendations.forEach((r) => map.set(r.workload_id, r));
    return map;
  }, [recommendations]);

  // Filter workloads
  const filteredWorkloads = useMemo(() => {
    return workloads.filter((w) => {
      // Search matching
      const matchesSearch =
        w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        w.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (w.tags && Object.values(w.tags).some((t) => t.toLowerCase().includes(searchQuery.toLowerCase())));

      if (!matchesSearch) return false;

      // Location filtering
      const isLocal = w.current_placement.includes('karnataka') || w.current_placement.includes('dc');
      if (locationFilter === 'LOCAL_DC') return isLocal;
      if (locationFilter === 'PUBLIC_CLOUD') return !isLocal;
      return true;
    });
  }, [workloads, searchQuery, locationFilter]);

  const selectedWorkload = useMemo(() => {
    if (!selectedWorkloadId) return null;
    return workloads.find((w) => w.id === selectedWorkloadId) || null;
  }, [workloads, selectedWorkloadId]);

  const selectedRec = useMemo(() => {
    if (!selectedWorkloadId) return null;
    return recMap.get(selectedWorkloadId) || null;
  }, [recMap, selectedWorkloadId]);

  // Dependencies for selected workload
  const selectedDependencies = useMemo(() => {
    if (!selectedWorkloadId || !depGraph) return [];
    return depGraph.edges.filter(
      (e) => e.source_workload_id === selectedWorkloadId || e.target_workload_id === selectedWorkloadId
    );
  }, [selectedWorkloadId, depGraph]);

  return (
    <div className="inventory-page-container">
      {/* Top Progress & Navigation Header */}
      <nav className="inventory-top-nav">
        <div className="inventory-nav-left">
          <button
            type="button"
            className="btn-nav-return"
            onClick={onBackToAnalysis}
            title="Return to Capacity Assessment"
          >
            ← Back to Capacity Analysis
          </button>
          <span className="nav-divider">/</span>
          <span className="nav-current-title">Workload Inventory Catalog</span>
        </div>

        <div className="inventory-nav-right">
          {onOpenUploader && (
            <button
              type="button"
              className="btn-nav-action-trends"
              style={{
                marginRight: '0.75rem',
                background: 'rgba(72, 217, 208, 0.15)',
                borderColor: '#48d9d0',
                color: '#48d9d0',
              }}
              onClick={onOpenUploader}
              title="Upload custom workload inventory JSON"
            >
              <span>📂 Load Inventory</span>
            </button>
          )}
          <button
            type="button"
            className="btn-nav-action-trends"
            onClick={onNavigateToTrends}
            title="Open Screen 4: Trends & Comparison"
          >
            <span>📈 Trends & Comparison →</span>
          </button>
        </div>
      </nav>

      {/* Main Page Header & Explanation */}
      <header className="inventory-hero-banner">
        <div className="inventory-hero-content">
          <div className="inventory-badge-row">
            <span className="inventory-status-pill">
              <span className="pulse-dot teal" />
              <span>Catalog Audit Mode</span>
            </span>
            <span className="inventory-count-pill">{workloads.length} Registered Workloads</span>
          </div>

          <h1 className="inventory-page-heading">Evaluated Workload Inventory</h1>
          <p className="inventory-explanation-text">
            Workload Inventory lists the applications and services being evaluated by SkyCash. Select a
            workload to inspect its resource requirements, hosting location, and available placement
            information.
          </p>
        </div>
      </header>

      {/* Empty State fallback */}
      {workloads.length === 0 ? (
        <div className="inventory-empty-state-card">
          <div className="empty-icon">📂</div>
          <h3>No Workloads Available in Local Session</h3>
          <p>
            No active workloads are currently loaded in browser memory. Load the standard illustrative demo
            dataset to inspect workload specifications and dependency placements.
          </p>
          {onLoadDemoData && (
            <button type="button" className="btn-load-demo-data" onClick={onLoadDemoData}>
              ✨ Load Illustrative Demo Workloads
            </button>
          )}
        </div>
      ) : (
        <div className="inventory-layout-grid">
          {/* Top/Left Section: 3D Workload Placement Visualizer */}
          <div className="inventory-3d-section">
            <div className="inventory-card 3d-card">
              <div className="card-title-bar">
                <div className="title-group">
                  <span className="pulse-dot teal" />
                  <h3>Interactive 3D Placement Map</h3>
                </div>
                <span className="card-sub-tag">Visual Topology</span>
              </div>

              <WorkloadPlacement3DScene
                workloads={workloads}
                selectedWorkloadId={selectedWorkloadId}
                onSelectWorkload={(id) => setSelectedWorkloadId(id)}
              />
            </div>

            {/* Filter and Search Bar */}
            <div className="inventory-filter-toolbar">
              <div className="search-input-box">
                <span className="search-icon">🔍</span>
                <input
                  type="text"
                  placeholder="Search workloads by name, ID, or tier..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button type="button" className="clear-search-btn" onClick={() => setSearchQuery('')}>
                    ✕
                  </button>
                )}
              </div>

              <div className="filter-pill-group">
                <button
                  type="button"
                  className={`filter-pill ${locationFilter === 'ALL' ? 'active' : ''}`}
                  onClick={() => setLocationFilter('ALL')}
                >
                  All ({workloads.length})
                </button>
                <button
                  type="button"
                  className={`filter-pill ${locationFilter === 'LOCAL_DC' ? 'active' : ''}`}
                  onClick={() => setLocationFilter('LOCAL_DC')}
                >
                  Karnataka DC
                </button>
                <button
                  type="button"
                  className={`filter-pill ${locationFilter === 'PUBLIC_CLOUD' ? 'active' : ''}`}
                  onClick={() => setLocationFilter('PUBLIC_CLOUD')}
                >
                  Cloud Regions
                </button>
              </div>
            </div>

            {/* Workload Cards List */}
            <div className="workload-cards-list">
              {filteredWorkloads.map((w) => {
                const isSelected = w.id === selectedWorkloadId;
                const rec = recMap.get(w.id);
                const isLocal = w.current_placement.includes('karnataka') || w.current_placement.includes('dc');

                return (
                  <div
                    key={w.id}
                    className={`workload-item-card ${isSelected ? 'selected' : ''}`}
                    onClick={() => setSelectedWorkloadId(w.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedWorkloadId(w.id);
                      }
                    }}
                  >
                    <div className="item-card-top">
                      <div className="item-title-col">
                        <span className="item-id-tag">{w.id}</span>
                        <h4 className="item-name">{w.name}</h4>
                      </div>
                      <span className={`item-location-badge ${isLocal ? 'local' : 'cloud'}`}>
                        {isLocal ? '🏢 Karnataka DC' : '☁️ Cloud Hosted'}
                      </span>
                    </div>

                    <div className="item-specs-row">
                      <div className="spec-metric">
                        <span className="spec-label">Compute</span>
                        <span className="spec-val">{w.allocated_cpu_cores} vCPU</span>
                      </div>
                      <div className="spec-metric">
                        <span className="spec-label">Memory</span>
                        <span className="spec-val">{w.allocated_ram_gib} GB</span>
                      </div>
                      <div className="spec-metric">
                        <span className="spec-label">Monthly Cost</span>
                        <span className="spec-val">
                          {rec ? `₹ ${rec.current_monthly_cost.toLocaleString('en-IN')}` : 'Estimated'}
                        </span>
                      </div>
                      <div className="spec-metric">
                        <span className="spec-label">Review Status</span>
                        <span className={`status-pill ${rec?.status === 'NO_CHANGE' ? 'retained' : 'migrated'}`}>
                          {rec?.status === 'NO_CHANGE' ? 'Retained in DC' : 'Cloud Eligible'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}

              {filteredWorkloads.length === 0 && (
                <div className="no-matches-box">
                  <p>No workloads match the search filter "{searchQuery}".</p>
                  <button type="button" className="btn-text-action" onClick={() => setSearchQuery('')}>
                    Clear Filter
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Right Section: Selected Workload Inspection Panel */}
          <aside className="inventory-detail-column">
            {selectedWorkload ? (
              <div className="inventory-card detail-card">
                <div className="detail-card-header">
                  <span className="detail-pretitle">Selected Workload Inspection</span>
                  <h3 className="detail-title">{selectedWorkload.name}</h3>
                  <span className="detail-id-badge">{selectedWorkload.id}</span>
                </div>

                <div className="detail-specs-grid">
                  <div className="detail-spec-box">
                    <span className="spec-label">Allocated CPU</span>
                    <span className="spec-number teal">{selectedWorkload.allocated_cpu_cores} vCPU</span>
                  </div>
                  <div className="detail-spec-box">
                    <span className="spec-label">Allocated RAM</span>
                    <span className="spec-number blue">{selectedWorkload.allocated_ram_gib} GB</span>
                  </div>
                  <div className="detail-spec-box">
                    <span className="spec-label">Storage</span>
                    <span className="spec-number">
                      {selectedWorkload.allocated_storage_gib} GB ({selectedWorkload.storage_tier || 'Standard'})
                    </span>
                  </div>
                  <div className="detail-spec-box">
                    <span className="spec-label">Monthly Spend</span>
                    <span className="spec-number highlight">
                      {selectedRec ? `₹ ${selectedRec.current_monthly_cost.toLocaleString('en-IN')}` : '—'}
                    </span>
                  </div>
                </div>

                {/* Placement Recommendation Details */}
                <div className="detail-section-block">
                  <h4 className="section-mini-heading">Placement & Decision Status</h4>
                  <div className="placement-status-banner">
                    <div className="status-indicator-icon">
                      {selectedRec?.status === 'NO_CHANGE' ? '🛡️' : '🚀'}
                    </div>
                    <div>
                      <div className="status-title">
                        {selectedRec?.status === 'NO_CHANGE'
                          ? 'Retained on Karnataka Private DC'
                          : 'Recommended for Sovereign Cloud Offload'}
                      </div>
                      <div className="status-location-detail">
                        Current: <strong>{selectedWorkload.current_placement}</strong> → Recommended:{' '}
                        <strong>{selectedRec?.recommended_placement || selectedWorkload.current_placement}</strong>
                      </div>
                    </div>
                  </div>

                  {selectedRec?.audit_explanation && (
                    <div className="audit-explanation-quote">
                      <strong>Decision Rationale:</strong> {selectedRec.audit_explanation}
                    </div>
                  )}
                </div>

                {/* Compliance & Data Sensitivity */}
                <div className="detail-section-block">
                  <h4 className="section-mini-heading">Compliance & Residency Rules</h4>
                  <div className="compliance-tags-list">
                    <span className="compliance-pill sensitivity">
                      Sensitivity: {selectedWorkload.data_sensitivity}
                    </span>
                    <span className="compliance-pill residency">
                      Residency: {selectedWorkload.residency_requirement}
                    </span>
                    {selectedWorkload.required_certifications?.map((cert, idx) => (
                      <span key={idx} className="compliance-pill cert">
                        {cert}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Dependencies */}
                <div className="detail-section-block">
                  <h4 className="section-mini-heading">Service Dependencies</h4>
                  {selectedDependencies.length > 0 ? (
                    <ul className="dependency-items-list">
                      {selectedDependencies.map((dep) => {
                        const isSource = dep.source_workload_id === selectedWorkload.id;
                        const partnerId = isSource ? dep.target_workload_id : dep.source_workload_id;
                        return (
                          <li key={dep.id} className="dep-item">
                            <span className="dep-type-pill">{dep.relationship_type}</span>
                            <span className="dep-partner">
                              {isSource ? 'Connected to ' : 'Linked from '}
                              <strong>{partnerId}</strong>
                            </span>
                            {dep.is_mandatory && <span className="dep-mandatory-badge">Mandatory Co-Location</span>}
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="dep-empty-text">No hard service dependencies registered for this workload.</p>
                  )}
                </div>

                {/* Operational Notes */}
                {selectedWorkload.notes && (
                  <div className="detail-section-block">
                    <h4 className="section-mini-heading">Operational Context</h4>
                    <p className="workload-notes-text">{selectedWorkload.notes}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="inventory-card detail-card empty-selection">
                <div className="empty-selection-icon">👈</div>
                <h4>Select a Workload to Inspect</h4>
                <p>Click on any workload in the catalog or 3D map to view specifications and placement rules.</p>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
};
