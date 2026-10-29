import React, { useState, useMemo } from 'react';
import { Workload, PlacementRecommendation, DataSensitivity, DataResidencyRequirement } from '../types';

interface WorkloadInventoryProps {
  workloads: Workload[];
  recommendations: PlacementRecommendation[];
  onSelectWorkload: (workload: Workload) => void;
}

export const WorkloadInventory: React.FC<WorkloadInventoryProps> = ({
  workloads,
  recommendations,
  onSelectWorkload,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [envFilter, setEnvFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [sensitivityFilter, setSensitivityFilter] = useState<string>('ALL');
  const [residencyFilter, setResidencyFilter] = useState<string>('ALL');

  const recMap = useMemo(
    () => new Map<string, PlacementRecommendation>(recommendations.map((r) => [r.workload_id, r])),
    [recommendations]
  );

  const filteredWorkloads = useMemo(() => {
    return workloads.filter((w) => {
      // Search text filter
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesName = w.name.toLowerCase().includes(query);
        const matchesId = w.id.toLowerCase().includes(query);
        const matchesNotes = w.notes?.toLowerCase().includes(query) ?? false;
        if (!matchesName && !matchesId && !matchesNotes) return false;
      }

      // Environment filter
      if (envFilter !== 'ALL' && w.environment.toLowerCase() !== envFilter.toLowerCase()) {
        return false;
      }

      // Sensitivity filter
      if (sensitivityFilter !== 'ALL' && w.data_sensitivity !== sensitivityFilter) {
        return false;
      }

      // Residency filter
      if (residencyFilter !== 'ALL' && w.residency_requirement !== residencyFilter) {
        return false;
      }

      // Recommendation status filter
      if (statusFilter !== 'ALL') {
        const rec = recMap.get(w.id);
        if (statusFilter === 'CHANGE' && rec?.status !== 'CHANGE_RECOMMENDED') {
          return false;
        }
        if (statusFilter === 'RETAIN' && rec?.status !== 'NO_CHANGE') {
          return false;
        }
      }

      return true;
    });
  }, [workloads, recMap, searchTerm, envFilter, statusFilter, sensitivityFilter, residencyFilter]);

  const getSensitivityClass = (sensitivity: DataSensitivity) => {
    switch (sensitivity) {
      case 'RESTRICTED':
        return 'badge-restricted';
      case 'CONFIDENTIAL':
        return 'badge-confidential';
      case 'INTERNAL':
        return 'badge-internal';
      case 'PUBLIC':
        return 'badge-public';
      default:
        return 'badge-neutral';
    }
  };

  const getResidencyClass = (residency: DataResidencyRequirement) => {
    switch (residency) {
      case 'KARNATAKA_DC_ONLY':
        return 'badge-karnataka';
      case 'INDIA_ONLY':
        return 'badge-india';
      case 'ANY_APPROVED_REGION':
        return 'badge-any';
      default:
        return 'badge-neutral';
    }
  };

  return (
    <div className="inventory-container">
      {/* Search and Filters Header */}
      <div className="filter-panel">
        <div className="search-box">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search workloads by ID, name, keywords, or notes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button className="clear-btn" onClick={() => setSearchTerm('')}>
              ×
            </button>
          )}
        </div>

        <div className="filters-row">
          <div className="filter-group">
            <label>Environment:</label>
            <select value={envFilter} onChange={(e) => setEnvFilter(e.target.value)}>
              <option value="ALL">All Environments</option>
              <option value="production">Production</option>
              <option value="staging">Staging</option>
              <option value="development">Development</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Recommendation:</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="ALL">All Outcomes</option>
              <option value="CHANGE">Change Recommended (Save ₹)</option>
              <option value="RETAIN">Retain in Private DC</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Sensitivity:</label>
            <select value={sensitivityFilter} onChange={(e) => setSensitivityFilter(e.target.value)}>
              <option value="ALL">All Sensitivities</option>
              <option value="RESTRICTED">Restricted (DC Only)</option>
              <option value="CONFIDENTIAL">Confidential</option>
              <option value="INTERNAL">Internal</option>
              <option value="PUBLIC">Public</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Residency Mandate:</label>
            <select value={residencyFilter} onChange={(e) => setResidencyFilter(e.target.value)}>
              <option value="ALL">All Residency Rules</option>
              <option value="KARNATAKA_DC_ONLY">Karnataka DC Only</option>
              <option value="INDIA_ONLY">India Sovereign Only</option>
              <option value="ANY_APPROVED_REGION">Any Approved Region</option>
            </select>
          </div>

          {(searchTerm || envFilter !== 'ALL' || statusFilter !== 'ALL' || sensitivityFilter !== 'ALL' || residencyFilter !== 'ALL') && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setSearchTerm('');
                setEnvFilter('ALL');
                setStatusFilter('ALL');
                setSensitivityFilter('ALL');
                setResidencyFilter('ALL');
              }}
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      <div className="table-header-info">
        <span>
          Showing <strong>{filteredWorkloads.length}</strong> of {workloads.length} workloads
        </span>
        <span className="info-tip">
          💡 Click any row to inspect deterministic compliance gates, latency factors, and cost breakdown
        </span>
      </div>

      {/* Workloads Table */}
      <div className="table-card">
        <table className="workload-table">
          <thead>
            <tr>
              <th>Workload Identifier</th>
              <th>Environment</th>
              <th>Current Placement</th>
              <th>Recommended Target</th>
              <th>Current Cost</th>
              <th>Target Cost</th>
              <th>Monthly Savings</th>
              <th>Data Classification</th>
              <th>Residency Mandate</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredWorkloads.map((w) => {
              const rec = recMap.get(w.id);
              const isChange = rec?.status === 'CHANGE_RECOMMENDED';
              const savings = rec?.projected_monthly_savings ?? 0;

              return (
                <tr
                  key={w.id}
                  className="table-row-interactive"
                  onClick={() => onSelectWorkload(w)}
                >
                  <td>
                    <div className="cell-workload-title">{w.name}</div>
                    <div className="cell-workload-id">{w.id}</div>
                  </td>
                  <td>
                    <span className={`badge-env ${w.environment.toLowerCase()}`}>
                      {w.environment}
                    </span>
                  </td>
                  <td>
                    <span className="badge-placement dc">{w.current_placement}</span>
                  </td>
                  <td>
                    <span className={`badge-placement ${isChange ? 'cloud' : 'dc'}`}>
                      {rec?.recommended_placement || w.current_placement}
                    </span>
                  </td>
                  <td className="cell-numeric">
                    ₹{rec?.current_monthly_cost.toLocaleString('en-IN') ?? '-'}
                  </td>
                  <td className="cell-numeric">
                    ₹{rec?.recommended_monthly_cost.toLocaleString('en-IN') ?? '-'}
                  </td>
                  <td className="cell-numeric">
                    {isChange ? (
                      <span className="badge-savings">
                        +₹{savings.toLocaleString('en-IN')}
                      </span>
                    ) : (
                      <span className="text-muted">₹0 (Optimal)</span>
                    )}
                  </td>
                  <td>
                    <span className={`badge ${getSensitivityClass(w.data_sensitivity)}`}>
                      {w.data_sensitivity}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${getResidencyClass(w.residency_requirement)}`}>
                      {w.residency_requirement.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectWorkload(w);
                      }}
                    >
                      Audit
                    </button>
                  </td>
                </tr>
              );
            })}
            {filteredWorkloads.length === 0 && (
              <tr>
                <td colSpan={10} className="empty-table-state">
                  No workloads match the selected filter criteria. Try resetting filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
