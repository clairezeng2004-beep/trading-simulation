import React from 'react';
import { Stock } from '../engine/types';

interface Props {
  stocks: Stock[];
  onSelectStock: (ticker: string) => void;
}

const EquityPanel: React.FC<Props> = ({ stocks, onSelectStock }) => {
  return (
    <div className="panel equity-panel">
      <div className="panel-header">
        <h3>1. Equity</h3>
        <span className="info-icon" title="Equity securities available for trading">ⓘ</span>
      </div>
      <div className="panel-body">
        <table className="stock-table">
          <thead>
            <tr>
              <th>Ticker ↕</th>
              <th>RefPrice ↕</th>
              <th>% Chg ↕</th>
              <th>Type ↕</th>
            </tr>
          </thead>
          <tbody>
            {stocks.map(stock => (
              <tr key={stock.ticker} onClick={() => onSelectStock(stock.ticker)} style={{ cursor: 'pointer' }}>
                <td className="ticker">{stock.ticker}</td>
                <td className="price">$ {stock.currentPrice.toFixed(2)} ↕</td>
                <td className={stock.percentChange >= 0 ? 'change-positive' : 'change-negative'}>
                  {stock.percentChange >= 0 ? '+' : ''}{stock.percentChange.toFixed(2)} %
                </td>
                <td style={{ color: '#6b7c93' }}>{stock.type}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default EquityPanel;
