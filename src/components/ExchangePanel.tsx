import React, { useState, useEffect } from 'react';
import { Stock } from '../engine/types';

interface Props {
  stocks: Stock[];
  selectedTicker: string;
  onTrade: (ticker: string, side: 'BUY' | 'SELL', price: number, volume: number) => void;
}

const ExchangePanel: React.FC<Props> = ({ stocks, selectedTicker, onTrade }) => {
  const [ticker, setTicker] = useState(selectedTicker || 'NFLX');
  const [volume, setVolume] = useState('1000');
  const [secSearch, setSecSearch] = useState('');

  useEffect(() => {
    if (selectedTicker) {
      setTicker(selectedTicker);
    }
  }, [selectedTicker]);

  const stock = stocks.find(s => s.ticker === ticker);
  const spread = stock ? stock.currentPrice * 0.005 : 0;
  const sellPrice = stock ? Math.round((stock.currentPrice - spread) * 100) / 100 : 0;
  const buyPrice = stock ? Math.round((stock.currentPrice + spread) * 100) / 100 : 0;
  const vol = parseInt(volume) || 0;
  const notionalValue = stock ? buyPrice * vol : 0;
  const commission = notionalValue * 0.005;

  const handleTrade = (side: 'BUY' | 'SELL') => {
    if (!stock || vol <= 0) return;
    const price = side === 'BUY' ? buyPrice : sellPrice;
    onTrade(ticker, side, price, vol);
  };

  return (
    <div className="panel exchange-panel">
      <div className="panel-header">
        <h3>Exchange</h3>
      </div>
      <div className="exchange-content">
        <div className="exchange-ticker-select">
          <select value={ticker} onChange={e => setTicker(e.target.value)}>
            {stocks.map(s => (
              <option key={s.ticker} value={s.ticker}>{s.ticker}</option>
            ))}
          </select>
        </div>

        <div className="exchange-volume-row">
          <input
            type="number"
            value={volume}
            onChange={e => setVolume(e.target.value)}
            placeholder="Volume"
          />
          <button
            style={{
              background: '#1a2332', border: '1px solid #2a3a50', color: '#c8d6e5',
              padding: '6px 10px', borderRadius: 4, cursor: 'pointer', fontSize: '0.75rem'
            }}
            onClick={() => setVolume(v => String((parseInt(v) || 0) + 1000))}
          >
            +
          </button>
        </div>

        <div className="exchange-price-row">
          <div className="exchange-price-box">
            <label>SELL</label>
            <button className="btn-sell" onClick={() => handleTrade('SELL')}>
              {sellPrice.toFixed(2)}
            </button>
          </div>
          <div className="exchange-price-box">
            <label>BUY</label>
            <button className="btn-buy" onClick={() => handleTrade('BUY')}>
              {buyPrice.toFixed(2)}
            </button>
          </div>
        </div>

        <div className="exchange-info">
          <div className="exchange-info-row">
            <span className="label">Notional Value</span>
            <span className="value">${notionalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          <div className="exchange-info-row">
            <span className="label">Commission</span>
            <span className="value">${commission.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>

      <div className="securities-search">
        <label>Securities</label>
        <span style={{ color: '#3a5068' }}>🔍</span>
        <input
          type="text"
          placeholder="Search securities..."
          value={secSearch}
          onChange={e => setSecSearch(e.target.value)}
        />
      </div>
    </div>
  );
};

export default ExchangePanel;
