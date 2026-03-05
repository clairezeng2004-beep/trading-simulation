export type Role = 'IB' | 'AM';

export interface Stock {
  ticker: string;
  refPrice: number;
  currentPrice: number;
  prevPrice: number;
  percentChange: number;
  type: string;
  volatility: number;
}

export interface Position {
  ticker: string;
  netQty: number;
  avgPrice: number;
  posValue: number;
  unrealisedPnl: number;
  realisedPnl: number;
  netPnl: number;
}

export interface Trade {
  id: string;
  timestamp: number;
  ticker: string;
  side: 'BUY' | 'SELL';
  price: number;
  volume: number;
  counterparty: string;
  myRole: Role;
  source: 'exchange' | 'quote' | 'chat';
}

export interface Quote {
  id: string;
  from: string;
  fromRole: Role;
  fromTeam: number;
  ticker: string;
  bidPrice: number;
  offerPrice: number;
  bidVolume: number;
  offerVolume: number;
  validFor: number;
  timestamp: number;
  expired: boolean;
}

export interface ChatMessage {
  id: string;
  from: string;
  fromRole: Role;
  fromTeam: number;
  to?: string;        // recipient name, undefined = broadcast to all
  toRole?: Role;
  toTeam?: number;
  text: string;
  timestamp: number;
  isQuote: boolean;
}

export interface NewsItem {
  id: string;
  ticker: string;
  headline: string;
  timestamp: number;
  impact: number;
}

export interface Player {
  name: string;
  role: Role;
  team: number;
  isHuman: boolean;
}

// Scoring metrics
export interface SalesTraderMetrics {
  clientMatching: number;    // CM: % of client trade requests matched
  commission: number;        // COMM: commission earned vs best
  chatTrades: number;        // CT: trades done via chat/quotes vs exchange
  fatFingerCount: number;    // FFC: trades where price deviated >5% from market
}

export interface MarketMakerMetrics {
  exchangeImpactCount: number;  // EIC: large exchange trades that moved market
  exchangeTradeMetric: number;  // ETM: how well you broke up large trades
  pnl: number;                  // PnL score
  priceMaking: number;          // PRM: competitiveness of bid-offer spreads
  ssrm: number;                 // SSRM: ability to unwind risk positions
}

export interface ScoreCard {
  salesTrader: SalesTraderMetrics;
  marketMaker: MarketMakerMetrics;
  salesTraderOverall: number;
  marketMakerOverall: number;
}

// Tracking data for scoring
export interface ScoringData {
  totalClientRequests: number;
  matchedClientRequests: number;
  totalQuotesSent: number;
  quoteSpreads: number[];           // spread percentages of quotes
  exchangeTrades: Trade[];
  chatTrades: Trade[];
  fatFingerTrades: number;
  totalTrades: number;
  positionSnapshots: Array<{ timestamp: number; netExposure: number }>;
  largeExchangeTrades: number;      // exchange trades > threshold
  exchangeTradeChunks: number[];    // sizes of exchange trades (for ETM)
}

export interface GameState {
  running: boolean;
  timeRemaining: number;
  totalDuration: number;
  stocks: Stock[];
  players: Player[];
  myPlayer: Player;
  myPositions: Map<string, Position>;
  myTrades: Trade[];
  quotes: Quote[];
  chatMessages: ChatMessage[];
  newsItems: NewsItem[];
  realisedPnl: number;
  unrealisedPnl: number;
  netExposure: number;
  commission: number;
  totalPnl: number;
  scoringData: ScoringData;
}

export interface ExchangeOrder {
  ticker: string;
  side: 'BUY' | 'SELL';
  price: number;
  volume: number;
}
