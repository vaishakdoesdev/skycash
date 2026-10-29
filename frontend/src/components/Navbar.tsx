import React from 'react';
import { DataSourceMode } from '../services/api';

interface NavbarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  dataSourceMode: DataSourceMode;
  onResetData: () => void;
  onOpenUploader: () => void;
  alertCount: number;
  selectedSetup: 'hired' | 'hybrid';
  onBackToSetup: () => void;
  onBackToConfig: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  dataSourceMode,
  onResetData,
  onOpenUploader,
  alertCount,
  selectedSetup,
  onBackToSetup,
  onBackToConfig,
}) => {
  return (
    <header className="navbar-container">
      <div className="navbar-top">
        <div className="brand-group">
          <div className="brand-icon">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 15a4 4 0 0 0 4 4h10a5 5 0 0 0 1.5-9.76A6 6 0 0 0 6.6 7.4 4 4 0 0 0 3 15z" />
              <path d="M12 12v4m-2-2h4" />
            </svg>
          </div>
          <div>
            <div className="brand-title">SkyCash</div>
            <div className="brand-subtitle">
              Intelligent Infrastructure Placement Advisor · Karnataka DC & Sovereign Cloud
            </div>
          </div>
        </div>

        <div className="navbar-controls">
          {/* Stepper Navigation Shortcuts */}
          <button
            className="btn btn-secondary btn-sm setup-switch-pill"
            onClick={onBackToSetup}
            title="Return to 3D Setup Architecture Selector (Step 1)"
          >
            <span className="arrow-back">←</span>
            <span>1. Setup ({selectedSetup === 'hired' ? 'Hired' : 'Hybrid'})</span>
          </button>

          <button
            className="btn btn-secondary btn-sm setup-switch-pill"
            onClick={onBackToConfig}
            title="Adjust Server Telemetry & Configuration (Step 2)"
          >
            <span>⚙️ 2. Edit Config</span>
          </button>

          <div className="data-badge" title="Data source mode">
            <span className={`status-dot ${dataSourceMode === 'custom_inventory' ? 'custom' : 'active'}`}></span>
            <span className="badge-text">
              {dataSourceMode === 'synthetic_demo' && 'Demo Estate'}
              {dataSourceMode === 'live_api' && 'Live FastAPI'}
              {dataSourceMode === 'custom_inventory' && 'Custom Inventory'}
            </span>
          </div>

          {dataSourceMode === 'custom_inventory' && (
            <button className="btn btn-secondary btn-sm" onClick={onResetData}>
              Reset Demo
            </button>
          )}

          <button className="btn btn-primary btn-sm" onClick={onOpenUploader}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Load Inventory
          </button>
        </div>
      </div>

      <nav className="navbar-tabs">
        <button
          className={`tab-btn ${currentTab === 'overview' ? 'active' : ''}`}
          onClick={() => onSelectTab('overview')}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="7" height="9" />
            <rect x="14" y="3" width="7" height="5" />
            <rect x="14" y="12" width="7" height="9" />
            <rect x="3" y="16" width="7" height="5" />
          </svg>
          Overview & Capacity
        </button>

        <button
          className={`tab-btn ${currentTab === 'inventory' ? 'active' : ''}`}
          onClick={() => onSelectTab('inventory')}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="8" y1="6" x2="21" y2="6" />
            <line x1="8" y1="12" x2="21" y2="12" />
            <line x1="8" y1="18" x2="21" y2="18" />
            <line x1="3" y1="6" x2="3.01" y2="6" />
            <line x1="3" y1="12" x2="3.01" y2="12" />
            <line x1="3" y1="18" x2="3.01" y2="18" />
          </svg>
          Workload Inventory
        </button>

        <button
          className={`tab-btn ${currentTab === 'dependencies' ? 'active' : ''}`}
          onClick={() => onSelectTab('dependencies')}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
          Dependencies & Co-Location
        </button>

        <button
          className={`tab-btn ${currentTab === 'simulator' ? 'active' : ''}`}
          onClick={() => onSelectTab('simulator')}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="20" x2="12" y2="10" />
            <line x1="18" y1="20" x2="18" y2="4" />
            <line x1="6" y1="20" x2="6" y2="16" />
          </svg>
          Growth Simulator
        </button>

        <button
          className={`tab-btn ${currentTab === 'alerts' ? 'active' : ''}`}
          onClick={() => onSelectTab('alerts')}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          Review Alerts
          {alertCount > 0 && <span className="tab-badge">{alertCount}</span>}
        </button>

        <button
          className={`tab-btn ${currentTab === 'methodology' ? 'active' : ''}`}
          onClick={() => onSelectTab('methodology')}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          Methodology & Rules
        </button>
      </nav>
    </header>
  );
};
