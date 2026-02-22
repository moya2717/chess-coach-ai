// ═══════════════════════════════════════════
// Game Analysis Service
// ═══════════════════════════════════════════

import { Chess } from 'chess.js';
import { apiGet, apiPost } from './api-client';

const ANALYSIS_JOB_POLL_MS = 1200;
const ANALYSIS_JOB_TIMEOUT_MS = 120000;

export async function analyzeGame(pgn, playerColor = 'white', engineMode = 'auto', options = {}) {
  const chess = new Chess();
  try {
    chess.loadPgn(pgn, { strict: false });
  } catch {
    throw new Error('Invalid PGN format');
  }

  const payload = {
    pgn,
    playerColor,
    cacheKey: buildAnalysisCacheKey({ pgn, headers: chess.header(), playerColor, engineMode }),
    engineMode,
    forceRefresh: Boolean(options.forceRefresh),
  };

  const useAsyncJob = shouldUseAsyncAnalysis(options);
  if (useAsyncJob) {
    try {
      return await analyzeGameViaJob(payload, options);
    } catch {
      // Fall back to synchronous endpoint for compatibility and local dev reliability.
    }
  }

  return apiPost('/api/analyze', payload, { timeout: 120000 });
}

async function analyzeGameViaJob(payload, options = {}) {
  const job = await apiPost('/api/analyze-jobs', {
    pgn: payload.pgn,
    playerColor: payload.playerColor,
    engineMode: payload.engineMode,
  }, { timeout: 15000 });

  if (!job?.id) {
    throw new Error('Analysis job did not return an id');
  }

  const timeoutMs = Number(options.jobTimeoutMs || ANALYSIS_JOB_TIMEOUT_MS);
  const pollMs = Number(options.jobPollMs || ANALYSIS_JOB_POLL_MS);
  return pollAnalysisJob(job.id, timeoutMs, pollMs);
}

async function pollAnalysisJob(jobId, timeoutMs, pollMs) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const job = await apiGet('/api/analyze-jobs', { id: jobId });
    if (job?.status === 'completed' && job.result) return job.result;
    if (job?.status === 'failed') throw new Error(job.error || 'Analysis job failed');
    await sleep(pollMs);
  }

  throw new Error('Analysis job timed out');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldUseAsyncAnalysis(options = {}) {
  if (typeof options.useAsyncJob === 'boolean') return options.useAsyncJob;
  return true;
}

export async function analyzePosition(fen, { engineMode = 'auto', maxPlies = 6, forceRefresh = false } = {}) {
  if (!fen) {
    throw new Error('FEN is required');
  }

  return apiPost('/api/analyze-position', {
    fen,
    engineMode,
    maxPlies,
    forceRefresh,
  }, { timeout: 45000 });
}

export function buildAnalysisCacheKey({ pgn, headers = {}, playerColor = 'white', engineMode = 'auto' }) {
  const idSeed = headers.Site || headers.Link || headers.UTCDate || headers.Date || headers.Event || '';
  const canonicalSeed = idSeed ? `${idSeed}:${playerColor}:${engineMode}` : `${playerColor}:${engineMode}`;
  return `${canonicalSeed}:${hashString(pgn)}`;
}

/**
 * Detect patterns across multiple analyzed games
 *
 * This is the "pattern recognition" engine — it looks at ALL your games
 * and finds recurring themes. Like a coach watching 20 of your games
 * and saying "I keep seeing the same problem over and over."
 *
 * @param {Array} games - Array of games with analysis
 * @param {string} playerColor - Not used currently (both colors analyzed)
 * @returns {Array} Detected patterns sorted by severity
 */
export function detectPatterns(games) {
  const patterns = [];
  const analyzedGames = games.filter(g => g.analysis && g.analysis.moves?.length > 0);

  if (analyzedGames.length === 0) return [];

  // Pattern: Hanging pieces (blunders that lose material)
  const gamesWithBlunders = analyzedGames.filter(g => g.analysis.blunders > 0);
  if (gamesWithBlunders.length > 0) {
    const frequency = Math.round((gamesWithBlunders.length / analyzedGames.length) * 100);
    patterns.push({
      name: 'Hanging Pieces',
      icon: '🔴',
      severity: frequency > 50 ? 'critical' : 'moderate',
      frequency,
      description: `In ${frequency}% of your games, you left pieces undefended — leading to blunders. Think of it like leaving valuables on the table: if they're not protected, someone will grab them.`,
      coaching: `Before every move, do a quick "safety scan": look at all your pieces and ask "if my opponent attacks this right now, is it defended?" This 5-second habit prevents most piece losses.`,
      puzzleTheme: 'hangingPiece',
    });
  }

  // Pattern: Weak endgame
  const avgEndgame = avg(analyzedGames.map(g => g.analysis.phases.endgame));
  const avgMiddlegame = avg(analyzedGames.map(g => g.analysis.phases.middlegame));
  if (avgEndgame < avgMiddlegame - 10) {
    patterns.push({
      name: 'Weak Endgame Technique',
      icon: '🔴',
      severity: avgEndgame < 50 ? 'critical' : 'moderate',
      frequency: Math.round(100 - avgEndgame),
      description: `Your endgame accuracy is ${Math.round(avgEndgame)}%, significantly lower than your middlegame (${Math.round(avgMiddlegame)}%). It's like running a strong race but stumbling in the final stretch.`,
      coaching: `Focus on two things: 1) Push your King to the center in endgames (it becomes a fighting piece). 2) Create passed pawns — a pawn with no enemies blocking its promotion path is your most powerful weapon.`,
      puzzleTheme: 'endgame',
    });
  }

  // Pattern: Opening problems
  const avgOpening = avg(analyzedGames.map(g => g.analysis.phases.opening));
  if (avgOpening < 70) {
    patterns.push({
      name: 'Opening Preparation Gaps',
      icon: '🟠',
      severity: 'moderate',
      frequency: Math.round(100 - avgOpening),
      description: `Your opening accuracy is ${Math.round(avgOpening)}%. You may be deviating from known theory too early. Think of openings like a GPS route — follow the proven path until you know the territory well enough to go off-road.`,
      coaching: `Pick one opening as White and one as Black. Play them exclusively for 30+ games. You'll start to recognize recurring patterns and plans naturally.`,
      puzzleTheme: 'opening',
    });
  }

  // Pattern: Tactical blindness (missed forks, pins, etc.)
  const totalInaccuracies = analyzedGames.reduce((s, g) => s + g.analysis.inaccuracies, 0);
  const gamesCount = analyzedGames.length;
  if (totalInaccuracies / gamesCount > 2) {
    patterns.push({
      name: 'Missed Tactical Opportunities',
      icon: '🟡',
      severity: 'moderate',
      frequency: Math.min(80, Math.round((totalInaccuracies / gamesCount) * 15)),
      description: `You average ${(totalInaccuracies / gamesCount).toFixed(1)} inaccuracies per game. Many of these are missed tactical shots — like a soccer player who gets into scoring position but doesn't shoot.`,
      coaching: `Practice tactical puzzles daily — even just 10 minutes. Focus on recognizing forks (one piece attacking two targets), pins (a piece stuck in front of a more valuable one), and skewers (attacking through a piece to one behind it).`,
      puzzleTheme: 'short',
    });
  }

  // Sort by severity (critical first) then by frequency
  return patterns.sort((a, b) => {
    if (a.severity === 'critical' && b.severity !== 'critical') return -1;
    if (a.severity !== 'critical' && b.severity === 'critical') return 1;
    return b.frequency - a.frequency;
  });
}

// ─── Helpers ───
function avg(arr) {
  if (arr.length === 0) return 0;
  return Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
}

function hashString(value = '') {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}
