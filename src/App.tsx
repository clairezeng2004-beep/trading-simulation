import React, { useState, useCallback, useRef, useEffect } from 'react';
import './styles/App.css';
import { Role, GameState, Quote, Player } from './engine/types';
import { initGameState, startGame, stopGame, executeTrade, resetEngine, calculateScoreCard, generateAIReply } from './engine/gameEngine';
import { saveSession } from './engine/api';
import { startAmbient, stopAmbient, pauseAmbient, resumeAmbient, playTradeSound, playNewsAlert, playGameOverSound, playTimerWarning } from './engine/audioManager';
import RoleSelection from './components/RoleSelection';
import TopBar from './components/TopBar';
import EquityPanel from './components/EquityPanel';
import NewsPanel from './components/NewsPanel';
import PositionsPanel from './components/PositionsPanel';
import ChatPanel from './components/ChatPanel';
import QuotePanel from './components/QuotePanel';
import ExchangePanel from './components/ExchangePanel';
import GameOverOverlay from './components/GameOverOverlay';
import ReviewPage from './components/ReviewPage';

interface PriceSnapshot {
  timestamp: number;
  ticker: string;
  price: number;
  percentChange: number;
}

interface QuoteTracking {
  id: string;
  timestamp: number;
  ticker: string;
  bidPrice: number;
  offerPrice: number;
  bidVolume: number;
  offerVolume: number;
  spreadPct: number;
  wasAccepted: boolean;
}

const App: React.FC = () => {
  const [gamePhase, setGamePhase] = useState<'selection' | 'playing' | 'ended' | 'review'>('selection');
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [selectedTicker, setSelectedTicker] = useState('NFLX');
  const [toast, setToast] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedChatPlayer, setSelectedChatPlayer] = useState<Player | null>(null);
  const gameRef = useRef<GameState | null>(null);
  const priceHistoryRef = useRef<PriceSnapshot[]>([]);
  const quotesTrackingRef = useRef<QuoteTracking[]>([]);
  const timerWarningFiredRef = useRef(false);

  // Play warning sound when 60 seconds remain
  useEffect(() => {
    if (gameState && gamePhase === 'playing' && gameState.timeRemaining === 60 && !timerWarningFiredRef.current) {
      playTimerWarning();
      timerWarningFiredRef.current = true;
    }
    if (gameState && gameState.timeRemaining > 60) {
      timerWarningFiredRef.current = false;
    }
  }, [gameState?.timeRemaining, gamePhase]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const syncState = () => {
    if (!gameRef.current) return;
    setGameState({
      ...gameRef.current,
      stocks: [...gameRef.current.stocks],
      myPositions: new Map(gameRef.current.myPositions),
      myTrades: [...gameRef.current.myTrades],
      quotes: [...gameRef.current.quotes],
      chatMessages: [...gameRef.current.chatMessages],
      newsItems: [...gameRef.current.newsItems],
      scoringData: { ...gameRef.current.scoringData },
    });
  };

  // Capture price snapshots periodically
  const startPriceTracking = (state: GameState) => {
    priceHistoryRef.current = [];
    const interval = setInterval(() => {
      if (!gameRef.current || !gameRef.current.running) {
        clearInterval(interval);
        return;
      }
      const now = Date.now();
      gameRef.current.stocks.forEach(s => {
        priceHistoryRef.current.push({
          timestamp: now,
          ticker: s.ticker,
          price: s.currentPrice,
          percentChange: s.percentChange,
        });
      });
    }, 15000); // every 15 seconds
    return interval;
  };

  const handleSelectRole = useCallback((role: Role, name: string) => {
    resetEngine();
    const state = initGameState(role, name);
    gameRef.current = state;
    quotesTrackingRef.current = [];
    priceHistoryRef.current = [];

    const priceInterval = startPriceTracking(state);

    startGame(state, () => {
      syncState();
      if (gameRef.current && gameRef.current.timeRemaining <= 0) {
        clearInterval(priceInterval);
        stopAmbient();
        playGameOverSound();
        setGamePhase('ended');
      }
    });

    startAmbient();
    setGameState(state);
    setGamePhase('playing');
  }, []);

  const handlePause = useCallback(() => {
    if (!gameRef.current) return;
    if (gameRef.current.running) {
      stopGame(gameRef.current);
      gameRef.current.running = false;
      pauseAmbient();
    } else {
      startGame(gameRef.current, () => {
        syncState();
        if (gameRef.current && gameRef.current.timeRemaining <= 0) {
          stopAmbient();
          playGameOverSound();
          setGamePhase('ended');
        }
      });
      resumeAmbient();
    }
    setGameState({ ...gameRef.current });
  }, []);

  const handleStop = useCallback(() => {
    if (!gameRef.current) return;
    stopGame(gameRef.current);
    stopAmbient();
    playGameOverSound();
    setGamePhase('ended');
    setGameState({ ...gameRef.current });
  }, []);

  const handleExchangeTrade = useCallback((ticker: string, side: 'BUY' | 'SELL', price: number, volume: number) => {
    if (!gameRef.current || !gameRef.current.running) return;
    const { trade, commission } = executeTrade(gameRef.current, ticker, side, price, volume, 'Exchange', 'exchange');
    gameRef.current.myTrades.push(trade);
    gameRef.current.commission += commission;
    showToast(`Trade has been performed: ${side} ${volume} ${ticker} @ ${price.toFixed(2)}`);
    playTradeSound();
    syncState();
  }, []);

  const handleSendQuote = useCallback((ticker: string, bidPrice: number, offerPrice: number, bidVol: number, offerVol: number, validFor: number, targetPlayer?: Player) => {
    if (!gameRef.current || !gameRef.current.running) return;
    const myPlayer = gameRef.current.myPlayer;

    // Rule: IB can only quote to AM, IB cannot quote to IB
    if (myPlayer.role === 'IB' && targetPlayer && targetPlayer.role === 'IB') {
      showToast('IB cannot send quotes to other IBs. Quotes can only be sent to AMs.');
      return;
    }
    const quoteId = `Q-MY-${Date.now()}`;
    const quote: Quote = {
      id: quoteId,
      from: myPlayer.name,
      fromRole: myPlayer.role,
      fromTeam: myPlayer.team,
      ticker,
      bidPrice,
      offerPrice,
      bidVolume: bidVol,
      offerVolume: offerVol,
      validFor,
      timestamp: Date.now(),
      expired: false,
    };
    gameRef.current.quotes = [quote, ...gameRef.current.quotes];

    // Track quote spread for PRM scoring
    const stock = gameRef.current.stocks.find(s => s.ticker === ticker);
    let spreadPct = 0;
    if (stock && stock.currentPrice > 0) {
      spreadPct = (offerPrice - bidPrice) / stock.currentPrice;
      gameRef.current.scoringData.quoteSpreads.push(spreadPct);
    }
    gameRef.current.scoringData.totalQuotesSent++;

    // Track for database
    const quoteTracking: QuoteTracking = {
      id: quoteId,
      timestamp: Date.now(),
      ticker,
      bidPrice,
      offerPrice,
      bidVolume: bidVol,
      offerVolume: offerVol,
      spreadPct,
      wasAccepted: false,
    };
    quotesTrackingRef.current.push(quoteTracking);

    gameRef.current.chatMessages.push({
      id: `C-MY-${Date.now()}`,
      from: myPlayer.name,
      fromRole: myPlayer.role,
      fromTeam: myPlayer.team,
      text: `You: Quote created. ${ticker}, bid:${bidPrice}, offer:${offerPrice}, bidvol:${bidVol}, offervol:${offerVol}`,
      timestamp: Date.now(),
      isQuote: true,
    });

    showToast(`Quote sent: ${ticker} ${bidPrice}/${offerPrice}`);
    syncState();

    // Simulate AI accepting quote
    setTimeout(() => {
      if (!gameRef.current || !gameRef.current.running) return;
      if (Math.random() < 0.4) {
        const side: 'BUY' | 'SELL' = Math.random() < 0.5 ? 'BUY' : 'SELL';
        const price = side === 'BUY' ? offerPrice : bidPrice;
        const vol = side === 'BUY' ? offerVol : bidVol;
        const { trade, commission } = executeTrade(
          gameRef.current, ticker,
          side === 'BUY' ? 'SELL' : 'BUY',
          price, vol, 'AI Client', 'quote'
        );
        gameRef.current.myTrades.push(trade);
        gameRef.current.commission += commission;
        gameRef.current.scoringData.matchedClientRequests++;
        // Mark quote as accepted in tracking
        const qt = quotesTrackingRef.current.find(q => q.id === quoteId);
        if (qt) qt.wasAccepted = true;
        showToast(`Quote accepted by AI client: ${side === 'BUY' ? 'SELL' : 'BUY'} ${vol} ${ticker} @ ${price}`);
        playTradeSound();
        syncState();
      }
    }, Math.random() * 10000 + 3000);
  }, []);

  const handleAcceptQuote = useCallback((quote: Quote, side: 'BUY' | 'SELL') => {
    if (!gameRef.current || !gameRef.current.running || quote.expired) return;
    const price = side === 'BUY' ? quote.offerPrice : quote.bidPrice;
    const volume = side === 'BUY' ? quote.offerVolume : quote.bidVolume;
    const { trade, commission } = executeTrade(gameRef.current, quote.ticker, side, price, volume, quote.from, 'chat');
    gameRef.current.myTrades.push(trade);
    gameRef.current.commission += commission;
    gameRef.current.scoringData.matchedClientRequests++;
    quote.expired = true;
    showToast(`Trade has been performed: ${side} ${volume} ${quote.ticker} @ ${price.toFixed(2)}`);
    playTradeSound();
    syncState();
  }, []);

  const handleSendChat = useCallback((text: string, toPlayer?: Player) => {
    if (!gameRef.current) return;
    const myPlayer = gameRef.current.myPlayer;
    const msg = {
      id: `C-MY-${Date.now()}`,
      from: myPlayer.name,
      fromRole: myPlayer.role,
      fromTeam: myPlayer.team,
      to: toPlayer?.name,
      toRole: toPlayer?.role,
      toTeam: toPlayer?.team,
      text,
      timestamp: Date.now(),
      isQuote: false,
    };
    gameRef.current.chatMessages.push(msg);
    syncState();

    // AI auto-reply after 1-4 seconds
    if (gameRef.current.running) {
      setTimeout(() => {
        if (!gameRef.current || !gameRef.current.running) return;
        const reply = generateAIReply(gameRef.current, msg);
        if (reply) {
          gameRef.current.chatMessages.push(reply);
          syncState();
        }
      }, 1000 + Math.random() * 3000);
    }
  }, []);

  const handleSaveAndReview = useCallback(async (scoreCard: ReturnType<typeof calculateScoreCard>) => {
    if (!gameRef.current) return;
    setSaving(true);
    try {
      const result = await saveSession(
        gameRef.current,
        scoreCard,
        priceHistoryRef.current,
        quotesTrackingRef.current,
      );
      if (result.success) {
        showToast('游戏数据已保存');
      } else {
        showToast('保存失败，请确保后端服务运行中');
      }
    } catch {
      showToast('保存失败，请确保后端服务运行中');
    }
    setSaving(false);
  }, []);

  const handleRestart = useCallback(() => {
    if (gameRef.current) {
      stopGame(gameRef.current);
    }
    stopAmbient();
    gameRef.current = null;
    setGameState(null);
    setGamePhase('selection');
  }, []);

  const handleGoToReview = useCallback(() => {
    setGamePhase('review');
  }, []);

  if (gamePhase === 'review') {
    return <ReviewPage onBack={() => setGamePhase('selection')} />;
  }

  if (gamePhase === 'selection' || !gameState) {
    return (
      <RoleSelection
        onSelectRole={handleSelectRole}
        onGoToReview={handleGoToReview}
      />
    );
  }

  const scoreCard = gamePhase === 'ended' ? calculateScoreCard(gameState) : null;

  return (
    <div className="trading-app">
      <TopBar state={gameState} onPause={handlePause} onStop={handleStop} />

      {toast && <div className="toast-notification">{toast}</div>}

      <div className="main-content">
        <EquityPanel stocks={gameState.stocks} onSelectStock={setSelectedTicker} />
        <NewsPanel newsItems={gameState.newsItems} />
        <PositionsPanel positions={gameState.myPositions} trades={gameState.myTrades} />
        <ChatPanel
          messages={gameState.chatMessages}
          players={gameState.players}
          myPlayer={gameState.myPlayer}
          onSendMessage={handleSendChat}
          onSelectPlayer={setSelectedChatPlayer}
        />
        <QuotePanel
          quotes={gameState.quotes}
          myPlayer={gameState.myPlayer}
          stocks={gameState.stocks}
          selectedChatPlayer={selectedChatPlayer}
          onSendQuote={handleSendQuote}
          onAcceptQuote={handleAcceptQuote}
        />
        <ExchangePanel
          stocks={gameState.stocks}
          selectedTicker={selectedTicker}
          onTrade={handleExchangeTrade}
        />
      </div>

      {gamePhase === 'ended' && scoreCard && (
        <GameOverOverlay
          state={gameState}
          scoreCard={scoreCard}
          onRestart={handleRestart}
          onSave={() => handleSaveAndReview(scoreCard)}
          onGoToReview={handleGoToReview}
          saving={saving}
        />
      )}
    </div>
  );
};

export default App;
