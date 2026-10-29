import React, { useState } from 'react';
import { HiredServerScene } from './3d/HiredServerScene';
import { HybridServerScene } from './3d/HybridServerScene';
import { BackgroundCyberGrid } from './3d/BackgroundCyberGrid';
import { StepProgressIndicator } from './StepProgressIndicator';

export type InfrastructureChoice = 'hired' | 'hybrid';

interface InfrastructureSelectorProps {
  onSelectSetup: (choice: InfrastructureChoice) => void;
  initialChoice?: InfrastructureChoice;
  maxUnlockedStep?: number;
  onNavigateStep?: (stepNumber: number) => void;
}

export const InfrastructureSelector: React.FC<InfrastructureSelectorProps> = ({
  onSelectSetup,
  initialChoice = 'hybrid',
  maxUnlockedStep = 1,
  onNavigateStep,
}) => {
  const [selectedChoice, setSelectedChoice] = useState<InfrastructureChoice>(initialChoice);
  const [hoveredChoice, setHoveredChoice] = useState<InfrastructureChoice | null>(null);

  const handleSelectAndProceed = (choice: InfrastructureChoice) => {
    setSelectedChoice(choice);
    onSelectSetup(choice);
  };

  return (
    <div className="selector-experience-container">
      {/* 3D Cyber Grid & Particle Field */}
      <BackgroundCyberGrid />

      {/* Header */}
      <header className="selector-header">
        <div className="selector-brand-badge">
          <div className="selector-logo-icon">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M3 15a4 4 0 0 0 4 4h10a5 5 0 0 0 1.5-9.76A6 6 0 0 0 6.6 7.4 4 4 0 0 0 3 15z" />
              <path d="M12 12v4m-2-2h4" />
            </svg>
          </div>
          <div>
            <div className="brand-name">SkyCash</div>
            <div className="brand-tagline">Intelligent Infrastructure Placement Advisor</div>
          </div>
        </div>

        {/* 5-Step Progress Stepper */}
        {onNavigateStep ? (
          <StepProgressIndicator
            currentStep={1}
            maxUnlockedStep={maxUnlockedStep}
            onNavigateStep={onNavigateStep}
            className="selector-header-stepper"
          />
        ) : (
          <div className="header-status-pill">
            <span className="pulsing-beacon"></span>
            <span>Step 1 of 5: Infrastructure Setup</span>
          </div>
        )}
      </header>

      {/* Hero Introduction */}
      <div className="selector-hero">
        <h1 className="hero-heading">Choose Your Infrastructure Setup</h1>
        <p className="hero-subtitle">
          Compare your infrastructure options and discover whether your current setup is over-provisioned,
          under-provisioned, or better suited to a hybrid deployment.
        </p>
      </div>

      {/* Two Clean, Prominent 3D Interactive Options */}
      <div className="options-grid">
        {/* OPTION A: HIRED SERVER */}
        <div
          className={`option-card ${selectedChoice === 'hired' ? 'active-selected' : ''}`}
          onClick={() => setSelectedChoice('hired')}
          onMouseEnter={() => setHoveredChoice('hired')}
          onMouseLeave={() => setHoveredChoice(null)}
          role="button"
          tabIndex={0}
          aria-label="Option A: Hired Server"
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setSelectedChoice('hired');
            }
          }}
        >
          <div className="option-glow-border"></div>

          {/* 3D Canvas Viewport */}
          <div className="option-3d-viewport">
            <HiredServerScene
              isHovered={hoveredChoice === 'hired'}
              isSelected={selectedChoice === 'hired'}
            />
            <div className="canvas-interaction-hint">
              <span>⟲ Move cursor to inspect 3D server</span>
            </div>
          </div>

          {/* Option Content */}
          <div className="option-details">
            <div className="option-top-row">
              <span className="option-label-tag">OPTION A</span>
              <span className="option-badge cloud">Rented Cloud Compute</span>
            </div>

            <h2 className="option-title">HIRED SERVER</h2>

            <p className="option-description">
              “Evaluate your rented server capacity against your workload requirements.”
            </p>

            <div className="option-action-footer">
              <button
                type="button"
                className={`btn-select-choice ${selectedChoice === 'hired' ? 'selected' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleSelectAndProceed('hired');
                }}
              >
                {selectedChoice === 'hired' ? 'Configure Hired Server →' : 'Select Hired Server'}
              </button>
            </div>
          </div>
        </div>

        {/* OPTION B: LOCAL + HIRED SERVER */}
        <div
          className={`option-card ${selectedChoice === 'hybrid' ? 'active-selected' : ''}`}
          onClick={() => setSelectedChoice('hybrid')}
          onMouseEnter={() => setHoveredChoice('hybrid')}
          onMouseLeave={() => setHoveredChoice(null)}
          role="button"
          tabIndex={0}
          aria-label="Option B: Local plus Hired Server"
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setSelectedChoice('hybrid');
            }
          }}
        >
          <div className="option-glow-border teal"></div>

          {/* 3D Canvas Viewport */}
          <div className="option-3d-viewport">
            <HybridServerScene
              isHovered={hoveredChoice === 'hybrid'}
              isSelected={selectedChoice === 'hybrid'}
            />
            <div className="canvas-interaction-hint">
              <span>⟲ Move cursor to inspect 3D hybrid bridge</span>
            </div>
          </div>

          {/* Option Content */}
          <div className="option-details">
            <div className="option-top-row">
              <span className="option-label-tag">OPTION B</span>
              <span className="option-badge hybrid">Hybrid Placement</span>
            </div>

            <h2 className="option-title">LOCAL + HIRED SERVER</h2>

            <p className="option-description">
              “Evaluate whether workloads should run locally or on rented infrastructure.”
            </p>

            <div className="option-action-footer">
              <button
                type="button"
                className={`btn-select-choice teal ${selectedChoice === 'hybrid' ? 'selected' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleSelectAndProceed('hybrid');
                }}
              >
                {selectedChoice === 'hybrid' ? 'Configure Hybrid Setup →' : 'Select Hybrid Setup'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Floating Bar */}
      <footer className="selector-bottom-bar">
        <div className="selected-summary-box">
          <span className="summary-label">Selected Setup:</span>
          <span className="summary-val">
            {selectedChoice === 'hired'
              ? 'Option A · Hired Server (Rented Cloud Infrastructure)'
              : 'Option B · Local + Hired Server (Hybrid Architecture)'}
          </span>
        </div>

        <button
          className="btn-continue-experience ready"
          onClick={() => handleSelectAndProceed(selectedChoice)}
        >
          <span>Continue to Configuration</span>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4">
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </button>
      </footer>
    </div>
  );
};
