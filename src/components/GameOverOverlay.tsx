import React, { useState } from 'react';
import { GameState, ScoreCard } from '../engine/types';

interface Props {
  state: GameState;
  scoreCard: ScoreCard;
  onRestart: () => void;
  onSave?: () => void;
  onGoToReview?: () => void;
  saving?: boolean;
}

const RingChart: React.FC<{
  value: number;
  size: number;
  strokeWidth: number;
  color: string;
  label: string;
  onClick?: () => void;
}> = ({ value, size, strokeWidth, color, label, onClick }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  const center = size / 2;

  return (
    <div
      style={{ textAlign: 'center', cursor: onClick ? 'pointer' : 'default' }}
      onClick={onClick}
      title={`${label}: ${value}%`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={center} cy={center} r={radius} fill="none" stroke="#2a3a50" strokeWidth={strokeWidth} />
        <circle
          cx={center} cy={center} r={radius}
          fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${center} ${center})`}
          style={{ transition: 'stroke-dashoffset 1s ease' }}
        />
        <text x={center} y={center - 6} textAnchor="middle" fill="#fff" fontSize={size > 100 ? '1rem' : '0.7rem'} fontWeight="600">{label}</text>
        <text x={center} y={center + (size > 100 ? 14 : 10)} textAnchor="middle" fill="#fff" fontSize={size > 100 ? '1.3rem' : '0.85rem'} fontWeight="700">{value}%</text>
      </svg>
    </div>
  );
};

const MetricTooltip: React.FC<{ label: string; description: string }> = ({ label, description }) => (
  <div style={{
    background: '#1a2332', border: '1px solid #2a3a50', borderRadius: 8,
    padding: '10px 14px', marginTop: 8, textAlign: 'left', fontSize: '0.75rem', lineHeight: 1.5,
  }}>
    <div style={{ color: '#fff', fontWeight: 600, marginBottom: 4 }}>{label}</div>
    <div style={{ color: '#8899aa' }}>{description}</div>
  </div>
);

const METRIC_DESCRIPTIONS: Record<string, string> = {
  CM: 'Client Matching — How many client trade requests did you successfully match and fulfill? Communicate regularly with clients to form and maintain strong relationships.',
  COMM: 'Commission — How much commission did you earn by facilitating client trades? Maximise commission by facilitating as many client trades as you can.',
  CT: 'Chat Trades — What percentage of your trades were done through quotes/chat vs the exchange? Trading through quotes demonstrates strong client relationships.',
  FFC: 'Fat Finger Count — How many trades had prices deviating more than 5% from market price? Higher score means fewer pricing errors.',
  EIC: 'Exchange Impact Count — When trading on the exchange, did your large orders move the market? Break positions into smaller execution sizes to avoid market impact.',
  ETM: 'Exchange Trade Metric — How effectively did you break up large block trades into smaller sizes when unwinding risk on the exchange? Measuring your appreciation for liquidity risk.',
  PnL: 'Profit and Loss — For an Investment Bank, profit is risk. Ensure your PnL does not exceed your final amount of commission.',
  PRM: 'Price Making — How competitive were your bid-offer spreads compared to other investment banks? Tight spreads mean clients are more likely to trade with you.',
  SSRM: 'Sell Side Risk Management — How effectively did you unwind risk positions throughout the simulation? Are you able to reduce your market positions in an efficient manner?',
};

const GameOverOverlay: React.FC<Props> = ({ state, scoreCard, onRestart, onSave, onGoToReview, saving }) => {
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const formatVal = (n: number) => {
    const sign = n >= 0 ? '+' : '-';
    return `${sign}$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const handleSave = async () => {
    if (onSave) {
      await onSave();
      setSaved(true);
    }
  };

  const stColor = scoreCard.salesTraderOverall >= 60 ? '#5b7fb5' : '#c04040';
  const mmColor = scoreCard.marketMakerOverall >= 60 ? '#5b7fb5' : '#c04040';

  return (
    <div className="game-over-overlay">
      <div className="game-over-card" style={{ minWidth: 700, maxWidth: 850 }}>
        <h2>Session Complete</h2>
        <div style={{ color: '#6b7c93', fontSize: '0.85rem', marginBottom: 16 }}>
          30-minute trading session has ended
        </div>

        {/* Summary Stats */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 30, marginBottom: 24, flexWrap: 'wrap' }}>
          <div className="stat-item" style={{ minWidth: 100 }}>
            <div className="stat-label">Total P&L</div>
            <div className={`stat-value ${state.totalPnl >= 0 ? 'pnl-positive' : 'pnl-negative'}`}>{formatVal(state.totalPnl)}</div>
          </div>
          <div className="stat-item" style={{ minWidth: 100 }}>
            <div className="stat-label">Commission</div>
            <div className="stat-value" style={{ color: '#f0b90b' }}>${state.commission.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
          </div>
          <div className="stat-item" style={{ minWidth: 100 }}>
            <div className="stat-label">Total Trades</div>
            <div className="stat-value">{state.myTrades.length}</div>
          </div>
          <div className="stat-item" style={{ minWidth: 100 }}>
            <div className="stat-label">Role</div>
            <div className="stat-value">{state.myPlayer.role}-{state.myPlayer.team}</div>
          </div>
        </div>

        {/* ROLE PERFORMANCE METRICS */}
        <div style={{ background: '#f5f5f5', borderRadius: 12, padding: '24px 20px', color: '#333', marginBottom: 16 }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#222', marginBottom: 4, textAlign: 'left' }}>
            ROLE PERFORMANCE METRICS
          </h3>

          {/* Sales Trader Section */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: '0.75rem', color: '#666', fontWeight: 600, textAlign: 'left', marginBottom: 12 }}>SALES TRADER</div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
              <RingChart value={scoreCard.salesTraderOverall} size={130} strokeWidth={10} color={stColor} label="SALES TRADER" />
              <div style={{ width: '80%', height: 1, background: '#ddd', position: 'relative', margin: '4px 0' }}>
                <div style={{ position: 'absolute', left: '50%', top: -4, width: 1, height: 8, background: '#ccc' }} />
              </div>
              <div style={{ display: 'flex', gap: 20, justifyContent: 'center', flexWrap: 'wrap' }}>
                <RingChart value={scoreCard.salesTrader.clientMatching} size={72} strokeWidth={6} color={scoreCard.salesTrader.clientMatching >= 60 ? '#5b7fb5' : '#999'} label="CM" onClick={() => setSelectedMetric(selectedMetric === 'CM' ? null : 'CM')} />
                <RingChart value={scoreCard.salesTrader.commission} size={72} strokeWidth={6} color={scoreCard.salesTrader.commission >= 60 ? '#5b7fb5' : '#999'} label="COMM" onClick={() => setSelectedMetric(selectedMetric === 'COMM' ? null : 'COMM')} />
                <RingChart value={scoreCard.salesTrader.chatTrades} size={72} strokeWidth={6} color={scoreCard.salesTrader.chatTrades >= 60 ? '#5b7fb5' : '#999'} label="CT" onClick={() => setSelectedMetric(selectedMetric === 'CT' ? null : 'CT')} />
                <RingChart value={scoreCard.salesTrader.fatFingerCount} size={72} strokeWidth={6} color={scoreCard.salesTrader.fatFingerCount >= 60 ? '#5b7fb5' : '#999'} label="FFC" onClick={() => setSelectedMetric(selectedMetric === 'FFC' ? null : 'FFC')} />
              </div>
            </div>
            {(selectedMetric === 'CM' || selectedMetric === 'COMM' || selectedMetric === 'CT' || selectedMetric === 'FFC') && (
              <MetricTooltip label={selectedMetric} description={METRIC_DESCRIPTIONS[selectedMetric]} />
            )}
          </div>

          <div style={{ height: 1, background: '#ddd', margin: '16px 0' }} />

          {/* Market Maker Section */}
          <div>
            <div style={{ fontSize: '0.75rem', color: '#666', fontWeight: 600, textAlign: 'left', marginBottom: 12 }}>MARKET MAKER</div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
              <RingChart value={scoreCard.marketMakerOverall} size={130} strokeWidth={10} color={mmColor} label="MARKET MAKER" />
              <div style={{ width: '80%', height: 1, background: '#ddd', position: 'relative', margin: '4px 0' }}>
                <div style={{ position: 'absolute', left: '50%', top: -4, width: 1, height: 8, background: '#ccc' }} />
              </div>
              <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
                <RingChart value={scoreCard.marketMaker.exchangeImpactCount} size={72} strokeWidth={6} color={scoreCard.marketMaker.exchangeImpactCount >= 60 ? '#5b7fb5' : '#c04040'} label="EIC" onClick={() => setSelectedMetric(selectedMetric === 'EIC' ? null : 'EIC')} />
                <RingChart value={scoreCard.marketMaker.exchangeTradeMetric} size={72} strokeWidth={6} color={scoreCard.marketMaker.exchangeTradeMetric >= 60 ? '#5b7fb5' : '#c04040'} label="ETM" onClick={() => setSelectedMetric(selectedMetric === 'ETM' ? null : 'ETM')} />
                <RingChart value={scoreCard.marketMaker.pnl} size={72} strokeWidth={6} color={scoreCard.marketMaker.pnl >= 60 ? '#5b7fb5' : '#c04040'} label="PnL" onClick={() => setSelectedMetric(selectedMetric === 'PnL' ? null : 'PnL')} />
                <RingChart value={scoreCard.marketMaker.priceMaking} size={72} strokeWidth={6} color={scoreCard.marketMaker.priceMaking >= 60 ? '#5b7fb5' : '#c04040'} label="PRM" onClick={() => setSelectedMetric(selectedMetric === 'PRM' ? null : 'PRM')} />
                <RingChart value={scoreCard.marketMaker.ssrm} size={72} strokeWidth={6} color={scoreCard.marketMaker.ssrm >= 60 ? '#5b7fb5' : '#c04040'} label="SSRM" onClick={() => setSelectedMetric(selectedMetric === 'SSRM' ? null : 'SSRM')} />
              </div>
            </div>
            {(selectedMetric === 'EIC' || selectedMetric === 'ETM' || selectedMetric === 'PnL' || selectedMetric === 'PRM' || selectedMetric === 'SSRM') && (
              <MetricTooltip label={selectedMetric} description={METRIC_DESCRIPTIONS[selectedMetric]} />
            )}
          </div>

          <div style={{ fontSize: '0.7rem', color: '#999', marginTop: 16, textAlign: 'center' }}>
            CLICK ON THE WHEELS ABOVE TO LEARN MORE ABOUT YOUR METRICS
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 20, flexWrap: 'wrap' }}>
          {onSave && (
            <button
              className="btn-restart"
              onClick={handleSave}
              disabled={saving || saved}
              style={{
                background: saved ? '#1a3a2a' : saving ? '#2a3a50' : 'linear-gradient(135deg, #f0b90b, #e0a800)',
                opacity: saving ? 0.7 : 1,
                cursor: saving || saved ? 'default' : 'pointer',
              }}
            >
              {saved ? '✓ 已保存' : saving ? '保存中...' : '💾 保存数据'}
            </button>
          )}
          {onGoToReview && (
            <button
              className="btn-restart"
              onClick={onGoToReview}
              style={{ background: 'linear-gradient(135deg, #5b7fb5, #3a5a8a)' }}
            >
              📊 查看复盘
            </button>
          )}
          <button className="btn-restart" onClick={onRestart}>
            Play Again
          </button>
        </div>
      </div>
    </div>
  );
};

export default GameOverOverlay;
