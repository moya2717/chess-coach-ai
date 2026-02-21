import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const MAX_RUNS = 500;
const DEFAULT_FILE = path.resolve(process.cwd(), '.data', 'analysis-runs.json');

export async function listPersistedAnalysisRuns(userId) {
  if (!userId) return [];
  const allRuns = await readRuns();
  return allRuns
    .filter((run) => run.userId === userId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export async function createPersistedAnalysisRun({ userId, usernames = {}, games = [], patterns = [] }) {
  if (!userId) {
    throw new Error('userId is required');
  }

  const metrics = buildMetrics(games, patterns);
  const run = {
    id: `${userId}-${Date.now()}`,
    userId,
    usernames,
    metrics,
    createdAt: new Date().toISOString(),
  };

  const allRuns = await readRuns();
  const nextRuns = [...allRuns, run].slice(-MAX_RUNS);
  await writeRuns(nextRuns);
  return run;
}

function buildMetrics(games, patterns) {
  const totalGames = games.length || 1;
  const phaseTotals = games.reduce((sum, game) => ({
    opening: sum.opening + (game.analysis?.phases?.opening || 0),
    middlegame: sum.middlegame + (game.analysis?.phases?.middlegame || 0),
    endgame: sum.endgame + (game.analysis?.phases?.endgame || 0),
  }), { opening: 0, middlegame: 0, endgame: 0 });

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

async function readRuns() {
  const filePath = resolveStorePath();
  try {
    const raw = await readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeRuns(runs) {
  const filePath = resolveStorePath();
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(runs), 'utf8');
}

function resolveStorePath() {
  return process.env.ANALYSIS_RUNS_FILE || DEFAULT_FILE;
}

function round(value) {
  return Math.round(value * 10) / 10;
}
