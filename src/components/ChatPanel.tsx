import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, Player } from '../engine/types';

interface Props {
  messages: ChatMessage[];
  players: Player[];
  onSendMessage: (text: string) => void;
}

const ChatPanel: React.FC<Props> = ({ messages, players, onSendMessage }) => {
  const [input, setInput] = useState('');
  const [playerSearch, setPlayerSearch] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const filteredPlayers = playerSearch
    ? players.filter(p => p.name.toLowerCase().includes(playerSearch.toLowerCase()))
    : players.slice(0, 20);

  const handleSend = () => {
    if (input.trim()) {
      onSendMessage(input.trim());
      setInput('');
    }
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  };

  return (
    <div className="panel chat-panel">
      <div className="player-list-header">
        <span style={{ color: '#3a5068', fontSize: '14px' }}>🔍</span>
        <input
          className="player-search"
          type="text"
          placeholder="Search name or team"
          value={playerSearch}
          onChange={e => setPlayerSearch(e.target.value)}
        />
      </div>
      <div className="player-list">
        {filteredPlayers.map((p, i) => (
          <div className="player-item" key={i}>
            <span className="player-name">{p.name}</span>
            <span className="player-team">{p.role}-{p.team}</span>
          </div>
        ))}
      </div>
      <div className="chat-messages">
        {messages.slice(-50).map(msg => (
          <div className="chat-msg" key={msg.id}>
            <span className="time">[{formatTime(msg.timestamp)}] </span>
            <span className="sender">{msg.from} - {msg.fromRole}-{msg.fromTeam}: </span>
            <span className="msg-text">{msg.text}</span>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <div className="chat-input-area">
        <input
          type="text"
          placeholder="Input your message or @quote"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
        />
        <button className="btn-send" onClick={handleSend}>SEND MESSAGE</button>
      </div>
    </div>
  );
};

export default ChatPanel;
