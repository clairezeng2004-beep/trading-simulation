import {
  Role, Stock, Position, Trade, Quote, ChatMessage, NewsItem,
  Player, GameState, ScoreCard, ScoringData,
  SalesTraderMetrics, MarketMakerMetrics
} from './types';
import { INITIAL_STOCKS, NEWS_TEMPLATES, PLAYER_NAMES } from './stockData';

const COMMISSION_RATE = 0.005;
const GAME_DURATION = 30 * 60;
const FAT_FINGER_THRESHOLD = 0.05; // 5% deviation
const LARGE_TRADE_THRESHOLD = 5000; // volume threshold for "large"

let gameTickInterval: ReturnType<typeof setInterval> | null = null;
let newsInterval: ReturnType<typeof setInterval> | null = null;
let aiInterval: ReturnType<typeof setInterval> | null = null;
let priceInterval: ReturnType<typeof setInterval> | null = null;
let snapshotInterval: ReturnType<typeof setInterval> | null = null;

let nextQuoteId = 1;
let nextTradeId = 1;
let nextNewsId = 1;
let nextChatId = 1;
let newsIndex = 0;

export function createPlayers(myRole: Role, myName: string): Player[] {
  const players: Player[] = [];
  const names = [...PLAYER_NAMES];

  const myTeam = myRole === 'IB' ? 36 : 22;
  players.push({ name: myName, role: myRole, team: myTeam, isHuman: true });

  let ibCount = myRole === 'IB' ? 1 : 0;
  let amCount = myRole === 'AM' ? 1 : 0;
  let nameIdx = 0;

  while (ibCount < 50 || amCount < 50) {
    if (nameIdx >= names.length) break;
    const name = names[nameIdx++];
    if (name === myName) continue;

    if (ibCount < 50 && amCount < 50) {
      const role: Role = Math.random() < 0.5 ? 'IB' : 'AM';
      if (role === 'IB' && ibCount < 50) {
        players.push({ name, role: 'IB', team: ibCount + 1, isHuman: false });
        ibCount++;
      } else if (amCount < 50) {
        players.push({ name, role: 'AM', team: amCount + 1, isHuman: false });
        amCount++;
      } else {
        players.push({ name, role: 'IB', team: ibCount + 1, isHuman: false });
        ibCount++;
      }
    } else if (ibCount < 50) {
      players.push({ name, role: 'IB', team: ibCount + 1, isHuman: false });
      ibCount++;
    } else {
      players.push({ name, role: 'AM', team: amCount + 1, isHuman: false });
      amCount++;
    }
  }

  let extraIdx = 1;
  while (ibCount < 50) {
    players.push({ name: `IB-Bot-${extraIdx}`, role: 'IB', team: ibCount + 1, isHuman: false });
    ibCount++; extraIdx++;
  }
  extraIdx = 1;
  while (amCount < 50) {
    players.push({ name: `AM-Bot-${extraIdx}`, role: 'AM', team: amCount + 1, isHuman: false });
    amCount++; extraIdx++;
  }

  return players;
}

function createScoringData(): ScoringData {
  return {
    totalClientRequests: 0,
    matchedClientRequests: 0,
    totalQuotesSent: 0,
    quoteSpreads: [],
    exchangeTrades: [],
    chatTrades: [],
    fatFingerTrades: 0,
    totalTrades: 0,
    positionSnapshots: [],
    largeExchangeTrades: 0,
    exchangeTradeChunks: [],
  };
}

export function initGameState(myRole: Role, myName: string): GameState {
  const players = createPlayers(myRole, myName);
  const myPlayer = players.find(p => p.isHuman)!;

  return {
    running: false,
    timeRemaining: GAME_DURATION,
    totalDuration: GAME_DURATION,
    stocks: INITIAL_STOCKS.map(s => ({ ...s })),
    players,
    myPlayer,
    myPositions: new Map(),
    myTrades: [],
    quotes: [],
    chatMessages: [],
    newsItems: [],
    realisedPnl: 0,
    unrealisedPnl: 0,
    netExposure: 0,
    commission: 0,
    totalPnl: 0,
    scoringData: createScoringData(),
  };
}

function updateStockPrices(stocks: Stock[]): Stock[] {
  return stocks.map(stock => {
    const change = (Math.random() - 0.48) * stock.volatility * stock.currentPrice;
    const newPrice = Math.max(stock.currentPrice + change, stock.refPrice * 0.5);
    const roundedPrice = Math.round(newPrice * 100) / 100;
    return {
      ...stock,
      prevPrice: stock.currentPrice,
      currentPrice: roundedPrice,
      percentChange: ((roundedPrice - stock.refPrice) / stock.refPrice) * 100,
    };
  });
}

function applyNewsImpact(stocks: Stock[], news: NewsItem): Stock[] {
  if (news.ticker === 'NOTE') return stocks;

  if (news.ticker === 'MACRO') {
    return stocks.map(stock => {
      const impact = news.impact * stock.volatility * stock.currentPrice * 2;
      const newPrice = Math.max(stock.currentPrice + impact, stock.refPrice * 0.5);
      const roundedPrice = Math.round(newPrice * 100) / 100;
      return {
        ...stock,
        prevPrice: stock.currentPrice,
        currentPrice: roundedPrice,
        percentChange: ((roundedPrice - stock.refPrice) / stock.refPrice) * 100,
      };
    });
  }

  return stocks.map(stock => {
    if (stock.ticker === news.ticker) {
      const impact = news.impact * stock.volatility * stock.currentPrice * 5;
      const newPrice = Math.max(stock.currentPrice + impact, stock.refPrice * 0.5);
      const roundedPrice = Math.round(newPrice * 100) / 100;
      return {
        ...stock,
        prevPrice: stock.currentPrice,
        currentPrice: roundedPrice,
        percentChange: ((roundedPrice - stock.refPrice) / stock.refPrice) * 100,
      };
    }
    return stock;
  });
}

export function calculatePositionMetrics(
  positions: Map<string, Position>,
  stocks: Stock[]
): { realisedPnl: number; unrealisedPnl: number; netExposure: number } {
  let realisedPnl = 0;
  let unrealisedPnl = 0;
  let netExposure = 0;

  positions.forEach((pos, ticker) => {
    const stock = stocks.find(s => s.ticker === ticker);
    if (stock) {
      const markToMarket = pos.netQty * stock.currentPrice;
      const costBasis = pos.netQty * pos.avgPrice;
      pos.unrealisedPnl = markToMarket - costBasis;
      pos.posValue = Math.abs(markToMarket);
      unrealisedPnl += pos.unrealisedPnl;
      netExposure += markToMarket;
    }
    realisedPnl += pos.realisedPnl;
    pos.netPnl = pos.realisedPnl + pos.unrealisedPnl;
  });

  return { realisedPnl, unrealisedPnl, netExposure };
}

export function executeTrade(
  state: GameState,
  ticker: string,
  side: 'BUY' | 'SELL',
  price: number,
  volume: number,
  counterparty: string,
  source: 'exchange' | 'quote' | 'chat'
): { trade: Trade; commission: number } {
  const trade: Trade = {
    id: `T-${nextTradeId++}`,
    timestamp: Date.now(),
    ticker,
    side,
    price,
    volume,
    counterparty,
    myRole: state.myPlayer.role,
    source,
  };

  const commission = Math.round(price * volume * COMMISSION_RATE * 100) / 100;

  // Update position
  let pos = state.myPositions.get(ticker);
  if (!pos) {
    pos = { ticker, netQty: 0, avgPrice: 0, posValue: 0, unrealisedPnl: 0, realisedPnl: 0, netPnl: 0 };
    state.myPositions.set(ticker, pos);
  }

  const qty = side === 'BUY' ? volume : -volume;

  if ((pos.netQty >= 0 && qty > 0) || (pos.netQty <= 0 && qty < 0)) {
    const totalCost = pos.avgPrice * Math.abs(pos.netQty) + price * Math.abs(qty);
    pos.netQty += qty;
    pos.avgPrice = pos.netQty !== 0 ? totalCost / Math.abs(pos.netQty) : 0;
  } else {
    const closingQty = Math.min(Math.abs(pos.netQty), Math.abs(qty));
    const pnl = closingQty * (side === 'SELL' ? (price - pos.avgPrice) : (pos.avgPrice - price));
    pos.realisedPnl += pnl;

    pos.netQty += qty;
    if (Math.abs(qty) > closingQty) {
      pos.avgPrice = price;
    }
    if (pos.netQty === 0) {
      pos.avgPrice = 0;
    }
  }

  // Update scoring data
  state.scoringData.totalTrades++;
  const stock = state.stocks.find(s => s.ticker === ticker);
  if (stock) {
    const deviation = Math.abs(price - stock.currentPrice) / stock.currentPrice;
    if (deviation > FAT_FINGER_THRESHOLD) {
      state.scoringData.fatFingerTrades++;
    }
  }

  if (source === 'exchange') {
    state.scoringData.exchangeTrades.push(trade);
    state.scoringData.exchangeTradeChunks.push(volume);
    if (volume > LARGE_TRADE_THRESHOLD) {
      state.scoringData.largeExchangeTrades++;
    }
  } else {
    state.scoringData.chatTrades.push(trade);
  }

  return { trade, commission };
}

export function calculateScoreCard(state: GameState): ScoreCard {
  const sd = state.scoringData;

  // === SALES TRADER METRICS ===

  // CM: Client Matching — % of client requests you responded to
  const cmRaw = sd.totalClientRequests > 0
    ? (sd.matchedClientRequests / sd.totalClientRequests)
    : 0;
  const clientMatching = Math.min(Math.round(cmRaw * 100), 100);

  // COMM: Commission — normalized against what a good IB would earn
  // Target: commission = total_trades * avg_price * avg_volume * 0.005
  // We score relative to a benchmark
  const commBenchmark = state.totalDuration / 60 * 500; // ~500 per minute benchmark
  const commRaw = state.commission / Math.max(commBenchmark, 1);
  const commScore = Math.min(Math.round(commRaw * 100), 100);

  // CT: Chat Trades — % of trades done via quotes/chat vs exchange
  const totalTrades = sd.exchangeTrades.length + sd.chatTrades.length;
  const ctRaw = totalTrades > 0 ? sd.chatTrades.length / totalTrades : 0;
  const chatTrades = Math.min(Math.round(ctRaw * 100), 100);

  // FFC: Fat Finger Count — inverse of fat finger rate (higher = better)
  const ffcRaw = sd.totalTrades > 0
    ? 1 - (sd.fatFingerTrades / sd.totalTrades)
    : 1;
  const fatFingerCount = Math.min(Math.round(ffcRaw * 100), 100);

  const salesTrader: SalesTraderMetrics = {
    clientMatching,
    commission: commScore,
    chatTrades,
    fatFingerCount,
  };

  // === MARKET MAKER METRICS ===

  // EIC: Exchange Impact Count — lower is better (inverse of large trade %)
  const eicRaw = sd.exchangeTrades.length > 0
    ? 1 - (sd.largeExchangeTrades / sd.exchangeTrades.length)
    : 1;
  const exchangeImpactCount = Math.min(Math.round(eicRaw * 100), 100);

  // ETM: Exchange Trade Metric — how well you broke up trades into small chunks
  // Measures if average exchange trade size is small (good) vs large (bad)
  let etmScore = 70; // default
  if (sd.exchangeTradeChunks.length > 0) {
    const avgChunk = sd.exchangeTradeChunks.reduce((a, b) => a + b, 0) / sd.exchangeTradeChunks.length;
    // Ideal chunk: ~1000, bad: >5000
    const etmRaw = Math.max(0, 1 - (avgChunk - 1000) / 5000);
    etmScore = Math.min(Math.round(etmRaw * 100), 100);
  }

  // PnL: For IB, profit is risk — PnL should not exceed commission
  let pnlScore = 50;
  if (state.commission > 0) {
    const pnlRatio = Math.abs(state.totalPnl) / state.commission;
    // Best: PnL close to 0 relative to commission
    // PnL < commission is good, PnL > commission is bad
    if (state.totalPnl >= 0 && state.totalPnl <= state.commission) {
      pnlScore = Math.round((1 - pnlRatio) * 50 + 50); // 50-100
    } else if (state.totalPnl < 0) {
      pnlScore = Math.max(0, Math.round(50 - pnlRatio * 30));
    } else {
      // PnL > commission — risky
      pnlScore = Math.max(0, Math.round(50 - (pnlRatio - 1) * 40));
    }
  }
  pnlScore = Math.max(0, Math.min(100, pnlScore));

  // PRM: Price Making — competitiveness of bid-offer spreads
  let prmScore = 50;
  if (sd.quoteSpreads.length > 0) {
    const avgSpread = sd.quoteSpreads.reduce((a, b) => a + b, 0) / sd.quoteSpreads.length;
    // Tight spread (~0.5%) = 100, wide spread (~3%) = 0
    const prmRaw = Math.max(0, 1 - (avgSpread - 0.005) / 0.025);
    prmScore = Math.min(Math.round(prmRaw * 100), 100);
  }

  // SSRM: Sell Side Risk Management — how well you unwound positions over time
  // Measures if net exposure decreased over time
  let ssrmScore = 50;
  const snapshots = sd.positionSnapshots;
  if (snapshots.length >= 2) {
    let decreasingCount = 0;
    for (let i = 1; i < snapshots.length; i++) {
      if (Math.abs(snapshots[i].netExposure) <= Math.abs(snapshots[i - 1].netExposure) + 1000) {
        decreasingCount++;
      }
    }
    const ssrmRaw = decreasingCount / (snapshots.length - 1);
    ssrmScore = Math.min(Math.round(ssrmRaw * 100), 100);
  }

  const marketMaker: MarketMakerMetrics = {
    exchangeImpactCount,
    exchangeTradeMetric: etmScore,
    pnl: pnlScore,
    priceMaking: prmScore,
    ssrm: ssrmScore,
  };

  // Overall scores
  const salesTraderOverall = Math.round(
    (clientMatching * 0.25 + commScore * 0.3 + chatTrades * 0.25 + fatFingerCount * 0.2)
  );

  const marketMakerOverall = Math.round(
    (exchangeImpactCount * 0.15 + etmScore * 0.2 + pnlScore * 0.2 + prmScore * 0.2 + ssrmScore * 0.25)
  );

  return {
    salesTrader,
    marketMaker,
    salesTraderOverall,
    marketMakerOverall,
  };
}

export function generateAIQuote(state: GameState): Quote | null {
  const ibPlayers = state.players.filter(p => !p.isHuman && p.role === 'IB');
  if (ibPlayers.length === 0) return null;

  const player = ibPlayers[Math.floor(Math.random() * ibPlayers.length)];
  const stock = state.stocks[Math.floor(Math.random() * state.stocks.length)];

  const spread = stock.currentPrice * (0.005 + Math.random() * 0.015);
  const bidPrice = Math.round((stock.currentPrice - spread / 2) * 100) / 100;
  const offerPrice = Math.round((stock.currentPrice + spread / 2) * 100) / 100;
  const volume = Math.round((Math.random() * 20 + 1)) * 1000;

  return {
    id: `Q-${nextQuoteId++}`,
    from: player.name,
    fromRole: player.role,
    fromTeam: player.team,
    ticker: stock.ticker,
    bidPrice,
    offerPrice,
    bidVolume: volume,
    offerVolume: volume,
    validFor: Math.floor(Math.random() * 30 + 15),
    timestamp: Date.now(),
    expired: false,
  };
}

export function generateAIChatMessage(state: GameState): ChatMessage | null {
  const aiPlayers = state.players.filter(p => !p.isHuman);
  if (aiPlayers.length === 0) return null;

  const player = aiPlayers[Math.floor(Math.random() * aiPlayers.length)];
  const stock = state.stocks[Math.floor(Math.random() * state.stocks.length)];

  const messages = [
    `${stock.ticker} 10k buy pls`,
    `Looking for ${stock.ticker} offers`,
    `Can I get a quote on ${stock.ticker}?`,
    `${stock.ticker} looking heavy`,
    `Anyone have ${stock.ticker}?`,
    `Need to sell ${stock.ticker} 5k`,
    `${stock.ticker} bid wanted`,
    `The quote has been executed on by ${player.role}, ${stock.ticker}:sell, volume:${Math.round(Math.random() * 10 + 1) * 1000}, price:${stock.currentPrice}`,
  ];

  const text = messages[Math.floor(Math.random() * messages.length)];

  // Track client requests for scoring
  if (text.includes('buy pls') || text.includes('offers') || text.includes('quote on') || text.includes('bid wanted') || text.includes('Need to sell')) {
    state.scoringData.totalClientRequests++;
  }

  return {
    id: `C-${nextChatId++}`,
    from: player.name,
    fromRole: player.role,
    fromTeam: player.team,
    text,
    timestamp: Date.now(),
    isQuote: false,
  };
}

export type GameUpdateCallback = (state: GameState) => void;

export function startGame(state: GameState, onUpdate: GameUpdateCallback): GameState {
  state.running = true;

  const initialNews: NewsItem = {
    id: `N-${nextNewsId++}`,
    ticker: 'NOTE',
    headline: 'Investment Banks: Make sure you providing fast and competitive quotes for your clients',
    timestamp: Date.now(),
    impact: 0,
  };
  state.newsItems.push(initialNews);

  // Game tick - every second
  gameTickInterval = setInterval(() => {
    if (!state.running) return;
    state.timeRemaining = Math.max(0, state.timeRemaining - 1);

    if (state.timeRemaining <= 0) {
      stopGame(state);
      onUpdate({ ...state });
      return;
    }

    // Expire old quotes
    const now = Date.now();
    state.quotes.forEach(q => {
      if (!q.expired && now - q.timestamp > q.validFor * 1000) {
        q.expired = true;
      }
    });

    // Update P&L metrics
    const metrics = calculatePositionMetrics(state.myPositions, state.stocks);
    state.realisedPnl = Math.round(metrics.realisedPnl * 100) / 100;
    state.unrealisedPnl = Math.round(metrics.unrealisedPnl * 100) / 100;
    state.netExposure = Math.round(metrics.netExposure * 100) / 100;
    state.totalPnl = Math.round((state.realisedPnl + state.unrealisedPnl - state.commission) * 100) / 100;

    onUpdate({ ...state });
  }, 1000);

  // Price updates - every 3 seconds
  priceInterval = setInterval(() => {
    if (!state.running) return;
    state.stocks = updateStockPrices(state.stocks);
  }, 3000);

  // Position snapshots for SSRM scoring - every 30 seconds
  snapshotInterval = setInterval(() => {
    if (!state.running) return;
    const metrics = calculatePositionMetrics(state.myPositions, state.stocks);
    state.scoringData.positionSnapshots.push({
      timestamp: Date.now(),
      netExposure: metrics.netExposure,
    });
  }, 30000);

  // News feed - every 30-90 seconds
  const scheduleNews = () => {
    const delay = (30 + Math.random() * 60) * 1000;
    newsInterval = setTimeout(() => {
      if (!state.running) return;
      if (newsIndex < NEWS_TEMPLATES.length) {
        const template = NEWS_TEMPLATES[newsIndex++];
        const news: NewsItem = {
          id: `N-${nextNewsId++}`,
          ticker: template.ticker,
          headline: template.headline,
          timestamp: Date.now(),
          impact: template.impact,
        };
        state.newsItems = [news, ...state.newsItems];
        state.stocks = applyNewsImpact(state.stocks, news);
        onUpdate({ ...state });
      }
      scheduleNews();
    }, delay) as any;
  };
  scheduleNews();

  // AI activity - quotes and chat every 2-5 seconds
  aiInterval = setInterval(() => {
    if (!state.running) return;

    if (Math.random() < 0.6) {
      const quote = generateAIQuote(state);
      if (quote) {
        state.quotes = [quote, ...state.quotes.slice(0, 99)];
      }
    }

    if (Math.random() < 0.4) {
      const msg = generateAIChatMessage(state);
      if (msg) {
        state.chatMessages = [...state.chatMessages, msg];
      }
    }

    onUpdate({ ...state });
  }, 2500);

  onUpdate({ ...state });
  return state;
}

export function stopGame(state: GameState): void {
  state.running = false;
  if (gameTickInterval) clearInterval(gameTickInterval);
  if (priceInterval) clearInterval(priceInterval);
  if (newsInterval) clearTimeout(newsInterval as any);
  if (aiInterval) clearInterval(aiInterval);
  if (snapshotInterval) clearInterval(snapshotInterval);
  gameTickInterval = null;
  priceInterval = null;
  newsInterval = null;
  aiInterval = null;
  snapshotInterval = null;
}

export function resetEngine(): void {
  nextQuoteId = 1;
  nextTradeId = 1;
  nextNewsId = 1;
  nextChatId = 1;
  newsIndex = 0;
}
