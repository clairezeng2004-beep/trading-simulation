import React, { useState } from 'react';
import { Position, Trade } from '../engine/types';

interface Props {
  positions: Map<string, Position>;
  trades: Trade[];
}

const PositionsPanel: React.FC<Props> = ({ positions, trades }) => {
  const [activeTab, setActiveTab] = useState<'positions' | 'blotter'>('positions');

  const posArray = Array.from(positions.values());

  const formatNum = (n: number) => {
    if (n === 0) return '0';
    return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  };

  const formatPrice = (n: number) => {
    if (n === 0) return '0';
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const pnlClass = (n: number) => n > 0 ? 'pnl-positive' : n < 0 ? 'pnl-negative' : 'pnl-neutral';

  return (
    <div className="panel positions-panel">
      <div className="tab-header">
        <button
          className={`tab-btn ${activeTab === 'positions' ? 'active' : ''}`}
          onClick={() => setActiveTab('positions')}
        >
          POSITIONS
        </button>
        <button
          className={`tab-btn ${activeTab === 'blotter' ? 'active' : ''}`}
          onClick={() => setActiveTab('blotter')}
        >
          TRADE BLOTTER
          {trades.length > 0 && <span className="trade-count">{trades.length} New Trades</span>}
        </button>
      </div>
      <div className="panel-body">
        {activeTab === 'positions' ? (
          <table className="positions-table">
            <thead>
              <tr>
                <th>Security</th>
                <th>Net ↕ Qty</th>
                <th>Avg. ↕ Price</th>
                <th>Pos. ↕ Value(s)</th>
                <th>Unrealised ↕ P/L</th>
                <th>Realised ↕ P/L</th>
                <th>Net ↕ P/L</th>
              </tr>
            </thead>
            <tbody>
              {posArray.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', color: '#3a5068', padding: '20px' }}>
                    No positions yet
                  </td>
                </tr>
              ) : (
                posArray.map(pos => (
                  <tr key={pos.ticker}>
                    <td>{pos.ticker}</td>
                    <td className={pos.netQty > 0 ? 'pnl-positive' : pos.netQty < 0 ? 'pnl-negative' : ''}>
                      {formatNum(pos.netQty)}
                    </td>
                    <td>{pos.avgPrice > 0 ? formatPrice(pos.avgPrice) : '0'}</td>
                    <td>{formatNum(Math.round(pos.posValue))}</td>
                    <td className={pnlClass(pos.unrealisedPnl)}>
                      {pos.unrealisedPnl >= 0 ? '' : '-'}${formatNum(Math.abs(Math.round(pos.unrealisedPnl)))}
                    </td>
                    <td className={pnlClass(pos.realisedPnl)}>
                      {pos.realisedPnl >= 0 ? '' : '-'}${formatNum(Math.abs(Math.round(pos.realisedPnl)))}
                    </td>
                    <td className={pnlClass(pos.netPnl)}>
                      {pos.netPnl >= 0 ? '' : '-'}${formatNum(Math.abs(Math.round(pos.netPnl)))}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        ) : (
          <table className="blotter-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Ticker</th>
                <th>Side</th>
                <th>Price</th>
                <th>Volume</th>
                <th>Counterparty</th>
              </tr>
            </thead>
            <tbody>
              {trades.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', color: '#3a5068', padding: '20px' }}>
                    No trades yet
                  </td>
                </tr>
              ) : (
                [...trades].reverse().map(trade => (
                  <tr key={trade.id}>
                    <td style={{ textAlign: 'left' }}>{new Date(trade.timestamp).toLocaleTimeString()}</td>
                    <td>{trade.ticker}</td>
                    <td className={trade.side === 'BUY' ? 'pnl-positive' : 'pnl-negative'}>
                      {trade.side}
                    </td>
                    <td>{formatPrice(trade.price)}</td>
                    <td>{formatNum(trade.volume)}</td>
                    <td>{trade.counterparty}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default PositionsPanel;
