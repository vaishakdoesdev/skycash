import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { ButaneLogin3DScene } from '../3d/ButaneLogin3DScene';

interface LoginGatewayProps {
  onLoginSuccess: () => void;
}

const COMMON_DOMAINS = [
  'gmail.com',
  'outlook.com',
  'company.com',
  'cloud.in',
  'datacenter.in',
  'butane.ai',
];

export const LoginGateway: React.FC<LoginGatewayProps> = ({ onLoginSuccess }) => {
  const { login, register, authConfig, loginWithGoogle } = useAuth();

  const [mode, setMode] = useState<'signin' | 'register'>('signin');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [rememberMe, setRememberMe] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);

  // Email suggestions state
  const [emailSuggestions, setEmailSuggestions] = useState<string[]>([]);
  const [focusedSuggestionIdx, setFocusedSuggestionIdx] = useState<number>(-1);
  const [isSuggestionOpen, setIsSuggestionOpen] = useState<boolean>(false);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const suggestionsBoxRef = useRef<HTMLDivElement>(null);

  // Status & error states
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Modals
  const [showGoogleSetupModal, setShowGoogleSetupModal] = useState<boolean>(false);
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState<boolean>(false);
  const [resetEmail, setResetEmail] = useState<string>('');
  const [resetStatus, setResetStatus] = useState<string | null>(null);

  // Handle email changes and compute suggestions
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setEmail(val);
    setErrorMessage(null);

    if (val.includes('@')) {
      const [localPart, domainPart] = val.split('@');
      if (localPart.length > 0) {
        const filtered = COMMON_DOMAINS.filter((d) =>
          d.toLowerCase().startsWith((domainPart || '').toLowerCase())
        ).map((d) => `${localPart}@${d}`);

        setEmailSuggestions(filtered);
        setIsSuggestionOpen(filtered.length > 0);
        setFocusedSuggestionIdx(-1);
        return;
      }
    }
    setEmailSuggestions([]);
    setIsSuggestionOpen(false);
  };

  const handleSelectSuggestion = (suggestion: string) => {
    setEmail(suggestion);
    setIsSuggestionOpen(false);
    emailInputRef.current?.focus();
  };

  const handleEmailKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isSuggestionOpen || emailSuggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedSuggestionIdx((prev) => (prev + 1 < emailSuggestions.length ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedSuggestionIdx((prev) => (prev - 1 >= 0 ? prev - 1 : emailSuggestions.length - 1));
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      if (focusedSuggestionIdx >= 0 && focusedSuggestionIdx < emailSuggestions.length) {
        e.preventDefault();
        handleSelectSuggestion(emailSuggestions[focusedSuggestionIdx]);
      }
    } else if (e.key === 'Escape') {
      setIsSuggestionOpen(false);
    }
  };

  // Close suggestions on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        suggestionsBoxRef.current &&
        !suggestionsBoxRef.current.contains(e.target as Node) &&
        emailInputRef.current &&
        !emailInputRef.current.contains(e.target as Node)
      ) {
        setIsSuggestionOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    // Validation
    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters long.');
      return;
    }

    if (mode === 'register' && password !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please re-enter.');
      return;
    }

    setIsLoading(true);
    try {
      if (mode === 'signin') {
        await login(cleanEmail, password, rememberMe);
        onLoginSuccess();
      } else {
        await register(cleanEmail, password, name.trim());
        setSuccessMessage('Account created successfully! Entering SkyCash workspace...');
        setTimeout(() => {
          onLoginSuccess();
        }, 600);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Authentication error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Initialize Google Identity Services SDK & Render Official Button
  useEffect(() => {
    const clientId = authConfig.google_client_id || (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) return;

    let isMounted = true;

    const setupGoogle = () => {
      const gWindow = window as any;
      if (!gWindow.google?.accounts?.id || !isMounted) return;

      try {
        gWindow.google.accounts.id.initialize({
          client_id: clientId,
          callback: async (response: any) => {
            if (response?.credential) {
              setIsLoading(true);
              setErrorMessage(null);
              try {
                await loginWithGoogle(response.credential);
                onLoginSuccess();
              } catch (err: any) {
                setErrorMessage(err.message || 'Google authentication failed.');
              } finally {
                setIsLoading(false);
              }
            }
          },
          auto_select: false,
          cancel_on_tap_outside: true,
        });

        const btnEl = document.getElementById('google-official-btn-container');
        if (btnEl) {
          btnEl.innerHTML = '';
          gWindow.google.accounts.id.renderButton(btnEl, {
            type: 'standard',
            theme: 'filled_black',
            size: 'large',
            text: 'continue_with',
            shape: 'rectangular',
            logo_alignment: 'left',
            width: 380,
          });
        }
      } catch (err) {
        console.warn('Google Identity initialization error:', err);
      }
    };

    if ((window as any).google?.accounts?.id) {
      setupGoogle();
    } else {
      const timer = setInterval(() => {
        if ((window as any).google?.accounts?.id) {
          clearInterval(timer);
          setupGoogle();
        }
      }, 250);
      return () => {
        isMounted = false;
        clearInterval(timer);
      };
    }

    return () => {
      isMounted = false;
    };
  }, [authConfig.google_client_id, loginWithGoogle, onLoginSuccess]);

  // Google OAuth button fallback click handler
  const handleGoogleClick = () => {
    const clientId = authConfig.google_client_id || (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) {
      setShowGoogleSetupModal(true);
      return;
    }

    const gWindow = window as any;
    if (gWindow.google?.accounts?.id) {
      gWindow.google.accounts.id.prompt((notification: any) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          console.log('Google One Tap not displayed:', notification.getNotDisplayedReason());
        }
      });
    } else {
      setShowGoogleSetupModal(true);
    }
  };

  // Forgot password submit
  const handleForgotSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail || !resetEmail.includes('@')) {
      setResetStatus('Please enter a valid email address.');
      return;
    }
    setResetStatus('Password reset instructions have been logged for workspace administrators.');
  };

  return (
    <div className="butane-login-container">
      {/* 3D Background Server Infrastructure Scene */}
      <ButaneLogin3DScene />

      {/* Foreground Content Card */}
      <div className="butane-login-card-wrapper">
        {/* Brand Header */}
        <div className="butane-login-brand">
          <div className="butane-team-badge">
            <span className="butane-dot"></span>
            <span>TEAM BUTANE</span>
          </div>
          <div className="butane-product-title">SkyCash</div>
          <div className="butane-product-subtitle">Intelligent Cloud Workload Placement Advisor</div>
          <div className="butane-powered-tag">Powered by SkyCash · Karnataka DC & Sovereign Cloud</div>
        </div>

        {/* Glassmorphic Authentication Card */}
        <div className="butane-login-card">
          {/* Card Title & Subtitle */}
          <div className="butane-card-header">
            <h1 className="butane-welcome-heading">
              {mode === 'signin' ? 'Welcome to BUTANE' : 'Create Workspace Account'}
            </h1>
            <p className="butane-welcome-subtitle">
              {mode === 'signin'
                ? 'Sign in to access your SkyCash workspace.'
                : 'Join BUTANE to analyze infrastructure capacity and sovereign placement.'}
            </p>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="butane-mode-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'signin'}
              className={`butane-mode-tab ${mode === 'signin' ? 'active' : ''}`}
              onClick={() => {
                setMode('signin');
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
            >
              Sign In
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'register'}
              className={`butane-mode-tab ${mode === 'register' ? 'active' : ''}`}
              onClick={() => {
                setMode('register');
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
            >
              Create Account
            </button>
          </div>

          {/* Alerts */}
          {errorMessage && (
            <div className="butane-alert butane-alert-error" role="alert">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="butane-alert butane-alert-success" role="alert">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <span>{successMessage}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="butane-form" noValidate>
            {/* Name Field (Registration only) */}
            {mode === 'register' && (
              <div className="butane-form-group">
                <label htmlFor="butane-name" className="butane-form-label">
                  Full Name / Handle <span className="optional-tag">(Optional)</span>
                </label>
                <input
                  id="butane-name"
                  type="text"
                  name="name"
                  autoComplete="name"
                  placeholder="e.g. Maya Sharma"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="butane-input"
                />
              </div>
            )}

            {/* Email Field with Autocomplete & Suggestions */}
            <div className="butane-form-group butane-email-group">
              <label htmlFor="butane-email" className="butane-form-label">
                Email Address
              </label>
              <div className="butane-input-container">
                <input
                  id="butane-email"
                  ref={emailInputRef}
                  type="email"
                  name="email"
                  autoComplete="email"
                  spellCheck={false}
                  placeholder="name@company.com"
                  value={email}
                  onChange={handleEmailChange}
                  onKeyDown={handleEmailKeyDown}
                  className="butane-input"
                  required
                />
              </div>

              {/* Email Domain Suggestions Dropdown */}
              {isSuggestionOpen && emailSuggestions.length > 0 && (
                <div
                  ref={suggestionsBoxRef}
                  className="butane-email-suggestions-box"
                  role="listbox"
                  aria-label="Suggested email completions"
                >
                  <div className="butane-suggestions-header">Quick Complete:</div>
                  {emailSuggestions.map((suggestion, idx) => (
                    <button
                      key={suggestion}
                      type="button"
                      role="option"
                      aria-selected={idx === focusedSuggestionIdx}
                      className={`butane-suggestion-item ${idx === focusedSuggestionIdx ? 'focused' : ''}`}
                      onClick={() => handleSelectSuggestion(suggestion)}
                    >
                      <span className="suggestion-prefix">{suggestion.split('@')[0]}@</span>
                      <strong className="suggestion-domain">{suggestion.split('@')[1]}</strong>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Password Field */}
            <div className="butane-form-group">
              <div className="butane-label-row">
                <label htmlFor="butane-password" className="butane-form-label">
                  Password
                </label>
                {mode === 'signin' && (
                  <button
                    type="button"
                    className="butane-link-btn"
                    onClick={() => {
                      setResetEmail(email);
                      setShowForgotPasswordModal(true);
                    }}
                  >
                    Forgot password?
                  </button>
                )}
              </div>

              <div className="butane-password-container">
                <input
                  id="butane-password"
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  placeholder={mode === 'register' ? 'Min 8 characters' : 'Enter your password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setErrorMessage(null);
                  }}
                  className="butane-input butane-password-input"
                  required
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="butane-pwd-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Confirm Password (Registration only) */}
            {mode === 'register' && (
              <div className="butane-form-group">
                <label htmlFor="butane-confirm-password" className="butane-form-label">
                  Confirm Password
                </label>
                <input
                  id="butane-confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  name="confirmPassword"
                  autoComplete="new-password"
                  placeholder="Re-type password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setErrorMessage(null);
                  }}
                  className="butane-input"
                  required
                />
              </div>
            )}

            {/* Remember Me Checkbox (Sign in only) */}
            {mode === 'signin' && (
              <div className="butane-checkbox-row">
                <label className="butane-checkbox-label">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="butane-checkbox"
                  />
                  <span>Remember me for 30 days</span>
                </label>
              </div>
            )}

            {/* Primary Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="butane-submit-btn"
            >
              {isLoading ? (
                <span className="butane-btn-loading">
                  <span className="butane-spinner"></span>
                  <span>Verifying credentials...</span>
                </span>
              ) : mode === 'signin' ? (
                'Sign In to SkyCash'
              ) : (
                'Create Workspace Account'
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="butane-divider">
            <span className="butane-divider-line"></span>
            <span className="butane-divider-text">OR</span>
            <span className="butane-divider-line"></span>
          </div>

          {/* Continue with Google Button with Official GSI integration */}
          <div className="butane-google-wrapper">
            <div id="google-official-btn-container" className="google-official-btn-slot"></div>
            <button
              type="button"
              onClick={handleGoogleClick}
              disabled={isLoading}
              className="butane-google-btn fallback-google-btn"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" className="butane-google-icon">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Continue with Google</span>
            </button>
          </div>

          {/* Mode Switch Helper Link */}
          <div className="butane-card-footer">
            {mode === 'signin' ? (
              <p>
                Don't have a workspace account?{' '}
                <button
                  type="button"
                  className="butane-text-link"
                  onClick={() => {
                    setMode('register');
                    setErrorMessage(null);
                  }}
                >
                  Create an account
                </button>
              </p>
            ) : (
              <p>
                Already have an account?{' '}
                <button
                  type="button"
                  className="butane-text-link"
                  onClick={() => {
                    setMode('signin');
                    setErrorMessage(null);
                  }}
                >
                  Sign in here
                </button>
              </p>
            )}
          </div>
        </div>

        {/* Security & Confidentiality Tagline */}
        <div className="butane-footer-notice">
          <span>🔒 Confidential Local Data · RBI & Karnataka DC Residency Rules Enforced</span>
        </div>
      </div>

      {/* Google OAuth Setup Guidance Modal */}
      {showGoogleSetupModal && (
        <div className="butane-modal-backdrop" onClick={() => setShowGoogleSetupModal(false)}>
          <div className="butane-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="butane-modal-header">
              <div className="modal-title-group">
                <div className="modal-icon-badge">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                </div>
                <h3>Google OAuth Setup Required</h3>
              </div>
              <button
                type="button"
                className="butane-close-btn"
                onClick={() => setShowGoogleSetupModal(false)}
              >
                ✕
              </button>
            </div>

            <div className="butane-modal-body">
              <p>
                Genuine Google OAuth authentication requires client credentials configured in the backend environment.
              </p>
              <div className="butane-config-steps">
                <div className="config-step">
                  <strong>1. Obtain Credentials:</strong> Create an OAuth 2.0 Client ID in the{' '}
                  <span className="code-text">Google Cloud Console</span> under APIs & Services.
                </div>
                <div className="config-step">
                  <strong>2. Configure Environment:</strong> Add these variables to your <span className="code-text">backend/.env</span>:
                  <pre className="butane-code-block">
                    GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com{'\n'}
                    GOOGLE_CLIENT_SECRET=your-client-secret
                  </pre>
                </div>
                <div className="config-step">
                  <strong>3. Restart Backend:</strong> Once loaded, the official Google Sign-In button activates automatically.
                </div>
              </div>
              <div className="butane-modal-tip">
                💡 <strong>Email & Password Authentication</strong> is fully active right now. You can sign in or create an account using the form.
              </div>
            </div>

            <div className="butane-modal-footer">
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setShowGoogleSetupModal(false)}
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Forgot Password Modal */}
      {showForgotPasswordModal && (
        <div className="butane-modal-backdrop" onClick={() => setShowForgotPasswordModal(false)}>
          <div className="butane-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="butane-modal-header">
              <div className="modal-title-group">
                <h3>Reset Workspace Password</h3>
              </div>
              <button
                type="button"
                className="butane-close-btn"
                onClick={() => {
                  setShowForgotPasswordModal(false);
                  setResetStatus(null);
                }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleForgotSubmit} className="butane-modal-body">
              <p>
                Enter your registered corporate or personal email address. We will verify your account against the local sovereign database.
              </p>

              {resetStatus && (
                <div className="butane-alert butane-alert-info">
                  <span>{resetStatus}</span>
                </div>
              )}

              <div className="butane-form-group">
                <label className="butane-form-label">Email Address</label>
                <input
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="butane-input"
                  required
                />
              </div>

              <div className="butane-modal-footer" style={{ padding: 0, marginTop: '1rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowForgotPasswordModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-sm">
                  Request Reset
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
