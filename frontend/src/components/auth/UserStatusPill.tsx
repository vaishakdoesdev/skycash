import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';

interface UserStatusPillProps {
  onOpenUploader?: () => void;
}

export const UserStatusPill: React.FC<UserStatusPillProps> = ({ onOpenUploader }) => {
  const { user, logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState<boolean>(false);

  if (!user) return null;

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
    } finally {
      setIsLoggingOut(false);
    }
  };

  const initials = user.name
    ? user.name
        .split(' ')
        .map((p) => p[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : user.email.slice(0, 2).toUpperCase();

  return (
    <div className="butane-user-pill-container" title={`Signed in as ${user.email}`}>
      {onOpenUploader && (
        <button
          type="button"
          onClick={onOpenUploader}
          className="butane-load-inventory-btn"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            background: 'linear-gradient(135deg, rgba(72, 217, 208, 0.2), rgba(100, 140, 255, 0.2))',
            border: '1px solid rgba(72, 217, 208, 0.5)',
            color: '#48d9d0',
            borderRadius: '16px',
            padding: '0.3rem 0.75rem',
            fontSize: '0.75rem',
            fontWeight: 700,
            cursor: 'pointer',
            marginRight: '0.25rem',
            boxShadow: '0 2px 8px rgba(72, 217, 208, 0.25)',
          }}
          title="Load Custom Workload Inventory (JSON)"
        >
          <span>📂</span>
          <span>Load Inventory</span>
        </button>
      )}
      <div className="butane-user-avatar">{initials}</div>
      <div className="butane-user-details">
        <span className="butane-user-team">BUTANE</span>
        <span className="butane-user-email">{user.email}</span>
      </div>
      <button
        type="button"
        disabled={isLoggingOut}
        onClick={handleLogout}
        className="butane-logout-btn"
        title="Sign out of SkyCash workspace"
      >
        {isLoggingOut ? (
          '...'
        ) : (
          <>
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span>Sign Out</span>
          </>
        )}
      </button>
    </div>
  );
};
