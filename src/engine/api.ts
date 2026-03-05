const API_BASE = process.env.REACT_APP_API_URL || '/api';

export interface SessionSummary {
  id: string;
  player_name: string;
  role: string;
  team: number;
  started_at: string;
  ended_at: string;
  duration_seconds: number;
  total_pnl: number;
  commission: number;
  total_trades: number;
  score_sales_overall: number;
  score_mm_overall: number;
  score_cm: number;
  score_comm: number;
  score_ct: number;
  score_ffc: number;
  score_eic: number;
  score_etm: number;
  score_pnl: number;
  score_prm: number;
  score_ssrm: number;
}

export interface ReviewSuggestion {
  priority: 'high' | 'medium' | 'low';
  category: string;
  metric: string;
  title: string;
  details: string;
}

export interface ReviewStrength {
  metric: string;
  score: number;
  message: string;
}

export interface ReviewWeakness {
  metric: string;
  score: number;
  message: string;
}

export interface ReviewData {
  sessionId: string;
  overallScore: number;
  grade: string;
  gradeDescription: string;
  salesTraderScore: number;
  marketMakerScore: number;
  strengths: ReviewStrength[];
  weaknesses: ReviewWeakness[];
  suggestions: ReviewSuggestion[];
  tradeStats: {
    totalTrades: number;
    exchangeTrades: number;
    chatTrades: number;
    tickerBreakdown: Record<string, number>;
    tradeTimeline: number[];
    quotesSent: number;
    quotesAccepted: number;
  };
}

export interface AggregateStats {
  stats: {
    total_sessions: number;
    avg_pnl: number;
    best_pnl: number;
    worst_pnl: number;
    avg_commission: number;
    avg_trades: number;
    avg_sales_score: number;
    avg_mm_score: number;
    avg_cm: number;
    avg_comm: number;
    avg_ct: number;
    avg_ffc: number;
    avg_eic: number;
    avg_etm: number;
    avg_pnl_score: number;
    avg_prm: number;
    avg_ssrm: number;
  };
  trends: Array<{
    id: string;
    started_at: string;
    score_sales_overall: number;
    score_mm_overall: number;
    total_pnl: number;
    commission: number;
  }>;
}

// Import types from game engine
import { GameState, ScoreCard, Trade, Stock } from './types';

export async function saveSession(
  state: GameState,
  scoreCard: ScoreCard,
  priceHistory: Array<{ timestamp: number; ticker: string; price: number; percentChange: number }>,
  quotesTracking: Array<{ id: string; timestamp: number; ticker: string; bidPrice: number; offerPrice: number; bidVolume: number; offerVolume: number; spreadPct: number; wasAccepted: boolean }>
): Promise<{ success: boolean; sessionId: string }> {
  const sessionId = `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const sessionData = {
    session: {
      id: sessionId,
      player_name: state.myPlayer.name,
      role: state.myPlayer.role,
      team: state.myPlayer.team,
      started_at: new Date(Date.now() - (state.totalDuration - state.timeRemaining) * 1000).toISOString(),
      ended_at: new Date().toISOString(),
      duration_seconds: state.totalDuration - state.timeRemaining,
      total_pnl: state.totalPnl,
      realised_pnl: state.realisedPnl,
      unrealised_pnl: state.unrealisedPnl,
      commission: state.commission,
      net_exposure: state.netExposure,
      total_trades: state.myTrades.length,
      score_cm: scoreCard.salesTrader.clientMatching,
      score_comm: scoreCard.salesTrader.commission,
      score_ct: scoreCard.salesTrader.chatTrades,
      score_ffc: scoreCard.salesTrader.fatFingerCount,
      score_sales_overall: scoreCard.salesTraderOverall,
      score_eic: scoreCard.marketMaker.exchangeImpactCount,
      score_etm: scoreCard.marketMaker.exchangeTradeMetric,
      score_pnl: scoreCard.marketMaker.pnl,
      score_prm: scoreCard.marketMaker.priceMaking,
      score_ssrm: scoreCard.marketMaker.ssrm,
      score_mm_overall: scoreCard.marketMakerOverall,
      scoring_data_json: JSON.stringify(state.scoringData),
    },
    trades: state.myTrades.map(t => ({
      id: t.id,
      session_id: sessionId,
      timestamp: t.timestamp,
      ticker: t.ticker,
      side: t.side,
      price: t.price,
      volume: t.volume,
      counterparty: t.counterparty,
      source: t.source,
    })),
    priceSnapshots: priceHistory.map(p => ({
      session_id: sessionId,
      timestamp: p.timestamp,
      ticker: p.ticker,
      price: p.price,
      percent_change: p.percentChange,
    })),
    positionSnapshots: state.scoringData.positionSnapshots.map(ps => ({
      session_id: sessionId,
      timestamp: ps.timestamp,
      net_exposure: ps.netExposure,
      positions_json: '{}',
    })),
    quotesSent: quotesTracking.map(q => ({
      id: q.id,
      session_id: sessionId,
      timestamp: q.timestamp,
      ticker: q.ticker,
      bid_price: q.bidPrice,
      offer_price: q.offerPrice,
      bid_volume: q.bidVolume,
      offer_volume: q.offerVolume,
      spread_pct: q.spreadPct,
      was_accepted: q.wasAccepted ? 1 : 0,
    })),
    newsEvents: state.newsItems.map(n => ({
      id: n.id,
      session_id: sessionId,
      timestamp: n.timestamp,
      ticker: n.ticker,
      headline: n.headline,
      impact: n.impact,
    })),
  };

  try {
    const response = await fetch(`${API_BASE}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sessionData),
    });
    const result = await response.json();
    return { success: true, sessionId: result.sessionId || sessionId };
  } catch (err) {
    console.error('Failed to save session:', err);
    return { success: false, sessionId: '' };
  }
}

export async function getSessions(): Promise<SessionSummary[]> {
  try {
    const response = await fetch(`${API_BASE}/sessions`);
    return await response.json();
  } catch (err) {
    console.error('Failed to fetch sessions:', err);
    return [];
  }
}

export async function getSessionReview(sessionId: string): Promise<ReviewData | null> {
  try {
    const response = await fetch(`${API_BASE}/sessions/${sessionId}/review`);
    if (!response.ok) return null;
    return await response.json();
  } catch (err) {
    console.error('Failed to fetch review:', err);
    return null;
  }
}

export async function getAggregateStats(): Promise<AggregateStats | null> {
  try {
    const response = await fetch(`${API_BASE}/stats`);
    if (!response.ok) return null;
    return await response.json();
  } catch (err) {
    console.error('Failed to fetch stats:', err);
    return null;
  }
}

export async function deleteSession(sessionId: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/sessions/${sessionId}`, { method: 'DELETE' });
    const result = await response.json();
    return result.success;
  } catch (err) {
    console.error('Failed to delete session:', err);
    return false;
  }
}
