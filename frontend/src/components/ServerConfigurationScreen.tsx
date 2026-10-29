import React, { useState, useMemo } from 'react';
import { ServerConfigurationState, DataResidencyRequirement } from '../types';
import { Screen2BackdropScene } from './3d/Screen2BackdropScene';
import { StepProgressIndicator } from './StepProgressIndicator';

interface ServerConfigurationScreenProps {
  selectedSetup: 'hired' | 'hybrid';
  initialConfig: ServerConfigurationState;
  onBackToSetup: () => void;
  onAnalyze: (config: ServerConfigurationState) => void;
  maxUnlockedStep?: number;
  onNavigateStep?: (step: number) => void;
}

export const ServerConfigurationScreen: React.FC<ServerConfigurationScreenProps> = ({
  selectedSetup,
  initialConfig,
  onBackToSetup,
  onAnalyze,
  maxUnlockedStep = 2,
  onNavigateStep,
}) => {
  const isHybrid = selectedSetup === 'hybrid';

  // Helper to detect if initial config matches the illustrative demo data
  const isMatchingDemo = (cfg: ServerConfigurationState): boolean => {
    if (isHybrid) {
      return (
        cfg.localCpuCores === 64 &&
        cfg.localRamGb === 256 &&
        cfg.rentedServerCount === 2 &&
        cfg.cpuCoresPerServer === 16
      );
    }
    return (
      cfg.rentedServerCount === 4 &&
      cfg.cpuCoresPerServer === 16 &&
      cfg.monthlyRentalCostPerServer === 16000
    );
  };

  const [formData, setFormData] = useState<ServerConfigurationState>(initialConfig);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isDemoDataActive, setIsDemoDataActive] = useState<boolean>(() => isMatchingDemo(initialConfig));

  // Helper to update numeric or string field
  const updateField = (field: keyof ServerConfigurationState, val: string | number) => {
    setIsDemoDataActive(false);
    setFormData((prev) => ({
      ...prev,
      [field]: val === '' ? '' : (typeof val === 'number' ? val : (isNaN(Number(val)) ? val : Number(val))),
    }));

    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  // Helper to toggle unknown flag
  const toggleUnknown = (field: keyof ServerConfigurationState, unknownFlag: keyof ServerConfigurationState) => {
    setIsDemoDataActive(false);
    setFormData((prev) => {
      const isNowUnknown = !prev[unknownFlag];
      return {
        ...prev,
        [unknownFlag]: isNowUnknown,
        ...(isNowUnknown ? { [field]: '' } : {}),
      };
    });

    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  // Reset Form to clean unpopulated state
  const handleResetForm = () => {
    setIsDemoDataActive(false);
    setFormData({
      residencyConstraint: 'KARNATAKA_DC_ONLY',
      coLocationRequirement: false,
    });
    setErrors({});
  };

  // Load Demo Data (preserves exact values)
  const handleLoadDemoData = () => {
    setIsDemoDataActive(true);
    if (isHybrid) {
      setFormData({
        localCpuCores: 64,
        localRamGb: 256,
        localCapacityUtilPct: 70,
        localOperatingCostMonthly: 35000,
        localCostUnknown: false,
        localUtilizationUnknown: false,

        rentedServerCount: 2,
        cpuCoresPerServer: 16,
        ramGbPerServer: 64,
        monthlyRentalCostPerServer: 14500,
        rentalCostUnknown: false,
        avgCpuUtilizationPct: 45,
        avgRamUtilizationPct: 50,
        cpuUtilizationUnknown: false,
        ramUtilizationUnknown: false,

        workloadDemandCpu: 72,
        workloadDemandRam: 240,
        workloadDemandUnknown: false,
        residencyConstraint: 'KARNATAKA_DC_ONLY',
        coLocationRequirement: true,
        workloadNotes: 'Core payment gateway and ledger workloads requiring sub-2ms latency',
      });
    } else {
      setFormData({
        rentedServerCount: 4,
        cpuCoresPerServer: 16,
        ramGbPerServer: 64,
        monthlyRentalCostPerServer: 16000,
        rentalCostUnknown: false,
        avgCpuUtilizationPct: 68,
        avgRamUtilizationPct: 74,
        cpuUtilizationUnknown: false,
        ramUtilizationUnknown: false,

        workloadDemandCpu: 52,
        workloadDemandRam: 210,
        workloadDemandUnknown: false,
      });
    }
    setErrors({});
  };

  // Form Validation
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    const checkPositive = (field: keyof ServerConfigurationState, label: string) => {
      const val = formData[field];
      if (val === undefined || val === '' || Number(val) <= 0) {
        newErrors[field] = `${label} must be greater than 0`;
      }
    };

    const checkPercentage = (field: keyof ServerConfigurationState, label: string) => {
      const val = formData[field];
      if (val === undefined || val === '' || Number(val) < 0 || Number(val) > 100) {
        newErrors[field] = `${label} must be between 0% and 100%`;
      }
    };

    // Shared Hired Server Fields
    checkPositive('rentedServerCount', 'Number of rented servers');
    checkPositive('cpuCoresPerServer', 'CPU cores per server');
    checkPositive('ramGbPerServer', 'RAM per server');

    if (!formData.rentalCostUnknown) {
      checkPositive('monthlyRentalCostPerServer', 'Monthly rental cost per server');
    }
    if (!formData.cpuUtilizationUnknown) {
      checkPercentage('avgCpuUtilizationPct', 'Average CPU utilization');
    }
    if (!formData.ramUtilizationUnknown) {
      checkPercentage('avgRamUtilizationPct', 'Average RAM utilization');
    }

    if (isHybrid) {
      checkPositive('localCpuCores', 'Local server CPU cores');
      checkPositive('localRamGb', 'Local server RAM');
      if (!formData.localUtilizationUnknown) {
        checkPercentage('localCapacityUtilPct', 'Local server capacity utilization');
      }
      if (!formData.localCostUnknown && formData.localOperatingCostMonthly !== '' && formData.localOperatingCostMonthly !== undefined) {
        if (Number(formData.localOperatingCostMonthly) < 0) {
          newErrors.localOperatingCostMonthly = 'Cost cannot be negative';
        }
      }
    }

    // Workload demand validation if provided and not marked unknown
    if (!formData.workloadDemandUnknown) {
      if (formData.workloadDemandCpu !== '' && formData.workloadDemandCpu !== undefined) {
        if (Number(formData.workloadDemandCpu) <= 0) {
          newErrors.workloadDemandCpu = 'Demand CPU must be greater than 0';
        }
      }
      if (formData.workloadDemandRam !== '' && formData.workloadDemandRam !== undefined) {
        if (Number(formData.workloadDemandRam) <= 0) {
          newErrors.workloadDemandRam = 'Demand RAM must be greater than 0';
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      onAnalyze(formData);
    }
  };

  // Live Summary Calculations
  const summaryMetrics = useMemo(() => {
    const rentedCount = Number(formData.rentedServerCount) || 0;
    const rentedCpuPerServer = Number(formData.cpuCoresPerServer) || 0;
    const rentedRamPerServer = Number(formData.ramGbPerServer) || 0;
    const rentedCostPerServer = formData.rentalCostUnknown ? null : (Number(formData.monthlyRentalCostPerServer) || 0);

    const totalRentedCpu = rentedCount * rentedCpuPerServer;
    const totalRentedRam = rentedCount * rentedRamPerServer;
    const totalRentedCost = rentedCostPerServer !== null ? rentedCount * rentedCostPerServer : null;

    const localCpu = isHybrid ? (Number(formData.localCpuCores) || 0) : 0;
    const localRam = isHybrid ? (Number(formData.localRamGb) || 0) : 0;
    const localCost = (isHybrid && !formData.localCostUnknown && formData.localOperatingCostMonthly)
      ? Number(formData.localOperatingCostMonthly)
      : null;

    const totalAvailableCpu = isHybrid ? localCpu + totalRentedCpu : totalRentedCpu;
    const totalAvailableRam = isHybrid ? localRam + totalRentedRam : totalRentedRam;
    const totalEstimatedMonthlyCost = (totalRentedCost !== null || localCost !== null)
      ? (totalRentedCost || 0) + (localCost || 0)
      : null;

    const demandCpu = !formData.workloadDemandUnknown && formData.workloadDemandCpu ? Number(formData.workloadDemandCpu) : null;
    const demandRam = !formData.workloadDemandUnknown && formData.workloadDemandRam ? Number(formData.workloadDemandRam) : null;

    return {
      totalAvailableCpu,
      totalAvailableRam,
      totalRentedCpu,
      totalRentedRam,
      localCpu,
      localRam,
      totalEstimatedMonthlyCost,
      demandCpu,
      demandRam,
    };
  }, [formData, isHybrid]);

  return (
    <div className="screen2-page-container">
      {/* 1. Infrastructure 3D Backdrop Scene */}
      <Screen2BackdropScene setup={selectedSetup} />

      {/* Main Foreground Content */}
      <div className="screen2-content-wrapper">
        {/* 5-Step Progress Stepper */}
        {onNavigateStep ? (
          <StepProgressIndicator
            currentStep={2}
            maxUnlockedStep={maxUnlockedStep}
            onNavigateStep={onNavigateStep}
            className="screen2-main-stepper"
          />
        ) : (
          <nav className="screen2-stepper-header" aria-label="Progress">
            <div className="screen2-stepper-track">
              <button
                type="button"
                className="screen2-step-node completed"
                onClick={onBackToSetup}
                title="Return to Infrastructure Setup"
              >
                <span className="screen2-step-icon">✓</span>
                <span className="screen2-step-text">Infrastructure Setup</span>
              </button>

              <div className="screen2-step-connector active" />

              <div className="screen2-step-node active">
                <span className="screen2-step-icon">2</span>
                <span className="screen2-step-text">Server Configuration</span>
              </div>

              <div className="screen2-step-connector" />

              <div className="screen2-step-node disabled">
                <span className="screen2-step-icon">3</span>
                <span className="screen2-step-text">Analysis & Recommendation</span>
              </div>
            </div>
          </nav>
        )}

        {/* Selected Setup Hero Banner */}
        <header className="screen2-setup-banner">
          <div className="screen2-banner-main">
            <div className="screen2-banner-badge-row">
              <span className="screen2-arch-badge">
                {isHybrid ? 'OPTION B · HYBRID ARCHITECTURE' : 'OPTION A · CLOUD FLEET'}
              </span>
              {isDemoDataActive ? (
                <span className="screen2-data-status-badge demo">
                  <span className="screen2-pulse-dot amber" />
                  Illustrative Demo Data
                </span>
              ) : (
                <span className="screen2-data-status-badge custom">
                  <span className="screen2-pulse-dot teal" />
                  Custom Specification
                </span>
              )}
            </div>

            <h1 className="screen2-banner-heading">
              {isHybrid
                ? 'Local + Hired Server Configuration'
                : 'Hired Server Fleet Configuration'}
            </h1>
            <p className="screen2-banner-description">
              {isHybrid
                ? 'Specify local datacenter and rented server capacity to evaluate hybrid placement, data residency, and low-latency co-location.'
                : 'Specify rented server capacity and workload demand to discover if your deployment is under-provisioned, balanced, or over-provisioned.'}
            </p>
          </div>

          <div className="screen2-banner-controls">
            <button
              type="button"
              className="screen2-btn-secondary"
              onClick={onBackToSetup}
            >
              ← Change Setup
            </button>
          </div>
        </header>

        {/* Compact Action Toolbar & Privacy Tag */}
        <div className="screen2-action-bar">
          <div className="screen2-privacy-tag">
            <span className="screen2-shield-icon">🛡️</span>
            <span>Local Evaluation · No cloud credentials required · No device scanning</span>
          </div>

          <div className="screen2-toolbar-actions">
            <button
              type="button"
              className="screen2-btn-tool"
              onClick={handleLoadDemoData}
              title="Populate illustrative sample values"
            >
              ✨ Load Demo Data
            </button>
            <button
              type="button"
              className="screen2-btn-tool danger"
              onClick={handleResetForm}
              title="Reset all fields to blank"
            >
              ↺ Reset Form
            </button>
          </div>
        </div>

        {/* Main Configuration Workspace: Form Panels & Telemetry Sidebar */}
        <div className="screen2-layout-grid">
          {/* Left Column: Polished Structured Panels */}
          <main className="screen2-panels-container">
            <form onSubmit={handleSubmit} noValidate>
              {/* =========================================================
                  A. HIRED SERVER (OPTION A) - 4 POLISHED PANELS
                 ========================================================= */}
              {!isHybrid && (
                <div className="screen2-panels-stack">
                  {/* Panel 1: Server Fleet */}
                  <section className="screen2-panel">
                    <div className="screen2-panel-header">
                      <div className="screen2-panel-icon-circle">🖥️</div>
                      <div>
                        <h2 className="screen2-panel-title">1. Server Fleet</h2>
                        <p className="screen2-panel-subtitle">
                          Hardware capacity specifications for your rented cloud servers.
                        </p>
                      </div>
                    </div>

                    <div className="screen2-fields-grid">
                      {/* Number of rented servers */}
                      <div className={`screen2-field-group ${errors.rentedServerCount ? 'has-error' : ''}`}>
                        <div className="screen2-field-label-row">
                          <label htmlFor="rentedServerCount">Number of Rented Servers</label>
                          <span className="screen2-unit-tag">Count</span>
                        </div>
                        <input
                          id="rentedServerCount"
                          type="number"
                          min="1"
                          step="1"
                          placeholder="e.g. 4"
                          value={formData.rentedServerCount ?? ''}
                          onChange={(e) => updateField('rentedServerCount', e.target.value)}
                        />
                        {errors.rentedServerCount && (
                          <span className="screen2-error-text">{errors.rentedServerCount}</span>
                        )}
                      </div>

                      {/* CPU Cores per server */}
                      <div className={`screen2-field-group ${errors.cpuCoresPerServer ? 'has-error' : ''}`}>
                        <div className="screen2-field-label-row">
                          <label htmlFor="cpuCoresPerServer">CPU Cores per Server</label>
                          <span className="screen2-unit-tag">vCPU</span>
                        </div>
                        <input
                          id="cpuCoresPerServer"
                          type="number"
                          min="1"
                          placeholder="e.g. 16"
                          value={formData.cpuCoresPerServer ?? ''}
                          onChange={(e) => updateField('cpuCoresPerServer', e.target.value)}
                        />
                        {errors.cpuCoresPerServer && (
                          <span className="screen2-error-text">{errors.cpuCoresPerServer}</span>
                        )}
                      </div>

                      {/* RAM per server */}
                      <div className={`screen2-field-group full-width-field ${errors.ramGbPerServer ? 'has-error' : ''}`}>
                        <div className="screen2-field-label-row">
                          <label htmlFor="ramGbPerServer">RAM per Server</label>
                          <span className="screen2-unit-tag">GB</span>
                        </div>
                        <input
                          id="ramGbPerServer"
                          type="number"
                          min="1"
                          placeholder="e.g. 64"
                          value={formData.ramGbPerServer ?? ''}
                          onChange={(e) => updateField('ramGbPerServer', e.target.value)}
                        />
                        {errors.ramGbPerServer && (
                          <span className="screen2-error-text">{errors.ramGbPerServer}</span>
                        )}
                      </div>
                    </div>
                  </section>

                  {/* Panel 2: Rental Cost */}
                  <section className="screen2-panel">
                    <div className="screen2-panel-header">
                      <div className="screen2-panel-icon-circle">💳</div>
                      <div>
                        <h2 className="screen2-panel-title">2. Rental Cost</h2>
                        <p className="screen2-panel-subtitle">
                          Monthly cloud subscription or hosting lease expense per server.
                        </p>
                      </div>
                    </div>

                    <div className="screen2-fields-grid single-col">
                      <div className={`screen2-field-group ${errors.monthlyRentalCostPerServer ? 'has-error' : ''} ${formData.rentalCostUnknown ? 'is-unknown' : ''}`}>
                        <div className="screen2-field-label-row">
                          <label htmlFor="monthlyRentalCostPerServer">Monthly Rental Cost per Server</label>
                          <div className="screen2-label-accessories">
                            <span className="screen2-unit-tag">₹/month</span>
                            <label className="screen2-unknown-toggle">
                              <input
                                type="checkbox"
                                checked={!!formData.rentalCostUnknown}
                                onChange={() => toggleUnknown('monthlyRentalCostPerServer', 'rentalCostUnknown')}
                              />
                              <span>Mark as unknown</span>
                            </label>
                          </div>
                        </div>
                        <input
                          id="monthlyRentalCostPerServer"
                          type="number"
                          min="0"
                          placeholder={formData.rentalCostUnknown ? 'Cost marked as unknown' : 'e.g. 16000'}
                          disabled={!!formData.rentalCostUnknown}
                          value={formData.monthlyRentalCostPerServer ?? ''}
                          onChange={(e) => updateField('monthlyRentalCostPerServer', e.target.value)}
                        />
                        {errors.monthlyRentalCostPerServer && !formData.rentalCostUnknown && (
                          <span className="screen2-error-text">{errors.monthlyRentalCostPerServer}</span>
                        )}
                      </div>
                    </div>
                  </section>

                  {/* Panel 3: Current Utilization */}
                  <section className="screen2-panel">
                    <div className="screen2-panel-header">
                      <div className="screen2-panel-icon-circle">📈</div>
                      <div>
                        <h2 className="screen2-panel-title">3. Current Utilization</h2>
                        <p className="screen2-panel-subtitle">
                          Observed telemetry rates across compute and memory resources.
                        </p>
                      </div>
                    </div>

                    <div className="screen2-fields-grid">
                      {/* Average CPU Utilization */}
                      <div className={`screen2-field-group ${errors.avgCpuUtilizationPct ? 'has-error' : ''} ${formData.cpuUtilizationUnknown ? 'is-unknown' : ''}`}>
                        <div className="screen2-field-label-row">
                          <label htmlFor="avgCpuUtilizationPct">Average CPU Utilization</label>
                          <div className="screen2-label-accessories">
                            <span className="screen2-unit-tag">%</span>
                            <label className="screen2-unknown-toggle">
                              <input
                                type="checkbox"
                                checked={!!formData.cpuUtilizationUnknown}
                                onChange={() => toggleUnknown('avgCpuUtilizationPct', 'cpuUtilizationUnknown')}
                              />
                              <span>Unknown</span>
                            </label>
                          </div>
                        </div>
                        <input
                          id="avgCpuUtilizationPct"
                          type="number"
                          min="0"
                          max="100"
                          placeholder={formData.cpuUtilizationUnknown ? 'Marked as unknown' : 'e.g. 68'}
                          disabled={!!formData.cpuUtilizationUnknown}
                          value={formData.avgCpuUtilizationPct ?? ''}
                          onChange={(e) => updateField('avgCpuUtilizationPct', e.target.value)}
                        />
                        {errors.avgCpuUtilizationPct && !formData.cpuUtilizationUnknown && (
                          <span className="screen2-error-text">{errors.avgCpuUtilizationPct}</span>
                        )}
                      </div>

                      {/* Average RAM Utilization */}
                      <div className={`screen2-field-group ${errors.avgRamUtilizationPct ? 'has-error' : ''} ${formData.ramUtilizationUnknown ? 'is-unknown' : ''}`}>
                        <div className="screen2-field-label-row">
                          <label htmlFor="avgRamUtilizationPct">Average RAM Utilization</label>
                          <div className="screen2-label-accessories">
                            <span className="screen2-unit-tag">%</span>
                            <label className="screen2-unknown-toggle">
                              <input
                                type="checkbox"
                                checked={!!formData.ramUtilizationUnknown}
                                onChange={() => toggleUnknown('avgRamUtilizationPct', 'ramUtilizationUnknown')}
                              />
                              <span>Unknown</span>
                            </label>
                          </div>
                        </div>
                        <input
                          id="avgRamUtilizationPct"
                          type="number"
                          min="0"
                          max="100"
                          placeholder={formData.ramUtilizationUnknown ? 'Marked as unknown' : 'e.g. 74'}
                          disabled={!!formData.ramUtilizationUnknown}
                          value={formData.avgRamUtilizationPct ?? ''}
                          onChange={(e) => updateField('avgRamUtilizationPct', e.target.value)}
                        />
                        {errors.avgRamUtilizationPct && !formData.ramUtilizationUnknown && (
                          <span className="screen2-error-text">{errors.avgRamUtilizationPct}</span>
                        )}
                      </div>
                    </div>
                  </section>

                  {/* Panel 4: Workload Demand */}
                  <section className="screen2-panel">
                    <div className="screen2-panel-header">
                      <div className="screen2-panel-icon-circle">🎯</div>
                      <div>
                        <div className="screen2-header-title-row">
                          <h2 className="screen2-panel-title">4. Workload Demand</h2>
                          <label className="screen2-unknown-toggle header-toggle">
                            <input
                              type="checkbox"
                              checked={!!formData.workloadDemandUnknown}
                              onChange={() => {
                                const nextVal = !formData.workloadDemandUnknown;
                                setIsDemoDataActive(false);
                                setFormData((prev) => ({
                                  ...prev,
                                  workloadDemandUnknown: nextVal,
                                  ...(nextVal ? { workloadDemandCpu: '', workloadDemandRam: '' } : {}),
                                }));
                              }}
                            />
                            <span>Demand unknown (use utilization only)</span>
                          </label>
                        </div>
                        <p className="screen2-panel-subtitle">
                          Required compute and memory demand to calculate capacity shortfall or excess headroom.
                        </p>
                      </div>
                    </div>

                    {!formData.workloadDemandUnknown && (
                      <div className="screen2-fields-grid">
                        <div className={`screen2-field-group ${errors.workloadDemandCpu ? 'has-error' : ''}`}>
                          <div className="screen2-field-label-row">
                            <label htmlFor="workloadDemandCpu">Required Workload CPU Demand</label>
                            <span className="screen2-unit-tag">vCPU</span>
                          </div>
                          <input
                            id="workloadDemandCpu"
                            type="number"
                            min="1"
                            placeholder="e.g. 52"
                            value={formData.workloadDemandCpu ?? ''}
                            onChange={(e) => updateField('workloadDemandCpu', e.target.value)}
                          />
                          {errors.workloadDemandCpu && (
                            <span className="screen2-error-text">{errors.workloadDemandCpu}</span>
                          )}
                        </div>

                        <div className={`screen2-field-group ${errors.workloadDemandRam ? 'has-error' : ''}`}>
                          <div className="screen2-field-label-row">
                            <label htmlFor="workloadDemandRam">Required Workload RAM Demand</label>
                            <span className="screen2-unit-tag">GB</span>
                          </div>
                          <input
                            id="workloadDemandRam"
                            type="number"
                            min="1"
                            placeholder="e.g. 210"
                            value={formData.workloadDemandRam ?? ''}
                            onChange={(e) => updateField('workloadDemandRam', e.target.value)}
                          />
                          {errors.workloadDemandRam && (
                            <span className="screen2-error-text">{errors.workloadDemandRam}</span>
                          )}
                        </div>
                      </div>
                    )}
                  </section>
                </div>
              )}

              {/* =========================================================
                  B. LOCAL + HIRED SERVER (OPTION B) - 3 POLISHED PANELS
                 ========================================================= */}
              {isHybrid && (
                <div className="screen2-panels-stack">
                  {/* Panel 1: Local Infrastructure */}
                  <section className="screen2-panel">
                    <div className="screen2-panel-header">
                      <div className="screen2-panel-icon-circle local">🏢</div>
                      <div>
                        <h2 className="screen2-panel-title">1. Local Infrastructure (On-Premises / Private DC)</h2>
                        <p className="screen2-panel-subtitle">
                          Self-hosted server specifications, capacity utilization, and facility operating costs.
                        </p>
                      </div>
                    </div>

                    <div className="screen2-fields-grid">
                      {/* Local CPU */}
                      <div className={`screen2-field-group ${errors.localCpuCores ? 'has-error' : ''}`}>
                        <div className="screen2-field-label-row">
                          <label htmlFor="localCpuCores">Local Server CPU Cores</label>
                          <span className="screen2-unit-tag">Cores</span>
                        </div>
                        <input
                          id="localCpuCores"
                          type="number"
                          min="1"
                          placeholder="e.g. 64"
                          value={formData.localCpuCores ?? ''}
                          onChange={(e) => updateField('localCpuCores', e.target.value)}
                        />
                        {errors.localCpuCores && (
                          <span className="screen2-error-text">{errors.localCpuCores}</span>
                        )}
                      </div>

                      {/* Local RAM */}
                      <div className={`screen2-field-group ${errors.localRamGb ? 'has-error' : ''}`}>
                        <div className="screen2-field-label-row">
                          <label htmlFor="localRamGb">Local Server RAM</label>
                          <span className="screen2-unit-tag">GB</span>
                        </div>
                        <input
                          id="localRamGb"
                          type="number"
                          min="1"
                          placeholder="e.g. 256"
                          value={formData.localRamGb ?? ''}
                          onChange={(e) => updateField('localRamGb', e.target.value)}
                        />
                        {errors.localRamGb && (
                          <span className="screen2-error-text">{errors.localRamGb}</span>
                        )}
                      </div>

                      {/* Local Utilization */}
                      <div className={`screen2-field-group ${errors.localCapacityUtilPct ? 'has-error' : ''} ${formData.localUtilizationUnknown ? 'is-unknown' : ''}`}>
                        <div className="screen2-field-label-row">
                          <label htmlFor="localCapacityUtilPct">Local Capacity Utilization</label>
                          <div className="screen2-label-accessories">
                            <span className="screen2-unit-tag">%</span>
                            <label className="screen2-unknown-toggle">
                              <input
                                type="checkbox"
                                checked={!!formData.localUtilizationUnknown}
                                onChange={() => toggleUnknown('localCapacityUtilPct', 'localUtilizationUnknown')}
                              />
                              <span>Unknown</span>
                            </label>
                          </div>
                        </div>
                        <input
                          id="localCapacityUtilPct"
                          type="number"
                          min="0"
                          max="100"
                          placeholder={formData.localUtilizationUnknown ? 'Marked as unknown' : 'e.g. 70'}
                          disabled={!!formData.localUtilizationUnknown}
                          value={formData.localCapacityUtilPct ?? ''}
                          onChange={(e) => updateField('localCapacityUtilPct', e.target.value)}
                        />
                        {errors.localCapacityUtilPct && !formData.localUtilizationUnknown && (
                          <span className="screen2-error-text">{errors.localCapacityUtilPct}</span>
                        )}
                      </div>

                      {/* Local Operating Cost */}
                      <div className={`screen2-field-group ${errors.localOperatingCostMonthly ? 'has-error' : ''} ${formData.localCostUnknown ? 'is-unknown' : ''}`}>
                        <div className="screen2-field-label-row">
                          <label htmlFor="localOperatingCostMonthly">Monthly Operating Cost (Power/Cooling)</label>
                          <div className="screen2-label-accessories">
                            <span className="screen2-unit-tag">₹/month</span>
                            <label className="screen2-unknown-toggle">
                              <input
                                type="checkbox"
                                checked={!!formData.localCostUnknown}
                                onChange={() => toggleUnknown('localOperatingCostMonthly', 'localCostUnknown')}
                              />
                              <span>Unknown</span>
                            </label>
                          </div>
                        </div>
                        <input
                          id="localOperatingCostMonthly"
                          type="number"
                          min="0"
                          placeholder={formData.localCostUnknown ? 'Cost marked as unknown' : 'e.g. 35000'}
                          disabled={!!formData.localCostUnknown}
                          value={formData.localOperatingCostMonthly ?? ''}
                          onChange={(e) => updateField('localOperatingCostMonthly', e.target.value)}
                        />
                        {errors.localOperatingCostMonthly && !formData.localCostUnknown && (
                          <span className="screen2-error-text">{errors.localOperatingCostMonthly}</span>
                        )}
                      </div>
                    </div>
                  </section>

                  {/* Panel 2: Hired Infrastructure */}
                  <section className="screen2-panel">
                    <div className="screen2-panel-header">
                      <div className="screen2-panel-icon-circle cloud">☁️</div>
                      <div>
                        <h2 className="screen2-panel-title">2. Hired Infrastructure (Cloud Servers)</h2>
                        <p className="screen2-panel-subtitle">
                          Rented cloud server count, CPU, RAM, rental lease cost, and utilization.
                        </p>
                      </div>
                    </div>

                    <div className="screen2-fields-grid">
                      {/* Rented Server Count */}
                      <div className={`screen2-field-group ${errors.rentedServerCount ? 'has-error' : ''}`}>
                        <div className="screen2-field-label-row">
                          <label htmlFor="rentedServerCountHybrid">Number of Rented Servers</label>
                          <span className="screen2-unit-tag">Count</span>
                        </div>
                        <input
                          id="rentedServerCountHybrid"
                          type="number"
                          min="1"
                          placeholder="e.g. 2"
                          value={formData.rentedServerCount ?? ''}
                          onChange={(e) => updateField('rentedServerCount', e.target.value)}
                        />
                        {errors.rentedServerCount && (
                          <span className="screen2-error-text">{errors.rentedServerCount}</span>
                        )}
                      </div>

                      {/* CPU per server */}
                      <div className={`screen2-field-group ${errors.cpuCoresPerServer ? 'has-error' : ''}`}>
                        <div className="screen2-field-label-row">
                          <label htmlFor="cpuCoresPerServerHybrid">CPU Cores per Rented Server</label>
                          <span className="screen2-unit-tag">vCPU</span>
                        </div>
                        <input
                          id="cpuCoresPerServerHybrid"
                          type="number"
                          min="1"
                          placeholder="e.g. 16"
                          value={formData.cpuCoresPerServer ?? ''}
                          onChange={(e) => updateField('cpuCoresPerServer', e.target.value)}
                        />
                        {errors.cpuCoresPerServer && (
                          <span className="screen2-error-text">{errors.cpuCoresPerServer}</span>
                        )}
                      </div>

                      {/* RAM per server */}
                      <div className={`screen2-field-group ${errors.ramGbPerServer ? 'has-error' : ''}`}>
                        <div className="screen2-field-label-row">
                          <label htmlFor="ramGbPerServerHybrid">RAM per Rented Server</label>
                          <span className="screen2-unit-tag">GB</span>
                        </div>
                        <input
                          id="ramGbPerServerHybrid"
                          type="number"
                          min="1"
                          placeholder="e.g. 64"
                          value={formData.ramGbPerServer ?? ''}
                          onChange={(e) => updateField('ramGbPerServer', e.target.value)}
                        />
                        {errors.ramGbPerServer && (
                          <span className="screen2-error-text">{errors.ramGbPerServer}</span>
                        )}
                      </div>

                      {/* Rental Cost */}
                      <div className={`screen2-field-group ${errors.monthlyRentalCostPerServer ? 'has-error' : ''} ${formData.rentalCostUnknown ? 'is-unknown' : ''}`}>
                        <div className="screen2-field-label-row">
                          <label htmlFor="monthlyRentalCostHybrid">Monthly Rental Cost per Server</label>
                          <div className="screen2-label-accessories">
                            <span className="screen2-unit-tag">₹/month</span>
                            <label className="screen2-unknown-toggle">
                              <input
                                type="checkbox"
                                checked={!!formData.rentalCostUnknown}
                                onChange={() => toggleUnknown('monthlyRentalCostPerServer', 'rentalCostUnknown')}
                              />
                              <span>Unknown</span>
                            </label>
                          </div>
                        </div>
                        <input
                          id="monthlyRentalCostHybrid"
                          type="number"
                          min="0"
                          placeholder={formData.rentalCostUnknown ? 'Cost marked as unknown' : 'e.g. 14500'}
                          disabled={!!formData.rentalCostUnknown}
                          value={formData.monthlyRentalCostPerServer ?? ''}
                          onChange={(e) => updateField('monthlyRentalCostPerServer', e.target.value)}
                        />
                        {errors.monthlyRentalCostPerServer && !formData.rentalCostUnknown && (
                          <span className="screen2-error-text">{errors.monthlyRentalCostPerServer}</span>
                        )}
                      </div>

                      {/* CPU Utilization */}
                      <div className={`screen2-field-group ${errors.avgCpuUtilizationPct ? 'has-error' : ''} ${formData.cpuUtilizationUnknown ? 'is-unknown' : ''}`}>
                        <div className="screen2-field-label-row">
                          <label htmlFor="avgCpuUtilizationHybrid">Average CPU Utilization</label>
                          <div className="screen2-label-accessories">
                            <span className="screen2-unit-tag">%</span>
                            <label className="screen2-unknown-toggle">
                              <input
                                type="checkbox"
                                checked={!!formData.cpuUtilizationUnknown}
                                onChange={() => toggleUnknown('avgCpuUtilizationPct', 'cpuUtilizationUnknown')}
                              />
                              <span>Unknown</span>
                            </label>
                          </div>
                        </div>
                        <input
                          id="avgCpuUtilizationHybrid"
                          type="number"
                          min="0"
                          max="100"
                          placeholder={formData.cpuUtilizationUnknown ? 'Marked as unknown' : 'e.g. 45'}
                          disabled={!!formData.cpuUtilizationUnknown}
                          value={formData.avgCpuUtilizationPct ?? ''}
                          onChange={(e) => updateField('avgCpuUtilizationPct', e.target.value)}
                        />
                        {errors.avgCpuUtilizationPct && !formData.cpuUtilizationUnknown && (
                          <span className="screen2-error-text">{errors.avgCpuUtilizationPct}</span>
                        )}
                      </div>

                      {/* RAM Utilization */}
                      <div className={`screen2-field-group ${errors.avgRamUtilizationPct ? 'has-error' : ''} ${formData.ramUtilizationUnknown ? 'is-unknown' : ''}`}>
                        <div className="screen2-field-label-row">
                          <label htmlFor="avgRamUtilizationHybrid">Average RAM Utilization</label>
                          <div className="screen2-label-accessories">
                            <span className="screen2-unit-tag">%</span>
                            <label className="screen2-unknown-toggle">
                              <input
                                type="checkbox"
                                checked={!!formData.ramUtilizationUnknown}
                                onChange={() => toggleUnknown('avgRamUtilizationPct', 'ramUtilizationUnknown')}
                              />
                              <span>Unknown</span>
                            </label>
                          </div>
                        </div>
                        <input
                          id="avgRamUtilizationHybrid"
                          type="number"
                          min="0"
                          max="100"
                          placeholder={formData.ramUtilizationUnknown ? 'Marked as unknown' : 'e.g. 50'}
                          disabled={!!formData.ramUtilizationUnknown}
                          value={formData.avgRamUtilizationPct ?? ''}
                          onChange={(e) => updateField('avgRamUtilizationPct', e.target.value)}
                        />
                        {errors.avgRamUtilizationPct && !formData.ramUtilizationUnknown && (
                          <span className="screen2-error-text">{errors.avgRamUtilizationPct}</span>
                        )}
                      </div>
                    </div>
                  </section>

                  {/* Panel 3: Workload Requirements & Constraints */}
                  <section className="screen2-panel">
                    <div className="screen2-panel-header">
                      <div className="screen2-panel-icon-circle workload">⚖️</div>
                      <div>
                        <h2 className="screen2-panel-title">3. Workload Requirements & Constraints</h2>
                        <p className="screen2-panel-subtitle">
                          Target demand and regulatory compliance constraints governing placement.
                        </p>
                      </div>
                    </div>

                    <div className="screen2-fields-grid">
                      {/* Demand CPU */}
                      <div className={`screen2-field-group ${errors.workloadDemandCpu ? 'has-error' : ''}`}>
                        <div className="screen2-field-label-row">
                          <label htmlFor="workloadDemandCpuHybrid">Estimated Workload CPU Demand</label>
                          <span className="screen2-unit-tag">vCPU</span>
                        </div>
                        <input
                          id="workloadDemandCpuHybrid"
                          type="number"
                          min="1"
                          placeholder="e.g. 72"
                          value={formData.workloadDemandCpu ?? ''}
                          onChange={(e) => updateField('workloadDemandCpu', e.target.value)}
                        />
                        {errors.workloadDemandCpu && (
                          <span className="screen2-error-text">{errors.workloadDemandCpu}</span>
                        )}
                      </div>

                      {/* Demand RAM */}
                      <div className={`screen2-field-group ${errors.workloadDemandRam ? 'has-error' : ''}`}>
                        <div className="screen2-field-label-row">
                          <label htmlFor="workloadDemandRamHybrid">Estimated Workload RAM Demand</label>
                          <span className="screen2-unit-tag">GB</span>
                        </div>
                        <input
                          id="workloadDemandRamHybrid"
                          type="number"
                          min="1"
                          placeholder="e.g. 240"
                          value={formData.workloadDemandRam ?? ''}
                          onChange={(e) => updateField('workloadDemandRam', e.target.value)}
                        />
                        {errors.workloadDemandRam && (
                          <span className="screen2-error-text">{errors.workloadDemandRam}</span>
                        )}
                      </div>

                      {/* Residency Constraint */}
                      <div className="screen2-field-group">
                        <div className="screen2-field-label-row">
                          <label htmlFor="residencyConstraintSelect">Data Residency Policy</label>
                          <span className="screen2-unit-tag">Compliance</span>
                        </div>
                        <select
                          id="residencyConstraintSelect"
                          className="screen2-select-input"
                          value={formData.residencyConstraint || 'KARNATAKA_DC_ONLY'}
                          onChange={(e) => updateField('residencyConstraint', e.target.value as DataResidencyRequirement)}
                        >
                          <option value="KARNATAKA_DC_ONLY">Karnataka DC Only (Local On-Premises Isolation)</option>
                          <option value="INDIA_ONLY">India Sovereign Only (Local or Indian Cloud Regions)</option>
                          <option value="ANY_APPROVED_REGION">Any Approved Region (Unrestricted Cloud Offload)</option>
                        </select>
                      </div>

                      {/* Co-location requirement */}
                      <div className="screen2-field-group checkbox-align">
                        <label className="screen2-custom-checkbox-container">
                          <input
                            type="checkbox"
                            checked={!!formData.coLocationRequirement}
                            onChange={(e) => {
                              setIsDemoDataActive(false);
                              setFormData((prev) => ({ ...prev, coLocationRequirement: e.target.checked }));
                            }}
                          />
                          <span className="screen2-checkbox-box" />
                          <div className="screen2-checkbox-text-group">
                            <span className="screen2-checkbox-title">Co-location Required</span>
                            <span className="screen2-checkbox-desc">
                              Keep workload tightly coupled (sub-2ms latency) with local database
                            </span>
                          </div>
                        </label>
                      </div>
                    </div>

                    {/* Operational Notes */}
                    <div className="screen2-field-group full-width-field">
                      <div className="screen2-field-label-row">
                        <label htmlFor="workloadNotes">Operational Context & Notes</label>
                        <span className="screen2-unit-tag">Optional</span>
                      </div>
                      <input
                        id="workloadNotes"
                        type="text"
                        placeholder="e.g. Core payment gateway and ledger workloads requiring sub-2ms latency"
                        value={formData.workloadNotes || ''}
                        onChange={(e) => updateField('workloadNotes', e.target.value)}
                      />
                    </div>
                  </section>
                </div>
              )}

              {/* Bottom Form Actions */}
              <div className="screen2-form-footer">
                <button
                  type="button"
                  className="screen2-btn-secondary"
                  onClick={onBackToSetup}
                >
                  ← Back to Setup
                </button>

                <button type="submit" className="screen2-btn-primary">
                  <span>Analyze Infrastructure</span>
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </button>
              </div>
            </form>
          </main>

          {/* Right Column: Sticky Live Telemetry Preview Card */}
          <aside className="screen2-sidebar-column">
            <div className="screen2-telemetry-panel">
              <div className="screen2-telemetry-header">
                <div className="screen2-telemetry-header-title">
                  <span className={`screen2-pulse-dot ${isDemoDataActive ? 'amber' : 'teal'}`} />
                  <h3>Live Capacity Preview</h3>
                </div>
                <span className={`screen2-telemetry-tag ${isDemoDataActive ? 'demo' : ''}`}>
                  {isDemoDataActive ? 'Demo Values' : 'Real-Time'}
                </span>
              </div>

              <p className="screen2-telemetry-intro">
                Deterministic capacity and spend calculated dynamically from entered parameters:
              </p>

              <div className="screen2-telemetry-stats">
                {/* Total Compute */}
                <div className="screen2-stat-box">
                  <div className="screen2-stat-row">
                    <span className="screen2-stat-label">Total Compute Capacity</span>
                    <span className="screen2-stat-value teal">
                      {summaryMetrics.totalAvailableCpu > 0 ? `${summaryMetrics.totalAvailableCpu} Cores` : '—'}
                    </span>
                  </div>
                  {isHybrid && (
                    <div className="screen2-stat-subline">
                      <span>Local: {summaryMetrics.localCpu}c</span>
                      <span>·</span>
                      <span>Rented: {summaryMetrics.totalRentedCpu}c</span>
                    </div>
                  )}
                </div>

                {/* Total Memory */}
                <div className="screen2-stat-box">
                  <div className="screen2-stat-row">
                    <span className="screen2-stat-label">Total Memory Capacity</span>
                    <span className="screen2-stat-value blue">
                      {summaryMetrics.totalAvailableRam > 0 ? `${summaryMetrics.totalAvailableRam} GB` : '—'}
                    </span>
                  </div>
                  {isHybrid && (
                    <div className="screen2-stat-subline">
                      <span>Local: {summaryMetrics.localRam} GB</span>
                      <span>·</span>
                      <span>Rented: {summaryMetrics.totalRentedRam} GB</span>
                    </div>
                  )}
                </div>

                {/* Monthly Spend */}
                <div className="screen2-stat-box">
                  <div className="screen2-stat-row">
                    <span className="screen2-stat-label">Estimated Monthly Spend</span>
                    <span className="screen2-stat-value">
                      {summaryMetrics.totalEstimatedMonthlyCost !== null
                        ? `₹ ${summaryMetrics.totalEstimatedMonthlyCost.toLocaleString('en-IN')}`
                        : 'Cost unknown'}
                    </span>
                  </div>
                  {summaryMetrics.totalEstimatedMonthlyCost !== null && (
                    <div className="screen2-stat-subline">
                      <span>
                        {isHybrid
                          ? (formData.localCostUnknown ? 'Rented fleet only (Local unknown)' : 'Local operating + cloud lease')
                          : 'Rented cloud server lease'}
                      </span>
                    </div>
                  )}
                </div>

                {/* Workload Demand */}
                {(summaryMetrics.demandCpu !== null || summaryMetrics.demandRam !== null) && (
                  <div className="screen2-stat-box demand">
                    <div className="screen2-stat-row">
                      <span className="screen2-stat-label">Workload Target Demand</span>
                      <span className="screen2-stat-value amber">
                        {summaryMetrics.demandCpu !== null ? `${summaryMetrics.demandCpu}c` : '—'} /{' '}
                        {summaryMetrics.demandRam !== null ? `${summaryMetrics.demandRam} GB` : '—'}
                      </span>
                    </div>
                    <div className="screen2-stat-subline">
                      <span>
                        {summaryMetrics.totalAvailableCpu >= (summaryMetrics.demandCpu || 0)
                          ? `✓ Headroom: +${summaryMetrics.totalAvailableCpu - (summaryMetrics.demandCpu || 0)} cores`
                          : `⚠️ Deficit: ${summaryMetrics.totalAvailableCpu - (summaryMetrics.demandCpu || 0)} cores`}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Informational Callout */}
              <div className="screen2-sidebar-callout">
                <span className="screen2-callout-icon">💡</span>
                <p>
                  <strong>Strict Decision Support:</strong> Calculations are strictly deterministic based on your entered parameters. Unknown values are never invented.
                </p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};
