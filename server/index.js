const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();

// CORS - allow frontend origins
app.use(cors({
  origin: process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',')
    : ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Initialize SQLite database
const dataDir = process.env.DATA_DIR || __dirname;
const dbPath = path.join(dataDir, 'trading_sessions.db');
const db = new Database(dbPath);
console.log(`Database path: ${dbPath}`);

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    player_name TEXT NOT NULL,
    role TEXT NOT NULL,
    team INTEGER,
    started_at TEXT NOT NULL,
    ended_at TEXT,
    duration_seconds INTEGER,
    total_pnl REAL DEFAULT 0,
    realised_pnl REAL DEFAULT 0,
    unrealised_pnl REAL DEFAULT 0,
    commission REAL DEFAULT 0,
    net_exposure REAL DEFAULT 0,
    total_trades INTEGER DEFAULT 0,
    -- Sales Trader Metrics
    score_cm REAL DEFAULT 0,
    score_comm REAL DEFAULT 0,
    score_ct REAL DEFAULT 0,
    score_ffc REAL DEFAULT 0,
    score_sales_overall REAL DEFAULT 0,
    -- Market Maker Metrics
    score_eic REAL DEFAULT 0,
    score_etm REAL DEFAULT 0,
    score_pnl REAL DEFAULT 0,
    score_prm REAL DEFAULT 0,
    score_ssrm REAL DEFAULT 0,
    score_mm_overall REAL DEFAULT 0,
    -- Raw scoring data
    scoring_data_json TEXT
  );

  CREATE TABLE IF NOT EXISTS trades (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    ticker TEXT NOT NULL,
    side TEXT NOT NULL,
    price REAL NOT NULL,
    volume INTEGER NOT NULL,
    counterparty TEXT,
    source TEXT,
    FOREIGN KEY (session_id) REFERENCES sessions(id)
  );

  CREATE TABLE IF NOT EXISTS price_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    ticker TEXT NOT NULL,
    price REAL NOT NULL,
    percent_change REAL DEFAULT 0,
    FOREIGN KEY (session_id) REFERENCES sessions(id)
  );

  CREATE TABLE IF NOT EXISTS position_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    net_exposure REAL DEFAULT 0,
    positions_json TEXT,
    FOREIGN KEY (session_id) REFERENCES sessions(id)
  );

  CREATE TABLE IF NOT EXISTS quotes_sent (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    ticker TEXT NOT NULL,
    bid_price REAL,
    offer_price REAL,
    bid_volume INTEGER,
    offer_volume INTEGER,
    spread_pct REAL,
    was_accepted INTEGER DEFAULT 0,
    FOREIGN KEY (session_id) REFERENCES sessions(id)
  );

  CREATE TABLE IF NOT EXISTS news_events (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    ticker TEXT NOT NULL,
    headline TEXT NOT NULL,
    impact REAL DEFAULT 0,
    FOREIGN KEY (session_id) REFERENCES sessions(id)
  );

  CREATE INDEX IF NOT EXISTS idx_trades_session ON trades(session_id);
  CREATE INDEX IF NOT EXISTS idx_price_snap_session ON price_snapshots(session_id);
  CREATE INDEX IF NOT EXISTS idx_pos_snap_session ON position_snapshots(session_id);
  CREATE INDEX IF NOT EXISTS idx_quotes_session ON quotes_sent(session_id);
  CREATE INDEX IF NOT EXISTS idx_news_session ON news_events(session_id);
`);

// ====== API Routes ======

// Save a complete session
app.post('/api/sessions', (req, res) => {
  try {
    const { session, trades, priceSnapshots, positionSnapshots, quotesSent, newsEvents } = req.body;

    const insertSession = db.prepare(`
      INSERT OR REPLACE INTO sessions (
        id, player_name, role, team, started_at, ended_at, duration_seconds,
        total_pnl, realised_pnl, unrealised_pnl, commission, net_exposure, total_trades,
        score_cm, score_comm, score_ct, score_ffc, score_sales_overall,
        score_eic, score_etm, score_pnl, score_prm, score_ssrm, score_mm_overall,
        scoring_data_json
      ) VALUES (
        @id, @player_name, @role, @team, @started_at, @ended_at, @duration_seconds,
        @total_pnl, @realised_pnl, @unrealised_pnl, @commission, @net_exposure, @total_trades,
        @score_cm, @score_comm, @score_ct, @score_ffc, @score_sales_overall,
        @score_eic, @score_etm, @score_pnl, @score_prm, @score_ssrm, @score_mm_overall,
        @scoring_data_json
      )
    `);

    const insertTrade = db.prepare(`
      INSERT OR REPLACE INTO trades (id, session_id, timestamp, ticker, side, price, volume, counterparty, source)
      VALUES (@id, @session_id, @timestamp, @ticker, @side, @price, @volume, @counterparty, @source)
    `);

    const insertPriceSnap = db.prepare(`
      INSERT INTO price_snapshots (session_id, timestamp, ticker, price, percent_change)
      VALUES (@session_id, @timestamp, @ticker, @price, @percent_change)
    `);

    const insertPosSnap = db.prepare(`
      INSERT INTO position_snapshots (session_id, timestamp, net_exposure, positions_json)
      VALUES (@session_id, @timestamp, @net_exposure, @positions_json)
    `);

    const insertQuote = db.prepare(`
      INSERT OR REPLACE INTO quotes_sent (id, session_id, timestamp, ticker, bid_price, offer_price, bid_volume, offer_volume, spread_pct, was_accepted)
      VALUES (@id, @session_id, @timestamp, @ticker, @bid_price, @offer_price, @bid_volume, @offer_volume, @spread_pct, @was_accepted)
    `);

    const insertNews = db.prepare(`
      INSERT OR REPLACE INTO news_events (id, session_id, timestamp, ticker, headline, impact)
      VALUES (@id, @session_id, @timestamp, @ticker, @headline, @impact)
    `);

    const transaction = db.transaction(() => {
      insertSession.run(session);

      if (trades && trades.length > 0) {
        for (const t of trades) {
          insertTrade.run(t);
        }
      }

      if (priceSnapshots && priceSnapshots.length > 0) {
        for (const ps of priceSnapshots) {
          insertPriceSnap.run(ps);
        }
      }

      if (positionSnapshots && positionSnapshots.length > 0) {
        for (const ps of positionSnapshots) {
          insertPosSnap.run(ps);
        }
      }

      if (quotesSent && quotesSent.length > 0) {
        for (const q of quotesSent) {
          insertQuote.run(q);
        }
      }

      if (newsEvents && newsEvents.length > 0) {
        for (const n of newsEvents) {
          insertNews.run(n);
        }
      }
    });

    transaction();
    res.json({ success: true, sessionId: session.id });
  } catch (err) {
    console.error('Error saving session:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get all sessions (summary)
app.get('/api/sessions', (req, res) => {
  try {
    const sessions = db.prepare(`
      SELECT id, player_name, role, team, started_at, ended_at, duration_seconds,
             total_pnl, commission, total_trades,
             score_sales_overall, score_mm_overall,
             score_cm, score_comm, score_ct, score_ffc,
             score_eic, score_etm, score_pnl, score_prm, score_ssrm
      FROM sessions
      ORDER BY started_at DESC
    `).all();
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get a single session with full detail
app.get('/api/sessions/:id', (req, res) => {
  try {
    const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const trades = db.prepare('SELECT * FROM trades WHERE session_id = ? ORDER BY timestamp').all(req.params.id);
    const priceSnapshots = db.prepare('SELECT * FROM price_snapshots WHERE session_id = ? ORDER BY timestamp').all(req.params.id);
    const positionSnapshots = db.prepare('SELECT * FROM position_snapshots WHERE session_id = ? ORDER BY timestamp').all(req.params.id);
    const quotesSent = db.prepare('SELECT * FROM quotes_sent WHERE session_id = ? ORDER BY timestamp').all(req.params.id);
    const newsEvents = db.prepare('SELECT * FROM news_events WHERE session_id = ? ORDER BY timestamp').all(req.params.id);

    res.json({ session, trades, priceSnapshots, positionSnapshots, quotesSent, newsEvents });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a session
app.delete('/api/sessions/:id', (req, res) => {
  try {
    const deleteTransaction = db.transaction(() => {
      db.prepare('DELETE FROM trades WHERE session_id = ?').run(req.params.id);
      db.prepare('DELETE FROM price_snapshots WHERE session_id = ?').run(req.params.id);
      db.prepare('DELETE FROM position_snapshots WHERE session_id = ?').run(req.params.id);
      db.prepare('DELETE FROM quotes_sent WHERE session_id = ?').run(req.params.id);
      db.prepare('DELETE FROM news_events WHERE session_id = ?').run(req.params.id);
      db.prepare('DELETE FROM sessions WHERE id = ?').run(req.params.id);
    });
    deleteTransaction();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get review/analysis for a session
app.get('/api/sessions/:id/review', (req, res) => {
  try {
    const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const trades = db.prepare('SELECT * FROM trades WHERE session_id = ? ORDER BY timestamp').all(req.params.id);
    const positionSnapshots = db.prepare('SELECT * FROM position_snapshots WHERE session_id = ? ORDER BY timestamp').all(req.params.id);
    const quotesSent = db.prepare('SELECT * FROM quotes_sent WHERE session_id = ? ORDER BY timestamp').all(req.params.id);

    // Generate review analysis
    const review = generateReview(session, trades, positionSnapshots, quotesSent);
    res.json(review);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get aggregate stats across all sessions
app.get('/api/stats', (req, res) => {
  try {
    const stats = db.prepare(`
      SELECT
        COUNT(*) as total_sessions,
        AVG(total_pnl) as avg_pnl,
        MAX(total_pnl) as best_pnl,
        MIN(total_pnl) as worst_pnl,
        AVG(commission) as avg_commission,
        AVG(total_trades) as avg_trades,
        AVG(score_sales_overall) as avg_sales_score,
        AVG(score_mm_overall) as avg_mm_score,
        AVG(score_cm) as avg_cm,
        AVG(score_comm) as avg_comm,
        AVG(score_ct) as avg_ct,
        AVG(score_ffc) as avg_ffc,
        AVG(score_eic) as avg_eic,
        AVG(score_etm) as avg_etm,
        AVG(score_pnl) as avg_pnl_score,
        AVG(score_prm) as avg_prm,
        AVG(score_ssrm) as avg_ssrm
      FROM sessions
    `).get();
    
    // Score trends over time
    const trends = db.prepare(`
      SELECT id, started_at, score_sales_overall, score_mm_overall, total_pnl, commission
      FROM sessions
      ORDER BY started_at ASC
    `).all();

    res.json({ stats, trends });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ====== Review Analysis Engine ======
function generateReview(session, trades, positionSnapshots, quotesSent) {
  const suggestions = [];
  const strengths = [];
  const weaknesses = [];
  
  // Timeline analysis
  const tradeTimeline = analyzeTradeTimeline(trades, session.duration_seconds);
  
  // --- Sales Trader Analysis ---
  
  // CM (Client Matching)
  if (session.score_cm < 40) {
    weaknesses.push({
      metric: 'CM',
      score: session.score_cm,
      message: '客户匹配率偏低，说明你没有积极响应客户的交易请求。'
    });
    suggestions.push({
      priority: 'high',
      category: 'Sales Trader',
      metric: 'CM',
      title: '提高客户匹配率',
      details: '当AI客户在聊天中发送交易请求时，需要快速响应并通过Quote面板发送竞争性报价。目标是匹配至少60%的客户请求。注意留意Chat面板中其他玩家发来的买卖请求。'
    });
  } else if (session.score_cm >= 70) {
    strengths.push({ metric: 'CM', score: session.score_cm, message: '客户匹配率很高，与客户保持了良好的沟通。' });
  }

  // COMM (Commission)
  if (session.score_comm < 40) {
    weaknesses.push({
      metric: 'COMM',
      score: session.score_comm,
      message: '佣金收入过低，需要增加交易量。'
    });
    suggestions.push({
      priority: 'high',
      category: 'Sales Trader',
      metric: 'COMM',
      title: '提高佣金收入',
      details: '佣金来自每笔交易的0.5%手续费。增加交易频率和交易量是提高佣金的关键。目标是每分钟至少产生$500的佣金。多关注高价资产（如SPX）的交易机会，因为它们的佣金绝对值更高。'
    });
  } else if (session.score_comm >= 70) {
    strengths.push({ metric: 'COMM', score: session.score_comm, message: '佣金收入表现优秀。' });
  }

  // CT (Chat Trades)
  const chatTradeRatio = trades.filter(t => t.source === 'chat' || t.source === 'quote').length / Math.max(trades.length, 1);
  if (session.score_ct < 40) {
    weaknesses.push({
      metric: 'CT',
      score: session.score_ct,
      message: `聊天/报价交易占比只有${Math.round(chatTradeRatio * 100)}%，大部分交易通过交易所完成。`
    });
    suggestions.push({
      priority: 'medium',
      category: 'Sales Trader',
      metric: 'CT',
      title: '增加通过报价/聊天完成的交易',
      details: '作为IB角色，你的核心工作是为客户做市。应该更多地使用Quote面板发送双向报价（bid/offer），并积极接受Chat中其他玩家的报价。交易所交易应该主要用于对冲风险，而不是主要交易渠道。'
    });
  } else if (session.score_ct >= 70) {
    strengths.push({ metric: 'CT', score: session.score_ct, message: '大部分交易通过报价/聊天完成，展示了良好的客户关系管理。' });
  }

  // FFC (Fat Finger Count)
  if (session.score_ffc < 70) {
    weaknesses.push({
      metric: 'FFC',
      score: session.score_ffc,
      message: '有较多交易价格偏离市场价超过5%，存在"胖手指"风险。'
    });
    suggestions.push({
      priority: 'high',
      category: 'Sales Trader',
      metric: 'FFC',
      title: '减少价格输入错误',
      details: '在提交交易前，务必仔细检查价格是否与当前市场价格接近（偏差不应超过5%）。建议在发送报价时参考Equity面板中显示的实时价格，避免手动输入错误。'
    });
  } else if (session.score_ffc >= 90) {
    strengths.push({ metric: 'FFC', score: session.score_ffc, message: '价格输入非常精准，几乎没有"胖手指"错误。' });
  }

  // --- Market Maker Analysis ---

  // EIC (Exchange Impact Count)
  if (session.score_eic < 40) {
    weaknesses.push({
      metric: 'EIC',
      score: session.score_eic,
      message: '在交易所的大额交易对市场造成了较大冲击。'
    });
    suggestions.push({
      priority: 'high',
      category: 'Market Maker',
      metric: 'EIC',
      title: '减少市场冲击',
      details: '避免在交易所一次性下大单（超过5000股）。大额订单应该拆分成多个小单执行，这样可以减少对市场价格的影响。'
    });
  } else if (session.score_eic >= 70) {
    strengths.push({ metric: 'EIC', score: session.score_eic, message: '交易所交易控制得当，市场冲击较小。' });
  }

  // ETM (Exchange Trade Metric)
  if (session.score_etm < 40) {
    weaknesses.push({
      metric: 'ETM',
      score: session.score_etm,
      message: '交易所订单拆分不够精细。'
    });
    suggestions.push({
      priority: 'medium',
      category: 'Market Maker',
      metric: 'ETM',
      title: '优化订单拆分策略',
      details: '当你需要在交易所对冲大额头寸时，将订单拆分为约1000股/手的小块。例如，如果你需要卖出5000股NFLX，应该分5次每次1000股执行，而不是一次性卖出。这体现了对流动性风险的理解。'
    });
  } else if (session.score_etm >= 70) {
    strengths.push({ metric: 'ETM', score: session.score_etm, message: '订单拆分策略有效，展示了对流动性风险的良好理解。' });
  }

  // PnL Score
  if (session.score_pnl < 40) {
    weaknesses.push({
      metric: 'PnL',
      score: session.score_pnl,
      message: 'P&L远超佣金收入，说明存在过多方向性风险暴露。'
    });
    suggestions.push({
      priority: 'high',
      category: 'Market Maker',
      metric: 'PnL',
      title: '控制P&L在合理范围内',
      details: '作为IB，你的P&L理想状态应该接近零且不超过佣金收入。高P&L意味着你在承担方向性风险而非做市。在完成客户交易后，应该及时通过交易所对冲头寸，保持风险中性。'
    });
  } else if (session.score_pnl >= 70) {
    strengths.push({ metric: 'PnL', score: session.score_pnl, message: 'P&L控制得当，保持了风险中性的做市策略。' });
  }

  // PRM (Price Making)
  if (session.score_prm < 40) {
    const avgSpread = quotesSent.length > 0 
      ? quotesSent.reduce((sum, q) => sum + (q.spread_pct || 0), 0) / quotesSent.length
      : 0;
    weaknesses.push({
      metric: 'PRM',
      score: session.score_prm,
      message: `平均报价价差为${(avgSpread * 100).toFixed(2)}%，缺乏竞争力。`
    });
    suggestions.push({
      priority: 'medium',
      category: 'Market Maker',
      metric: 'PRM',
      title: '收紧报价价差',
      details: '你的bid-offer价差应该保持在0.5%-1.5%之间。过宽的价差会让客户选择其他IB。例如，如果NFLX当前价格是$540，你的bid/offer可以设为$538/$542（约0.7%价差），而不是$530/$550（约3.7%价差）。'
    });
  } else if (session.score_prm >= 70) {
    strengths.push({ metric: 'PRM', score: session.score_prm, message: '报价价差具有竞争力，展示了优秀的做市能力。' });
  }

  // SSRM (Sell Side Risk Management)
  if (session.score_ssrm < 40) {
    weaknesses.push({
      metric: 'SSRM',
      score: session.score_ssrm,
      message: '风险头寸没有得到有效平仓，净敞口在模拟期间持续积累。'
    });
    suggestions.push({
      priority: 'high',
      category: 'Market Maker',
      metric: 'SSRM',
      title: '改善风险管理',
      details: '每次完成客户交易后，应该在30-60秒内通过交易所对冲头寸。定期检查Positions面板，确保各品种的净头寸不会长时间偏离零。如果某个品种的头寸过大，立即分批对冲。'
    });
  } else if (session.score_ssrm >= 70) {
    strengths.push({ metric: 'SSRM', score: session.score_ssrm, message: '风险管理到位，头寸平仓高效。' });
  }

  // --- Trade Activity Analysis ---
  if (trades.length < 10) {
    suggestions.push({
      priority: 'high',
      category: 'General',
      metric: 'Activity',
      title: '增加交易活跃度',
      details: `本场仅完成${trades.length}笔交易，远低于理想水平。30分钟内应该完成至少20-30笔交易。更积极地响应客户请求，同时主动发送报价吸引交易。`
    });
  }

  // Quote activity
  if (quotesSent.length < 5) {
    suggestions.push({
      priority: 'medium',
      category: 'General',
      metric: 'Quoting',
      title: '增加报价频率',
      details: `本场仅发送了${quotesSent.length}个报价。作为做市商，你应该持续为各品种提供双向报价。建议每2-3分钟至少发送一个报价。`
    });
  }

  // Concentration analysis
  const tickerCounts = {};
  trades.forEach(t => { tickerCounts[t.ticker] = (tickerCounts[t.ticker] || 0) + 1; });
  const tickers = Object.keys(tickerCounts);
  if (tickers.length <= 2 && trades.length > 5) {
    suggestions.push({
      priority: 'low',
      category: 'General',
      metric: 'Diversification',
      title: '分散交易品种',
      details: `交易集中在${tickers.join('、')}上。6个品种都应该有所涉及，这样可以更好地服务不同客户需求，同时分散风险。`
    });
  }

  // Trade timing analysis
  if (tradeTimeline.earlyPhaseEmpty) {
    suggestions.push({
      priority: 'medium',
      category: 'General',
      metric: 'Timing',
      title: '更早开始交易',
      details: '你在模拟开始的前5分钟几乎没有交易。应该在游戏开始后尽快建立交易节奏，抓住早期市场机会。'
    });
  }

  if (tradeTimeline.latePhaseRush) {
    suggestions.push({
      priority: 'medium',
      category: 'General',
      metric: 'Timing',
      title: '避免最后阶段突击交易',
      details: '你有大量交易集中在最后5分钟。这通常意味着前期不够积极，最后匆忙交易容易导致价格错误和风险累积。建议均匀分配交易节奏。'
    });
  }

  // Exposure trend
  if (positionSnapshots.length > 2) {
    const lastThreeExposures = positionSnapshots.slice(-3).map(s => Math.abs(s.net_exposure));
    if (lastThreeExposures.every(e => e > 50000)) {
      suggestions.push({
        priority: 'high',
        category: 'Market Maker',
        metric: 'Exposure',
        title: '降低末期风险暴露',
        details: '模拟末期你的净敞口仍然很大。在模拟结束前5-10分钟，应该加速平仓，将净敞口降到最低。大额未平仓头寸会严重影响SSRM评分。'
      });
    }
  }

  // Overall grade
  const overallScore = Math.round((session.score_sales_overall + session.score_mm_overall) / 2);
  let grade, gradeDescription;
  if (overallScore >= 80) { grade = 'A'; gradeDescription = '表现卓越，展示了优秀的交易和做市能力。'; }
  else if (overallScore >= 65) { grade = 'B'; gradeDescription = '表现良好，但仍有提升空间。'; }
  else if (overallScore >= 50) { grade = 'C'; gradeDescription = '表现中等，需要在多个方面进行改进。'; }
  else if (overallScore >= 35) { grade = 'D'; gradeDescription = '表现较弱，需要大幅提升交易策略。'; }
  else { grade = 'F'; gradeDescription = '表现不佳，建议从基础交易策略开始练习。'; }

  return {
    sessionId: session.id,
    overallScore,
    grade,
    gradeDescription,
    salesTraderScore: session.score_sales_overall,
    marketMakerScore: session.score_mm_overall,
    strengths,
    weaknesses,
    suggestions: suggestions.sort((a, b) => {
      const priority = { high: 0, medium: 1, low: 2 };
      return (priority[a.priority] || 2) - (priority[b.priority] || 2);
    }),
    tradeStats: {
      totalTrades: trades.length,
      exchangeTrades: trades.filter(t => t.source === 'exchange').length,
      chatTrades: trades.filter(t => t.source === 'chat' || t.source === 'quote').length,
      tickerBreakdown: tickerCounts,
      tradeTimeline: tradeTimeline.buckets,
      quotesSent: quotesSent.length,
      quotesAccepted: quotesSent.filter(q => q.was_accepted).length,
    }
  };
}

function analyzeTradeTimeline(trades, durationSeconds) {
  const bucketSize = 300; // 5-minute buckets
  const bucketCount = Math.ceil(durationSeconds / bucketSize);
  const buckets = new Array(bucketCount).fill(0);
  
  const startTime = trades.length > 0 ? Math.min(...trades.map(t => t.timestamp)) : 0;
  
  trades.forEach(t => {
    const elapsed = (t.timestamp - startTime) / 1000;
    const bucketIdx = Math.min(Math.floor(elapsed / bucketSize), bucketCount - 1);
    if (bucketIdx >= 0) buckets[bucketIdx]++;
  });

  return {
    buckets,
    earlyPhaseEmpty: buckets[0] === 0 && trades.length > 3,
    latePhaseRush: buckets.length > 1 && buckets[buckets.length - 1] > trades.length * 0.4,
  };
}

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`Trading Simulation API server running on port ${PORT}`);
  console.log(`Database: ${dbPath}`);
});
