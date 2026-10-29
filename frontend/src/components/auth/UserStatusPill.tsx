import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';

interface UserStatusPillProps {
  onOpenUploader?: () => void;
}

export const UserStatusPill: React.FC<UserStatusPillProps> = ({ onOpenUploader }) => {
  const { user } = useAuth();

  const initials = user?.name
    ? user.name
        .split(' ')
        .map((p) => p[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'SC';

  return (
    <div className="butane-user-pill-container" title="SkyCash Decision Support Workspace">
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
        <span className="butane-user-team">SkyCash</span>
        <span className="butane-user-email">{user?.email || 'Live Workspace'}</span>
      </div>
    </div>
  );
};
