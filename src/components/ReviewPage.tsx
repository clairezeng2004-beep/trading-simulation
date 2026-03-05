import React, { useEffect, useState } from 'react';
import {
  getSessions,
  getSessionReview,
  getAggregateStats,
  deleteSession,
  SessionSummary,
  ReviewData,
  AggregateStats,
} from '../engine/api';

interface Props {
  onBack: () => void;
}

const PRIORITY_COLORS: Record<string, string> = {
  high: '#f23645',
  medium: '#f0b90b',
  low: '#3a7bd5',
};

const PRIORITY_LABELS: Record<string, string> = {
  high: '高优先',
  medium: '中等',
  low: '建议',
};

const GRADE_COLORS: Record<string, string> = {
  A: '#00d26a',
  B: '#5b7fb5',
  C: '#f0b90b',
  D: '#f28b30',
  F: '#f23645',
};

const ReviewPage: React.FC<Props> = ({ onBack }) => {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [review, setReview] = useState<ReviewData | null>(null);
  const [aggStats, setAggStats] = useState<AggregateStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'history' | 'review' | 'trends'>('history');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [sessionsData, statsData] = await Promise.all([
      getSessions(),
      getAggregateStats(),
    ]);
    setSessions(sessionsData);
    setAggStats(statsData);
    setLoading(false);
  };

  const handleSelectSession = async (sessionId: string) => {
    setSelectedSessionId(sessionId);
    setReviewLoading(true);
    setActiveTab('review');
    const reviewData = await getSessionReview(sessionId);
    setReview(reviewData);
    setReviewLoading(false);
  };

  const handleDelete = async (sessionId: string) => {
    if (window.confirm('确定要删除这场记录吗？')) {
      await deleteSession(sessionId);
      if (selectedSessionId === sessionId) {
        setSelectedSessionId(null);
        setReview(null);
      }
      loadData();
    }
  };

  const formatDate = (isoStr: string) => {
    const d = new Date(isoStr);
    return d.toLocaleDateString('zh-CN', {
      month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    });
  };

  const formatPnl = (n: number) => {
    const sign = n >= 0 ? '+' : '';
    return `${sign}$${n.toFixed(2)}`;
  };

  if (loading) {
    return (
      <div className="review-page">
        <div className="review-loading">
          <div className="loading-spinner" />
          <div>加载历史数据...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="review-page">
      {/* Header */}
      <div className="review-header">
        <button className="review-back-btn" onClick={onBack}>← 返回</button>
        <h1>交易复盘中心</h1>
        <div className="review-tabs">
          <button
            className={`review-tab ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            历史记录
          </button>
          <button
            className={`review-tab ${activeTab === 'review' ? 'active' : ''}`}
            onClick={() => setActiveTab('review')}
            disabled={!review}
          >
            复盘分析
          </button>
          <button
            className={`review-tab ${activeTab === 'trends' ? 'active' : ''}`}
            onClick={() => setActiveTab('trends')}
          >
            成长趋势
          </button>
        </div>
      </div>

      <div className="review-content">
        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="review-history">
            {sessions.length === 0 ? (
              <div className="review-empty">
                <div className="empty-icon">📊</div>
                <h3>暂无交易记录</h3>
                <p>完成一场模拟后，你的操作数据将自动保存到这里</p>
                <button className="btn-restart" onClick={onBack}>开始新的模拟</button>
              </div>
            ) : (
              <>
                {/* Summary cards */}
                {aggStats && aggStats.stats.total_sessions > 0 && (
                  <div className="review-summary-cards">
                    <div className="summary-card">
                      <div className="summary-label">总场次</div>
                      <div className="summary-value">{aggStats.stats.total_sessions}</div>
                    </div>
                    <div className="summary-card">
                      <div className="summary-label">平均 P&L</div>
                      <div className={`summary-value ${aggStats.stats.avg_pnl >= 0 ? 'pnl-positive' : 'pnl-negative'}`}>
                        {formatPnl(aggStats.stats.avg_pnl)}
                      </div>
                    </div>
                    <div className="summary-card">
                      <div className="summary-label">最佳 P&L</div>
                      <div className="summary-value pnl-positive">{formatPnl(aggStats.stats.best_pnl)}</div>
                    </div>
                    <div className="summary-card">
                      <div className="summary-label">平均Sales分</div>
                      <div className="summary-value">{Math.round(aggStats.stats.avg_sales_score)}%</div>
                    </div>
                    <div className="summary-card">
                      <div className="summary-label">平均MM分</div>
                      <div className="summary-value">{Math.round(aggStats.stats.avg_mm_score)}%</div>
                    </div>
                  </div>
                )}

                <div className="session-list">
                  <table className="session-table">
                    <thead>
                      <tr>
                        <th>日期</th>
                        <th>角色</th>
                        <th>Total P&L</th>
                        <th>Commission</th>
                        <th>交易数</th>
                        <th>Sales Score</th>
                        <th>MM Score</th>
                        <th>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sessions.map(s => (
                        <tr
                          key={s.id}
                          className={selectedSessionId === s.id ? 'selected' : ''}
                          onClick={() => handleSelectSession(s.id)}
                        >
                          <td>{formatDate(s.started_at)}</td>
                          <td><span className={`role-badge role-${s.role.toLowerCase()}`}>{s.role}-{s.team}</span></td>
                          <td className={s.total_pnl >= 0 ? 'pnl-positive' : 'pnl-negative'}>
                            {formatPnl(s.total_pnl)}
                          </td>
                          <td style={{ color: '#f0b90b' }}>${s.commission.toFixed(2)}</td>
                          <td>{s.total_trades}</td>
                          <td>
                            <span className={`score-badge ${s.score_sales_overall >= 60 ? 'good' : 'poor'}`}>
                              {Math.round(s.score_sales_overall)}%
                            </span>
                          </td>
                          <td>
                            <span className={`score-badge ${s.score_mm_overall >= 60 ? 'good' : 'poor'}`}>
                              {Math.round(s.score_mm_overall)}%
                            </span>
                          </td>
                          <td>
                            <button
                              className="btn-review-sm"
                              onClick={(e) => { e.stopPropagation(); handleSelectSession(s.id); }}
                            >
                              复盘
                            </button>
                            <button
                              className="btn-delete-sm"
                              onClick={(e) => { e.stopPropagation(); handleDelete(s.id); }}
                            >
                              删除
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {/* Review Tab */}
        {activeTab === 'review' && (
          <div className="review-detail">
            {reviewLoading ? (
              <div className="review-loading">
                <div className="loading-spinner" />
                <div>正在生成复盘报告...</div>
              </div>
            ) : !review ? (
              <div className="review-empty">
                <h3>请从历史记录中选择一场进行复盘</h3>
              </div>
            ) : (
              <>
                {/* Grade Header */}
                <div className="review-grade-header">
                  <div className="grade-circle" style={{ borderColor: GRADE_COLORS[review.grade] || '#999' }}>
                    <span className="grade-letter" style={{ color: GRADE_COLORS[review.grade] || '#999' }}>
                      {review.grade}
                    </span>
                    <span className="grade-score">{review.overallScore}%</span>
                  </div>
                  <div className="grade-info">
                    <h2>综合评价: {review.grade}级</h2>
                    <p>{review.gradeDescription}</p>
                    <div className="grade-sub-scores">
                      <span>Sales Trader: <strong>{Math.round(review.salesTraderScore)}%</strong></span>
                      <span>Market Maker: <strong>{Math.round(review.marketMakerScore)}%</strong></span>
                    </div>
                  </div>
                </div>

                {/* Trade Stats Overview */}
                <div className="review-trade-stats">
                  <h3>交易概况</h3>
                  <div className="trade-stats-grid">
                    <div className="trade-stat">
                      <div className="trade-stat-value">{review.tradeStats.totalTrades}</div>
                      <div className="trade-stat-label">总交易数</div>
                    </div>
                    <div className="trade-stat">
                      <div className="trade-stat-value">{review.tradeStats.exchangeTrades}</div>
                      <div className="trade-stat-label">交易所交易</div>
                    </div>
                    <div className="trade-stat">
                      <div className="trade-stat-value">{review.tradeStats.chatTrades}</div>
                      <div className="trade-stat-label">报价/聊天交易</div>
                    </div>
                    <div className="trade-stat">
                      <div className="trade-stat-value">{review.tradeStats.quotesSent}</div>
                      <div className="trade-stat-label">发送报价数</div>
                    </div>
                    <div className="trade-stat">
                      <div className="trade-stat-value">{review.tradeStats.quotesAccepted}</div>
                      <div className="trade-stat-label">被接受报价</div>
                    </div>
                  </div>

                  {/* Ticker Breakdown */}
                  <div className="ticker-breakdown">
                    <h4>品种交易分布</h4>
                    <div className="ticker-bars">
                      {Object.entries(review.tradeStats.tickerBreakdown)
                        .sort((a, b) => b[1] - a[1])
                        .map(([ticker, count]) => (
                          <div key={ticker} className="ticker-bar-row">
                            <span className="ticker-bar-label">{ticker}</span>
                            <div className="ticker-bar-track">
                              <div
                                className="ticker-bar-fill"
                                style={{
                                  width: `${(count / review.tradeStats.totalTrades) * 100}%`,
                                }}
                              />
                            </div>
                            <span className="ticker-bar-count">{count}</span>
                          </div>
                        ))}
                    </div>
                  </div>

                  {/* Trade Timeline */}
                  {review.tradeStats.tradeTimeline.length > 0 && (
                    <div className="trade-timeline">
                      <h4>交易时间分布 (每5分钟)</h4>
                      <div className="timeline-chart">
                        {review.tradeStats.tradeTimeline.map((count, idx) => {
                          const maxCount = Math.max(...review.tradeStats.tradeTimeline, 1);
                          return (
                            <div key={idx} className="timeline-bar-col">
                              <div
                                className="timeline-bar"
                                style={{ height: `${(count / maxCount) * 100}%` }}
                              />
                              <div className="timeline-label">{idx * 5}-{(idx + 1) * 5}m</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Strengths */}
                {review.strengths.length > 0 && (
                  <div className="review-section review-strengths">
                    <h3>优势</h3>
                    {review.strengths.map((s, i) => (
                      <div key={i} className="strength-item">
                        <div className="strength-metric">
                          <span className="metric-badge good">{s.metric}</span>
                          <span className="metric-score">{s.score}%</span>
                        </div>
                        <div className="strength-message">{s.message}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Weaknesses */}
                {review.weaknesses.length > 0 && (
                  <div className="review-section review-weaknesses">
                    <h3>需要改进</h3>
                    {review.weaknesses.map((w, i) => (
                      <div key={i} className="weakness-item">
                        <div className="weakness-metric">
                          <span className="metric-badge poor">{w.metric}</span>
                          <span className="metric-score">{w.score}%</span>
                        </div>
                        <div className="weakness-message">{w.message}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Suggestions */}
                {review.suggestions.length > 0 && (
                  <div className="review-section review-suggestions">
                    <h3>改进建议</h3>
                    {review.suggestions.map((s, i) => (
                      <div key={i} className="suggestion-item" style={{ borderLeftColor: PRIORITY_COLORS[s.priority] }}>
                        <div className="suggestion-header">
                          <span
                            className="priority-badge"
                            style={{ background: PRIORITY_COLORS[s.priority] }}
                          >
                            {PRIORITY_LABELS[s.priority]}
                          </span>
                          <span className="suggestion-category">{s.category} · {s.metric}</span>
                        </div>
                        <div className="suggestion-title">{s.title}</div>
                        <div className="suggestion-details">{s.details}</div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Trends Tab */}
        {activeTab === 'trends' && (
          <div className="review-trends">
            {!aggStats || aggStats.stats.total_sessions < 2 ? (
              <div className="review-empty">
                <h3>需要至少2场模拟数据才能展示趋势</h3>
                <p>当前已完成 {aggStats?.stats.total_sessions || 0} 场</p>
              </div>
            ) : (
              <>
                {/* Score Trend Chart */}
                <div className="trend-section">
                  <h3>分数趋势</h3>
                  <div className="trend-chart">
                    {aggStats.trends.map((t, idx) => {
                      const avg = Math.round((t.score_sales_overall + t.score_mm_overall) / 2);
                      return (
                        <div key={t.id} className="trend-point-col">
                          <div className="trend-bar-container">
                            <div
                              className="trend-bar sales"
                              style={{ height: `${t.score_sales_overall}%` }}
                              title={`Sales: ${Math.round(t.score_sales_overall)}%`}
                            />
                            <div
                              className="trend-bar mm"
                              style={{ height: `${t.score_mm_overall}%` }}
                              title={`MM: ${Math.round(t.score_mm_overall)}%`}
                            />
                          </div>
                          <div className="trend-avg">{avg}%</div>
                          <div className="trend-label">#{idx + 1}</div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="trend-legend">
                    <span><span className="legend-dot sales" /> Sales Trader</span>
                    <span><span className="legend-dot mm" /> Market Maker</span>
                  </div>
                </div>

                {/* Metric Averages */}
                <div className="trend-section">
                  <h3>各指标平均分</h3>
                  <div className="metric-avg-grid">
                    {[
                      { key: 'avg_cm', label: 'CM', value: aggStats.stats.avg_cm },
                      { key: 'avg_comm', label: 'COMM', value: aggStats.stats.avg_comm },
                      { key: 'avg_ct', label: 'CT', value: aggStats.stats.avg_ct },
                      { key: 'avg_ffc', label: 'FFC', value: aggStats.stats.avg_ffc },
                      { key: 'avg_eic', label: 'EIC', value: aggStats.stats.avg_eic },
                      { key: 'avg_etm', label: 'ETM', value: aggStats.stats.avg_etm },
                      { key: 'avg_pnl_score', label: 'PnL', value: aggStats.stats.avg_pnl_score },
                      { key: 'avg_prm', label: 'PRM', value: aggStats.stats.avg_prm },
                      { key: 'avg_ssrm', label: 'SSRM', value: aggStats.stats.avg_ssrm },
                    ].map(m => (
                      <div key={m.key} className="metric-avg-item">
                        <div className="metric-avg-bar-track">
                          <div
                            className="metric-avg-bar-fill"
                            style={{
                              width: `${Math.round(m.value)}%`,
                              background: m.value >= 60 ? '#5b7fb5' : m.value >= 40 ? '#f0b90b' : '#f23645',
                            }}
                          />
                        </div>
                        <div className="metric-avg-label">{m.label}</div>
                        <div className="metric-avg-value">{Math.round(m.value)}%</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* PnL Trend */}
                <div className="trend-section">
                  <h3>P&L趋势</h3>
                  <div className="pnl-trend-chart">
                    {aggStats.trends.map((t, idx) => {
                      const maxPnl = Math.max(...aggStats.trends.map(x => Math.abs(x.total_pnl)), 1);
                      const heightPct = (Math.abs(t.total_pnl) / maxPnl) * 50;
                      const isPositive = t.total_pnl >= 0;
                      return (
                        <div key={t.id} className="pnl-trend-col">
                          <div className="pnl-trend-bar-area">
                            {isPositive ? (
                              <div
                                className="pnl-trend-bar positive"
                                style={{ height: `${heightPct}%`, bottom: '50%' }}
                              />
                            ) : (
                              <div
                                className="pnl-trend-bar negative"
                                style={{ height: `${heightPct}%`, top: '50%' }}
                              />
                            )}
                            <div className="pnl-zero-line" />
                          </div>
                          <div className={`pnl-trend-value ${isPositive ? 'pnl-positive' : 'pnl-negative'}`}>
                            {formatPnl(t.total_pnl)}
                          </div>
                          <div className="trend-label">#{idx + 1}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReviewPage;
