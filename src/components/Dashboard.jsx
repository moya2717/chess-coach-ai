export default function Dashboard({
  games,
  patterns,
  puzzleProgressByPattern,
  onSelectGame,
  onNavigateToPuzzles,
}) {
  const totalGames = games.length;
  const wins = games.filter(g => g.result === 'win').length;
  const losses = games.filter(g => g.result === 'loss').length;
  const draws = games.filter(g => g.result === 'draw').length;
  const avgAccuracy = totalGames > 0
    ? Math.round(games.reduce((sum, g) => sum + (g.analysis?.accuracy || 0), 0) / totalGames)
    : 0;
  const totalBlunders = games.reduce((sum, g) => sum + (g.analysis?.blunders || 0), 0);
  const avgEndgame = totalGames > 0
    ? Math.round(games.reduce((sum, g) => sum + (g.analysis?.phases?.endgame || 0), 0) / totalGames)
    : 0;
  const aggregatePuzzleProgress = summarizePuzzleProgress(puzzleProgressByPattern);

  const colorForAccuracy = (val) =>
    val > 70 ? 'var(--accent-green)' : val > 55 ? 'var(--accent-amber)' : 'var(--accent-red)';

  return (
    <div className="dashboard">
      <div className="stat-cards">
        <div className="stat-card animate-in delay-1">
          <div className="stat-label">Games Analyzed</div>
          <div className="stat-value">{totalGames}</div>
          <div className="stat-detail">{wins}W / {draws}D / {losses}L</div>
        </div>
        <div className="stat-card animate-in delay-2">
          <div className="stat-label">Average Accuracy</div>
          <div className="stat-value" style={{ color: colorForAccuracy(avgAccuracy) }}>
            {avgAccuracy}%
          </div>
          <div className="stat-detail">Target: 75%+ for your rating</div>
        </div>
        <div className="stat-card animate-in delay-3">
          <div className="stat-label">Total Blunders</div>
          <div className="stat-value" style={{ color: 'var(--accent-red)' }}>{totalBlunders}</div>
          <div className="stat-detail">
            {totalGames > 0 ? (totalBlunders / totalGames).toFixed(1) : 0} per game avg
          </div>
        </div>
        <div className="stat-card animate-in delay-4">
          <div className="stat-label">Endgame Accuracy</div>
          <div className="stat-value" style={{ color: colorForAccuracy(avgEndgame) }}>
            {avgEndgame}%
          </div>
          <div className="stat-detail">
            {avgEndgame < 60 ? 'Needs work — your weakest phase' : 'Solid endgame play'}
          </div>
        </div>
      </div>

      <div className="stat-cards" style={{ marginTop: 16 }}>
        <Widget title="Puzzle Completed" value={aggregatePuzzleProgress.completedCount} detail="Theme-targeted solves" />
        <Widget title="Puzzle Streak" value={aggregatePuzzleProgress.streak} detail={`Best: ${aggregatePuzzleProgress.bestStreak}`} />
        <Widget title="Puzzle Accuracy" value={`${aggregatePuzzleProgress.accuracy}%`} detail={`${aggregatePuzzleProgress.attempts} attempts`} />
      </div>

      <div className="panel animate-in delay-2">
        <div className="panel-header">
          <h3>🎯 Detected Patterns</h3>
          <span className="badge badge-red">
            {patterns.filter(p => p.severity === 'critical').length} Critical
          </span>
        </div>
        {patterns.map((p, i) => (
          <div key={i} className="pattern-item" onClick={() => onNavigateToPuzzles(p)}>
            <div className="pattern-name">
              {p.icon} {p.name}
              {p.frequency > 0 && (
                <span
                  className={`badge ${p.severity === 'critical' ? 'badge-red' : 'badge-amber'}`}
                  style={{ fontSize: 10 }}
                >
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
          <span className="badge badge-blue">{totalGames} games</span>
        </div>
        {games.map((game) => (
          <div key={game.id} className="game-item" onClick={() => onSelectGame(game)}>
            <div className="game-info">
              <span className="opponent">
                vs {game.opponent} ({game.opponentRating})
              </span>
              <span className="game-meta">
                {game.opening} · {game.timeControl} · {game.platform} · Accuracy:{' '}
                {game.analysis?.accuracy || '?'}%
              </span>
            </div>
            <span
              className={`game-result ${
                game.result === 'win' ? 'result-win' :
                game.result === 'loss' ? 'result-loss' : 'result-draw'
              }`}
            >
              {game.result.toUpperCase()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Widget({ title, value, detail }) {
  return (
    <div className="stat-card animate-in">
      <div className="stat-label">{title}</div>
      <div className="stat-value">{value}</div>
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
