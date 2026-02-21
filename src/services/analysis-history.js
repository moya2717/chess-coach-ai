import { apiGet, apiPost } from './api-client';

const STORAGE_KEY = 'chesscoach.analysisRuns.v1';

export async function listAnalysisRuns(userId) {
  if (!userId) return [];
  try {
    const runs = await apiGet('/api/analysis-runs', { userId });
    return Array.isArray(runs) ? runs : [];
  } catch {
    return readRuns()
      .filter((run) => run.userId === userId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }
}

export async function recordAnalysisRun({ userId, usernames, games, patterns }) {
  const payload = { userId, usernames, games, patterns };
  try {
    return await apiPost('/api/analysis-runs', payload);
  } catch {
    const run = {
      id: `${userId}-${Date.now()}`,
      userId,
      usernames,
      metrics: buildMetrics(games, patterns),
      createdAt: new Date().toISOString(),
    };
    const nextRuns = [...readRuns(), run].slice(-500);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextRuns));
    return run;
  }
}

function buildMetrics(games, patterns) {
  const totalGames = games.length || 1;
  const phaseTotals = games.reduce(
    (sum, game) => ({
      opening: sum.opening + (game.analysis?.phases?.opening || 0),
      middlegame: sum.middlegame + (game.analysis?.phases?.middlegame || 0),
      endgame: sum.endgame + (game.analysis?.phases?.endgame || 0),
    }),
    { opening: 0, middlegame: 0, endgame: 0 },
  );

  return {
    accuracy: round(games.reduce((sum, game) => sum + (game.analysis?.accuracy || 0), 0) / totalGames),
    blundersPerGame: round(games.reduce((sum, game) => sum + (game.analysis?.blunders || 0), 0) / totalGames),
    phaseWeakness: {
      opening: round(100 - phaseTotals.opening / totalGames),
      middlegame: round(100 - phaseTotals.middlegame / totalGames),
      endgame: round(100 - phaseTotals.endgame / totalGames),
    },
    criticalPatterns: patterns.filter((p) => p.severity === 'critical').length,
    totalGames: games.length,
  };
}

function readRuns() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function round(value) {
  return Math.round(value * 10) / 10;
}
