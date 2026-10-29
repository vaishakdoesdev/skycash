import React from 'react';

export interface StepItem {
  id: number;
  label: string;
  shortLabel: string;
}

export const APP_STEPS: StepItem[] = [
  { id: 1, label: '1. Infrastructure Setup', shortLabel: '1. Setup' },
  { id: 2, label: '2. Server Configuration', shortLabel: '2. Config' },
  { id: 3, label: '3. Analysis & Recommendation', shortLabel: '3. Analysis' },
  { id: 4, label: '4. Testing & Comparison', shortLabel: '4. Testing' },
  { id: 5, label: '5. SkyCash Final Verdict', shortLabel: '5. Verdict' },
];

interface StepProgressIndicatorProps {
  currentStep: number; // 1 to 5
  maxUnlockedStep: number; // Highest step number currently accessible
  onNavigateStep: (stepNumber: number) => void;
  className?: string;
}

export const StepProgressIndicator: React.FC<StepProgressIndicatorProps> = ({
  currentStep,
  maxUnlockedStep,
  onNavigateStep,
  className = '',
}) => {
  return (
    <nav
      className={`skycash-stepper-container ${className}`}
      aria-label="Application Progress Stepper"
    >
      <div className="skycash-stepper-track">
        {APP_STEPS.map((step, index) => {
          const isCompleted = step.id < currentStep && maxUnlockedStep >= step.id;
          const isActive = step.id === currentStep;
          const isAccessible = step.id <= maxUnlockedStep;
          const isClickable = isAccessible && step.id !== currentStep;

          return (
            <React.Fragment key={step.id}>
              {/* Connector line between steps */}
              {index > 0 && (
                <div
                  className={`skycash-stepper-connector ${
                    step.id <= currentStep ? 'completed' : isAccessible ? 'unlocked' : 'locked'
                  }`}
                  aria-hidden="true"
                />
              )}

              {/* Step Node */}
              <button
                type="button"
                className={`skycash-step-node ${
                  isActive
                    ? 'active'
                    : isCompleted
                    ? 'completed'
                    : isAccessible
                    ? 'unlocked'
                    : 'locked'
                }`}
                onClick={() => {
                  if (isClickable) {
                    onNavigateStep(step.id);
                  }
                }}
                disabled={!isClickable}
                aria-current={isActive ? 'step' : undefined}
                title={
                  isActive
                    ? `Current Step: ${step.label}`
                    : isClickable
                    ? `Navigate back to ${step.label}`
                    : `Step ${step.id} locked: Complete prerequisites first`
                }
              >
                <span className="skycash-step-icon">
                  {isCompleted ? '✓' : step.id}
                </span>
                <span className="skycash-step-label full-label">{step.label}</span>
                <span className="skycash-step-label short-label">{step.shortLabel}</span>
              </button>
            </React.Fragment>
          );
        })}
      </div>
    </nav>
  );
};
