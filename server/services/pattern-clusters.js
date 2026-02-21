import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export async function buildPatternClusters(games = []) {
  const safeGames = Array.isArray(games) ? games : [];
  try {
    const payload = await runPythonClusterBridge({ games: safeGames });
    if (Array.isArray(payload?.themes) && payload.themes.length > 0) return payload;
  } catch {
    // fallback below
  }
  return buildJsFallbackClusters(safeGames);
}

async function runPythonClusterBridge(requestBody) {
  const scriptPath = new URL('../python/pattern_cluster_bridge.py', import.meta.url);
  const { stdout } = await execFileAsync('python3', [scriptPath], {
    input: JSON.stringify(requestBody),
    timeout: 12000,
    maxBuffer: 1024 * 1024,
  });
  return JSON.parse(stdout);
}

function buildJsFallbackClusters(games) {
  const counters = {
    openingDiscipline: 0,
    tacticalAwareness: 0,
    endgameTechnique: 0,
  };

  for (const game of games) {
    const analysis = game?.analysis;
    if (!analysis) continue;
    if ((analysis.phases?.opening || 0) < 65) counters.openingDiscipline += 1;
    if ((analysis.inaccuracies || 0) + (analysis.mistakes || 0) > 3) counters.tacticalAwareness += 1;
    if ((analysis.phases?.endgame || 0) < 60) counters.endgameTechnique += 1;
  }

  const themes = Object.entries(counters)
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
    .map((entry) => ({
      theme: entry.key,
      frequency: games.length ? Math.round((entry.count / games.length) * 100) : 0,
      recommendation: recommendationFor(entry.key),
    }));

  return { themes, source: 'js-fallback' };
}

function recommendationFor(theme) {
  if (theme === 'openingDiscipline') return 'Use one opening family per color for 30 games.';
  if (theme === 'tacticalAwareness') return 'Add 10 daily tactical reps focused on forks/pins/skewers.';
  return 'Play technical endgames and prioritize king activity.';
}
