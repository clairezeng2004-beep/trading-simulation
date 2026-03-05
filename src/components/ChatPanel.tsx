import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, Player } from '../engine/types';

interface Props {
  messages: ChatMessage[];
  players: Player[];
  myPlayer: Player;
  onSendMessage: (text: string, to?: Player) => void;
  onSelectPlayer: (player: Player | null) => void;
}

const ChatPanel: React.FC<Props> = ({ messages, players, myPlayer, onSendMessage, onSelectPlayer }) => {
  const [input, setInput] = useState('');
  const [playerSearch, setPlayerSearch] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const filteredPlayers = players.filter(p => !p.isHuman).filter(p =>
    !playerSearch || p.name.toLowerCase().includes(playerSearch.toLowerCase()) ||
    `${p.role}-${p.team}`.toLowerCase().includes(playerSearch.toLowerCase())
  );

  const displayPlayers = playerSearch ? filteredPlayers : filteredPlayers.slice(0, 30);

  // Filter messages: show broadcast messages + DMs involving me and selected player
  const visibleMessages = messages.filter(msg => {
    if (selectedPlayer) {
      // In DM view: show DMs between me and selected player, plus broadcasts
      const isDMBetweenUs =
        (msg.from === selectedPlayer.name && msg.to === myPlayer.name) ||
        (msg.from === myPlayer.name && msg.to === selectedPlayer.name);
      const isBroadcast = !msg.to;
      return isDMBetweenUs || isBroadcast;
    }
    // In "All" view: show everything
    return true;
  });

  const handleSend = () => {
    if (input.trim()) {
      onSendMessage(input.trim(), selectedPlayer || undefined);
      setInput('');
    }
  };

  const handleSelectPlayer = (player: Player) => {
    if (selectedPlayer?.name === player.name) {
      setSelectedPlayer(null);
      onSelectPlayer(null);
    } else {
      setSelectedPlayer(player);
      onSelectPlayer(player);
    }
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  };

  // Count unread DMs per player
  const dmCounts = new Map<string, number>();
  messages.forEach(msg => {
    if (msg.to === myPlayer.name && msg.from !== myPlayer.name) {
      dmCounts.set(msg.from, (dmCounts.get(msg.from) || 0) + 1);
    }
  });

  return (
    <div className="panel chat-panel">
      <div className="panel-header">
        <h3>
          Chat
          {selectedPlayer && (
            <span className="chat-dm-indicator">
              &nbsp;→ {selectedPlayer.name} ({selectedPlayer.role}-{selectedPlayer.team})
              <button className="btn-back-all" onClick={() => { setSelectedPlayer(null); onSelectPlayer(null); }}>✕</button>
            </span>
          )}
        </h3>
      </div>
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
        {displayPlayers.map((p, i) => (
          <div
            className={`player-item ${selectedPlayer?.name === p.name ? 'player-selected' : ''}`}
            key={i}
            onClick={() => handleSelectPlayer(p)}
          >
            <span className="player-name">{p.name}</span>
            <span className="player-role-tag">
              <span className={`role-badge ${p.role === 'IB' ? 'role-ib' : 'role-am'}`}>{p.role}</span>
              <span className="player-team">-{p.team}</span>
            </span>
            {dmCounts.has(p.name) && (
              <span className="dm-count">{dmCounts.get(p.name)}</span>
            )}
          </div>
        ))}
      </div>
      <div className="chat-messages">
        {visibleMessages.slice(-80).map(msg => {
          const isDM = !!msg.to;
          const isFromMe = msg.from === myPlayer.name;
          const isToMe = msg.to === myPlayer.name;
          return (
            <div className={`chat-msg ${isDM ? 'chat-dm' : ''} ${isFromMe ? 'chat-from-me' : ''}`} key={msg.id}>
              <span className="time">[{formatTime(msg.timestamp)}] </span>
              {isDM && <span className="dm-tag">[DM] </span>}
              <span className="sender">
                {isFromMe ? 'You' : msg.from} → {isDM ? (isToMe ? 'You' : msg.to) : 'ALL'}:&nbsp;
              </span>
              <span className="msg-text">{msg.text}</span>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>
      <div className="chat-input-area">
        <div className="chat-target-badge">
          {selectedPlayer ? `To: ${selectedPlayer.name}` : 'To: ALL'}
        </div>
        <input
          type="text"
          placeholder={selectedPlayer ? `Message ${selectedPlayer.name}...` : 'Message everyone...'}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
        />
        <button className="btn-send" onClick={handleSend}>SEND</button>
      </div>
    </div>
  );
};

export default ChatPanel;
