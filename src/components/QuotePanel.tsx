import React, { useState } from 'react';
import { Quote, Player, Stock } from '../engine/types';

interface Props {
  quotes: Quote[];
  myPlayer: Player;
  stocks: Stock[];
  onSendQuote: (ticker: string, bidPrice: number, offerPrice: number, bidVol: number, offerVol: number, validFor: number) => void;
  onAcceptQuote: (quote: Quote, side: 'BUY' | 'SELL') => void;
}

const QuotePanel: React.FC<Props> = ({ quotes, myPlayer, stocks, onSendQuote, onAcceptQuote }) => {
  const [ticker, setTicker] = useState('');
  const [bidPrice, setBidPrice] = useState('');
  const [offerPrice, setOfferPrice] = useState('');
  const [bidVol, setBidVol] = useState('');
  const [offerVol, setOfferVol] = useState('');
  const [validFor, setValidFor] = useState('45');
  const [activeQuotesTab, setActiveQuotesTab] = useState<'live' | 'old'>('live');

  const handleSendQuote = () => {
    if (!ticker || !bidPrice || !offerPrice || !bidVol || !offerVol) return;
    onSendQuote(
      ticker.toUpperCase(),
      parseFloat(bidPrice),
      parseFloat(offerPrice),
      parseInt(bidVol),
      parseInt(offerVol),
      parseInt(validFor) || 45
    );
    setBidPrice('');
    setOfferPrice('');
    setBidVol('');
    setOfferVol('');
  };

  const liveQuotes = quotes.filter(q => !q.expired);
  const oldQuotes = quotes.filter(q => q.expired);
  const displayQuotes = activeQuotesTab === 'live' ? liveQuotes : oldQuotes;

  return (
    <div className="panel quote-panel">
      <div className="panel-header">
        <h3>Quote & Chat Quotes</h3>
      </div>
      <div className="quote-panel-content">
        <div className="quote-form-area">
          <div className="quote-info">
            <div className="player-badge">
              <strong>{myPlayer.role}-{myPlayer.team}-{myPlayer.role === 'AM' ? 'AM' : 'IB'}</strong>
              <div style={{ fontSize: '0.65rem', color: '#6b7c93', marginTop: 2 }}>HFTRD</div>
            </div>
          </div>
          <div className="quote-form">
            <div className="form-group">
              <label>Ticker</label>
              <input
                placeholder="e.g APPL"
                value={ticker}
                onChange={e => setTicker(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Valid for seconds</label>
              <input
                type="number"
                value={validFor}
                onChange={e => setValidFor(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }} />
            <div className="form-group">
              <label>Bid Price (Client Sell)</label>
              <input
                placeholder="e.g 158"
                value={bidPrice}
                onChange={e => setBidPrice(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Offer Price (Client Buy)</label>
              <input
                placeholder="e.g 162"
                value={offerPrice}
                onChange={e => setOfferPrice(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }} />
            <div className="form-group">
              <label>Bid Volume</label>
              <input
                placeholder="e.g 10000"
                value={bidVol}
                onChange={e => setBidVol(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Offer Volume</label>
              <input
                placeholder="e.g 10000"
                value={offerVol}
                onChange={e => setOfferVol(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }} />
            <button className="btn-quote" onClick={handleSendQuote}>SEND QUOTE</button>
          </div>
        </div>

        <div className="quotes-tabs">
          <button
            className={`quotes-tab-btn ${activeQuotesTab === 'live' ? 'active' : ''}`}
            onClick={() => setActiveQuotesTab('live')}
          >
            LIVE CHAT QUOTES
          </button>
          <button
            className={`quotes-tab-btn ${activeQuotesTab === 'old' ? 'active' : ''}`}
            onClick={() => setActiveQuotesTab('old')}
          >
            OLD CHAT QUOTES
          </button>
        </div>

        <div className="quotes-list">
          <table className="quotes-table">
            <thead>
              <tr>
                <th>HF</th>
                <th>Security ↕</th>
                <th>Bid ↕ Vol</th>
                <th>Bid ↕</th>
                <th>Offer ↕</th>
                <th>Offer ↕ Vol</th>
                <th>Valid ↕ For</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {displayQuotes.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ color: '#3a5068', padding: '15px' }}>
                    No {activeQuotesTab === 'live' ? 'live' : 'old'} quotes
                  </td>
                </tr>
              ) : (
                displayQuotes.slice(0, 50).map(q => (
                  <tr
                    key={q.id}
                    className={`${q.expired ? 'quote-row-expired' : 'quote-row-clickable'}`}
                  >
                    <td className="quote-from">{q.fromRole}-{q.fromTeam}</td>
                    <td>{q.ticker}</td>
                    <td>{q.bidVolume.toLocaleString()}</td>
                    <td>{q.bidPrice.toFixed(2)}</td>
                    <td>{q.offerPrice.toFixed(2)}</td>
                    <td>{q.offerVolume.toLocaleString()}</td>
                    <td>{q.validFor}</td>
                    <td>
                      {!q.expired && (
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                          <button
                            onClick={() => onAcceptQuote(q, 'SELL')}
                            style={{
                              background: '#2a1520', border: '1px solid #f23645', color: '#f23645',
                              padding: '2px 8px', borderRadius: 3, cursor: 'pointer', fontSize: '0.65rem'
                            }}
                          >
                            HIT
                          </button>
                          <button
                            onClick={() => onAcceptQuote(q, 'BUY')}
                            style={{
                              background: '#152a20', border: '1px solid #00d26a', color: '#00d26a',
                              padding: '2px 8px', borderRadius: 3, cursor: 'pointer', fontSize: '0.65rem'
                            }}
                          >
                            LIFT
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default QuotePanel;
