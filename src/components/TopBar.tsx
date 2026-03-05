import React, { useState } from 'react';
import { GameState } from '../engine/types';
import { setVolume, getVolume, toggleMute } from '../engine/audioManager';

interface Props {
  state: GameState;
  onPause: () => void;
  onStop: () => void;
}

const TopBar: React.FC<Props> = ({ state, onPause, onStop }) => {
  const [muted, setMuted] = useState(false);
  const [vol, setVol] = useState(getVolume());

  const minutes = Math.floor(state.timeRemaining / 60);
  const seconds = state.timeRemaining % 60;
  const timeStr = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const timerClass = state.timeRemaining <= 60 ? 'critical' : state.timeRemaining <= 300 ? 'warning' : '';

  const pnlClass = (v: number) => v > 0 ? 'pnl-positive' : v < 0 ? 'pnl-negative' : 'pnl-neutral';

  const formatPnl = (v: number) => {
    const abs = Math.abs(v);
    const formatted = abs.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    return v < 0 ? `-${formatted}` : formatted;
  };

  const handleToggleMute = () => {
    const isMuted = toggleMute();
    setMuted(isMuted);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    setVol(v);
    setVolume(v);
    if (v > 0) setMuted(false);
  };

  return (
    <div className="top-bar">
      <div className="top-bar-left">
        <div className="top-bar-logo">
          <div className="logo-sm">TS</div>
          Trading Simulation
        </div>
        <div className="pnl-metrics">
          <div className="pnl-item">
            <span className="pnl-label">Realised P&L</span>
            <span className={`pnl-value ${pnlClass(state.realisedPnl)}`}>{formatPnl(state.realisedPnl)}</span>
          </div>
          <div className="pnl-item">
            <span className="pnl-label">Unrealised P&L</span>
            <span className={`pnl-value ${pnlClass(state.unrealisedPnl)}`}>{formatPnl(state.unrealisedPnl)}</span>
          </div>
          <div className="pnl-item">
            <span className="pnl-label">Net Exposure</span>
            <span className={`pnl-value ${pnlClass(state.netExposure)}`}>{formatPnl(state.netExposure)}</span>
          </div>
          <div className="pnl-item">
            <span className="pnl-label">Commission</span>
            <span className="pnl-value pnl-neutral">{formatPnl(state.commission)}</span>
          </div>
          <div className="pnl-item">
            <span className="pnl-label">Total P&L</span>
            <span className={`pnl-value ${pnlClass(state.totalPnl)}`}>{formatPnl(state.totalPnl)}</span>
          </div>
        </div>
      </div>
      <div className="top-bar-right">
        <div className={`timer ${timerClass}`}>
          ⏱ {timeStr}
        </div>
        <div className="game-controls">
          <button className="btn-control btn-audio" onClick={handleToggleMute} title={muted ? 'Unmute' : 'Mute'}>
            {muted ? '🔇' : '🔊'}
          </button>
          <input
            type="range"
            className="volume-slider"
            min="0"
            max="1"
            step="0.05"
            value={muted ? 0 : vol}
            onChange={handleVolumeChange}
            title={`Volume: ${Math.round(vol * 100)}%`}
          />
          <button className="btn-control" onClick={onPause} title={state.running ? 'Pause' : 'Resume'}>
            {state.running ? '⏸' : '▶'}
          </button>
          <button className="btn-control" onClick={onStop} title="Stop">
            ⏹
          </button>
        </div>
        <div className="player-info">
          <span>{state.myPlayer.name}</span> / {state.myPlayer.role}-{state.myPlayer.team}
        </div>
      </div>
    </div>
  );
};

export default TopBar;
