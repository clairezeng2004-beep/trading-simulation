import React, { useState, useRef, useEffect } from 'react';
import { NewsItem } from '../engine/types';
import { playNewsAlert } from '../engine/audioManager';

interface Props {
  newsItems: NewsItem[];
}

const NewsPanel: React.FC<Props> = ({ newsItems }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const prevCountRef = useRef(newsItems.length);

  useEffect(() => {
    if (newsItems.length > prevCountRef.current) {
      playNewsAlert();
    }
    prevCountRef.current = newsItems.length;
  }, [newsItems.length]);

  const filtered = searchTerm
    ? newsItems.filter(n =>
        n.ticker.toLowerCase().includes(searchTerm.toLowerCase()) ||
        n.headline.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : newsItems;

  return (
    <div className="panel news-panel">
      <div className="panel-header">
        <h3>News Feed</h3>
      </div>
      <div className="search-bar">
        <span className="search-icon">🔍</span>
        <input
          type="text"
          placeholder="Search keywords"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
      </div>
      <div className="panel-body">
        <div className="news-list">
          {filtered.map(item => (
            <div className="news-item" key={item.id}>
              <span className={`news-ticker ${item.ticker === 'MACRO' ? 'macro' : item.ticker === 'NOTE' ? 'note' : ''}`}>
                {item.ticker}
              </span>
              <span className="news-headline">{item.headline}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default NewsPanel;
