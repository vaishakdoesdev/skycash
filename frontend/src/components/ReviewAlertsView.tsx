import React, { useState } from 'react';
import { ReviewAlert, Workload, AlertSeverity, AlertStatus } from '../types';

interface ReviewAlertsViewProps {
  alerts: ReviewAlert[];
  workloads: Workload[];
  onSelectWorkload: (workload: Workload) => void;
}

export const ReviewAlertsView: React.FC<ReviewAlertsViewProps> = ({
  alerts: initialAlerts,
  workloads,
  onSelectWorkload,
}) => {
  const [alerts, setAlerts] = useState<ReviewAlert[]>(initialAlerts);
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const workloadsMap = new Map<string, Workload>(workloads.map((w) => [w.id, w]));

  const toggleStatus = (alertId: string, newStatus: AlertStatus) => {
    setAlerts((prev) =>
      prev.map((a) => (a.alert_id === alertId ? { ...a, status: newStatus } : a))
    );
  };

  const filteredAlerts = alerts.filter((a) => {
    if (severityFilter !== 'ALL' && a.severity !== severityFilter) return false;
    if (statusFilter !== 'ALL' && a.status !== statusFilter) return false;
    return true;
  });

  const getSeverityBadge = (severity: AlertSeverity) => {
    switch (severity) {
      case 'CRITICAL':
        return 'badge-restricted';
      case 'WARNING':
        return 'badge-confidential';
      case 'INFO':
        return 'badge-neutral';
      default:
        return 'badge-neutral';
    }
  };

  return (
    <div className="alerts-container">
      <div className="section-card">
        <div className="section-header">
          <div>
            <h2 className="section-title">Operational Placement & Capacity Alerts</h2>
            <p className="section-subtitle">
              Proactive notifications alerting infrastructure leads when workload trends warrant placement reassessment
            </p>
          </div>

          <div className="filters-row">
            <div className="filter-group">
              <label>Severity:</label>
              <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)}>
                <option value="ALL">All Severities</option>
                <option value="CRITICAL">Critical</option>
                <option value="WARNING">Warning</option>
                <option value="INFO">Informational</option>
              </select>
            </div>

            <div className="filter-group">
              <label>Status:</label>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="ALL">All States</option>
                <option value="ACTIVE">Active</option>
                <option value="ACKNOWLEDGED">Acknowledged</option>
                <option value="RESOLVED">Resolved</option>
              </select>
            </div>
          </div>
        </div>

        {/* Alerts List */}
        <div className="alerts-list">
          {filteredAlerts.map((alert) => {
            const workload = workloadsMap.get(alert.workload_id);

            return (
              <div key={alert.alert_id} className={`alert-card ${alert.status.toLowerCase()}`}>
                <div className="alert-top">
                  <div className="alert-title-group">
                    <span className={`badge ${getSeverityBadge(alert.severity)}`}>
                      {alert.severity}
                    </span>
                    <span className="badge badge-neutral">{alert.trigger_type.replace(/_/g, ' ')}</span>
                    <span className="alert-title">{alert.title}</span>
                  </div>

                  <div className="alert-meta-top">
                    <span className={`status-pill ${alert.status.toLowerCase()}`}>{alert.status}</span>
                    <span className="text-muted text-xs">
                      {new Date(alert.created_at).toLocaleDateString('en-IN', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>

                <p className="alert-summary">{alert.summary}</p>

                <div className="alert-audit-box">
                  <span className="audit-tag">Deterministic Trigger Rationale:</span>
                  <span className="audit-text">{alert.audit_rationale}</span>
                </div>

                <div className="alert-footer">
                  <div className="alert-affected">
                    Affected Workload:{' '}
                    <strong>{workload?.name || alert.workload_id}</strong> (<code>{alert.workload_id}</code>)
                    {alert.cost_delta !== null && alert.cost_delta !== undefined && alert.cost_delta !== 0 && (
                      <span className="alert-cost-delta">
                        Cost Impact: ₹{alert.cost_delta.toLocaleString('en-IN')}/mo
                      </span>
                    )}
                  </div>

                  <div className="alert-actions">
                    {workload && (
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => onSelectWorkload(workload)}
                      >
                        Audit Workload
                      </button>
                    )}

                    {alert.status === 'ACTIVE' && (
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => toggleStatus(alert.alert_id, 'ACKNOWLEDGED')}
                      >
                        Acknowledge
                      </button>
                    )}

                    {alert.status !== 'RESOLVED' && (
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => toggleStatus(alert.alert_id, 'RESOLVED')}
                      >
                        Resolve
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {filteredAlerts.length === 0 && (
            <div className="empty-alerts">
              <span>✓ All alerts for the selected criteria are reviewed and clear.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
