import { useMemo, useState } from 'react';
import { buildTrendSeries, computeDeltaSummary, formatDelta } from '../services/dashboard-metrics';

const TREND_METRICS = {
  accuracy: { title: 'Accuracy Over Time', unit: '%' },
  blundersPerGame: { title: 'Blunders Per Game', unit: '' },
  endgameWeakness: { title: 'Endgame Weakness (Lower is Better)', unit: '%' },
};

export default function Dashboard({
  games,
  patterns,
  analysisRuns = [],
  puzzleProgressByPattern,
  onSelectGame,
  onNavigateToPuzzles,
}) {
  const [trendMetric, setTrendMetric] = useState('accuracy');
  const [resultFilter, setResultFilter] = useState('all');
  const totalGames = games.length;
  const deeplyAnalyzedGames = games.filter((game) => game.analysis?.moves?.length > 0);
  const wins = games.filter((g) => g.result === 'win').length;
  const losses = games.filter((g) => g.result === 'loss').length;
  const draws = games.filter((g) => g.result === 'draw').length;
  const avgAccuracy = averageFromGames(deeplyAnalyzedGames, (g) => g.analysis?.accuracy || 0);
  const totalBlunders = deeplyAnalyzedGames.reduce((sum, g) => sum + (g.analysis?.blunders || 0), 0);
  const avgEndgame = averageFromGames(deeplyAnalyzedGames, (g) => g.analysis?.phases?.endgame || 0);
  const aggregatePuzzleProgress = summarizePuzzleProgress(puzzleProgressByPattern);
  const trendSeries = buildTrendSeries(analysisRuns);
  const deltas = computeDeltaSummary(analysisRuns);
  const filteredGames = useMemo(() => {
    if (resultFilter === 'all') return games;
    return games.filter((game) => game.result === resultFilter);
  }, [games, resultFilter]);

  const colorForAccuracy = (val) =>
    val > 70 ? 'var(--accent-green)' : val > 55 ? 'var(--accent-amber)' : 'var(--accent-red)';

  return (
    <div className="dashboard">
      <div className="stat-cards">
        <div className="stat-card animate-in delay-1">
          <div className="stat-label">Games Analyzed</div>
          <div className="stat-value">{totalGames}</div>
          <div className="stat-detail">{wins}W / {draws}D / {losses}L · {deeplyAnalyzedGames.length} deep</div>
        </div>
        <div className="stat-card animate-in delay-2">
          <div className="stat-label">Average Accuracy</div>
          <div className="stat-value" style={{ color: colorForAccuracy(avgAccuracy) }}>{avgAccuracy}%</div>
          <div className="stat-detail">Target: 75%+ for your rating</div>
        </div>
        <div className="stat-card animate-in delay-3">
          <div className="stat-label">Total Blunders</div>
          <div className="stat-value" style={{ color: 'var(--accent-red)' }}>{totalBlunders}</div>
          <div className="stat-detail">{totalGames > 0 ? (totalBlunders / totalGames).toFixed(1) : 0} per game avg</div>
        </div>
        <div className="stat-card animate-in delay-4">
          <div className="stat-label">Endgame Accuracy</div>
          <div className="stat-value" style={{ color: colorForAccuracy(avgEndgame) }}>{avgEndgame}%</div>
          <div className="stat-detail">{avgEndgame < 60 ? 'Needs work — your weakest phase' : 'Solid endgame play'}</div>
        </div>
      </div>

      <div className="stat-cards" style={{ marginTop: 16 }}>
        <Widget title="Puzzle Completed" value={aggregatePuzzleProgress.completedCount} detail="Theme-targeted solves" />
        <Widget title="Puzzle Streak" value={aggregatePuzzleProgress.streak} detail={`Best: ${aggregatePuzzleProgress.bestStreak}`} />
        <Widget title="Puzzle Accuracy" value={`${aggregatePuzzleProgress.accuracy}%`} detail={`${aggregatePuzzleProgress.attempts} attempts`} />
      </div>

      <div className="panel animate-in delay-1">
        <div className="panel-header"><h3>📈 Analysis Trends</h3></div>
        {trendSeries.length === 0 ? (
          <div className="pattern-desc">Run analysis multiple times to unlock trend charts.</div>
        ) : (
          <>
            <div className="stat-cards" style={{ marginBottom: 12 }}>
              <DeltaCard label="Accuracy" value={formatDelta(deltas.accuracy, '%')} positiveGood />
              <DeltaCard label="Blunders / game" value={formatDelta(deltas.blundersPerGame, '')} positiveGood={false} />
              <DeltaCard label="Opening weakness" value={formatDelta(deltas.openingWeakness, '%')} positiveGood={false} />
              <DeltaCard label="Endgame weakness" value={formatDelta(deltas.endgameWeakness, '%')} positiveGood={false} />
            </div>
            <div className="dashboard-controls">
              {Object.entries(TREND_METRICS).map(([key, metric]) => (
                <button
                  key={key}
                  type="button"
                  className={`dashboard-toggle ${trendMetric === key ? 'active' : ''}`}
                  onClick={() => setTrendMetric(key)}
                >
                  {metric.title}
                </button>
              ))}
            </div>
            <TrendChart
              title={TREND_METRICS[trendMetric].title}
              data={trendSeries}
              dataKey={trendMetric}
              unit={TREND_METRICS[trendMetric].unit}
            />
          </>
        )}
      </div>

      <div className="panel animate-in delay-2">
        <div className="panel-header">
          <h3>🎯 Detected Patterns</h3>
          <span className="badge badge-red">{patterns.filter((p) => p.severity === 'critical').length} Critical</span>
        </div>
        {patterns.map((p, i) => (
          <div key={i} className="pattern-item" onClick={() => onNavigateToPuzzles(p)}>
            <div className="pattern-name">
              {p.icon} {p.name}
              {p.frequency > 0 && (
                <span className={`badge ${p.severity === 'critical' ? 'badge-red' : 'badge-amber'}`} style={{ fontSize: 10 }}>
                  {p.frequency}% of games
                </span>
              )}
            </div>
            <div className="pattern-desc">{p.description}</div>
            {p.frequency > 0 && (
              <div className="pattern-bar">
                <div
                  className="pattern-bar-fill"
                  style={{
                    width: `${p.frequency}%`,
                    background: p.severity === 'critical' ? 'var(--accent-red)' : 'var(--accent-amber)',
                  }}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="panel animate-in delay-3">
        <div className="panel-header">
          <h3>📋 Recent Games</h3>
          <span className="badge badge-blue">{filteredGames.length} shown</span>
        </div>
        <div className="dashboard-controls" style={{ padding: '10px 16px' }}>
          {['all', 'win', 'draw', 'loss'].map((result) => (
            <button
              key={result}
              type="button"
              className={`dashboard-toggle ${resultFilter === result ? 'active' : ''}`}
              onClick={() => setResultFilter(result)}
            >
              {result === 'all' ? 'All Results' : result.toUpperCase()}
            </button>
          ))}
        </div>
        {filteredGames.map((game) => (
          <div key={game.id} className="game-item" onClick={() => onSelectGame(game)}>
            <div className="game-info">
              <span className="opponent">vs {game.opponent} ({game.opponentRating})</span>
              <span className="game-meta">{game.opening} · {game.timeControl} · {game.platform} · {formatGameAnalysisStatus(game.analysis)}</span>
            </div>
            <span className={`game-result ${game.result === 'win' ? 'result-win' : game.result === 'loss' ? 'result-loss' : 'result-draw'}`}>
              {game.result.toUpperCase()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TrendChart({ title, data, dataKey, unit = '' }) {
  const values = data.map((item) => item[dataKey]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * 100;
      const y = 100 - ((value - min) / range) * 100;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <div style={{ marginBottom: 14 }}>
      <div className="stat-label" style={{ marginBottom: 6 }}>{title}</div>
      <svg viewBox="0 0 100 100" width="100%" height="80" role="img" aria-label={title}>
        <polyline fill="none" stroke="var(--accent-blue)" strokeWidth="2" points={points} />
      </svg>
      <div className="stat-detail">Latest: {values[values.length - 1]}{unit}</div>
    </div>
  );
}

function DeltaCard({ label, value, positiveGood = true }) {
  const good = value.startsWith('+') ? positiveGood : !positiveGood;
  const color = value === 'N/A' ? 'var(--text-secondary)' : good ? 'var(--accent-green)' : 'var(--accent-red)';
  return <Widget title={label} value={value} detail="Last 30d vs previous 30d" valueColor={color} />;
}

function Widget({ title, value, detail, valueColor }) {
  return (
    <div className="stat-card animate-in">
      <div className="stat-label">{title}</div>
      <div className="stat-value" style={{ color: valueColor }}>{value}</div>
      <div className="stat-detail">{detail}</div>
    </div>
  );
}

function summarizePuzzleProgress(progressByPattern = {}) {
  const values = Object.values(progressByPattern);
  if (values.length === 0) {
    return { completedCount: 0, streak: 0, bestStreak: 0, accuracy: 0, attempts: 0 };
  }

  const aggregate = values.reduce((sum, entry) => ({
    completedCount: sum.completedCount + (entry.completedCount || 0),
    attempts: sum.attempts + (entry.attempts || 0),
    streak: Math.max(sum.streak, entry.streak || 0),
    bestStreak: Math.max(sum.bestStreak, entry.bestStreak || 0),
  }), { completedCount: 0, attempts: 0, streak: 0, bestStreak: 0 });

  return {
    ...aggregate,
    accuracy: aggregate.attempts > 0 ? Math.round((aggregate.completedCount / aggregate.attempts) * 100) : 0,
  };
}

function formatGameAnalysisStatus(analysis) {
  if (!analysis) return 'Pending analysis';
  if (analysis.unavailable || !analysis.moves?.length) return 'Analysis unavailable';
  return `Accuracy: ${analysis.accuracy || 0}%`;
}

function averageFromGames(games, selector) {
  if (games.length === 0) {
    return 0;
  }
  const total = games.reduce((sum, game) => sum + selector(game), 0);
  return Math.round(total / games.length);
}
