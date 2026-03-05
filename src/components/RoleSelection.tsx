import React, { useState } from 'react';
import { Role } from '../engine/types';

interface Props {
  onSelectRole: (role: Role, name: string) => void;
  onGoToReview?: () => void;
}

const RoleSelection: React.FC<Props> = ({ onSelectRole, onGoToReview }) => {
  const [name, setName] = useState('');

  const handleSelect = (role: Role) => {
    const playerName = name.trim() || 'You';
    onSelectRole(role, playerName);
  };

  return (
    <div className="role-selection">
      <div className="logo-area">
        <div className="logo-icon">TS</div>
        <div>
          <h1>Trading Simulation</h1>
          <div className="subtitle">Amplify Your Trading Skills</div>
        </div>
      </div>

      <div className="name-input-area">
        <label>Your Name</label>
        <input
          type="text"
          placeholder="Enter your name..."
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && name.trim()) {
              // Focus moves to role selection
            }
          }}
        />
      </div>

      <div style={{ color: '#8899aa', marginBottom: '20px', fontSize: '0.9rem' }}>
        Choose your role — 30-minute session, 50 IB + 50 AM players
      </div>

      <div className="role-cards">
        <div className="role-card" onClick={() => handleSelect('IB')}>
          <div className="role-icon">🏦</div>
          <h2>Investment Bank (IB)</h2>
          <p>
            Provide quotes to AM clients.<br />
            Make markets, manage risk,<br />
            earn the bid-offer spread.
          </p>
        </div>
        <div className="role-card" onClick={() => handleSelect('AM')}>
          <div className="role-icon">📊</div>
          <h2>Asset Manager (AM)</h2>
          <p>
            Build a portfolio for clients.<br />
            Trade based on market news,<br />
            maximize P&L returns.
          </p>
        </div>
      </div>

      <div style={{ marginTop: '24px', display: 'flex', gap: '12px', alignItems: 'center' }}>
        {onGoToReview && (
          <button
            onClick={onGoToReview}
            style={{
              background: '#1a2332',
              border: '1px solid #2a3a50',
              color: '#8899aa',
              padding: '10px 24px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: 500,
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#2a3a50'; e.currentTarget.style.color = '#fff'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#1a2332'; e.currentTarget.style.color = '#8899aa'; }}
          >
            📊 复盘中心
          </button>
        )}
      </div>

      <div style={{ color: '#3a5068', marginTop: '16px', fontSize: '0.75rem' }}>
        49 AI players will join your side. Press a role card to begin.
      </div>
    </div>
  );
};

export default RoleSelection;
