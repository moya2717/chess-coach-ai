import { URL } from 'node:url';
import { TTLCache } from './lib/cache.js';
import { normalizeUnknownError } from './lib/errors.js';
import { fetchChesscomRecentGames, fetchChesscomProfile, fetchChesscomStats } from './providers/chesscom-provider.js';
import { fetchLichessRecentGames, fetchLichessPuzzles, fetchLichessProfile } from './providers/lichess-provider.js';
import { analyzeGameWithEngine, analyzePositionWithContext } from './providers/analysis-provider.js';
import {
  getPuzzleProgress,
  buildFallbackPuzzle,
  buildPersonalizedPuzzlePlan,
  normalizePuzzlePayload,
  recordPuzzleAttempt,
  resolvePuzzleTheme,
} from './services/puzzle-service.js';
import { enqueueAnalysisJob, getAnalysisJob } from './services/analysis-jobs.js';
import { buildMoveCoachExplanation } from './services/coach-explanations.js';
import { buildPatternClusters } from './services/pattern-clusters.js';
import { createPersistedAnalysisRun, listPersistedAnalysisRuns } from './services/analysis-runs-store.js';

const gameCache = new TTLCache(3 * 60_000);
const evalCache = new TTLCache(5 * 60_000);

export function createHandler() {
  return async function handler(req, res) {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (req.method === 'GET' && url.pathname === '/api/games') return handleGames(url, res);
      if (req.method === 'GET' && url.pathname === '/api/profile') return handleProfile(url, res);
      if (req.method === 'GET' && url.pathname === '/api/stats') return handleStats(url, res);
      if (req.method === 'POST' && url.pathname === '/api/analyze') return handleAnalyze(req, res);
      if (req.method === 'POST' && url.pathname === '/api/analyze-jobs') return handleAnalyzeJobsCreate(req, res);
      if (req.method === 'GET' && url.pathname === '/api/analyze-jobs') return handleAnalyzeJobsStatus(url, res);
      if (req.method === 'POST' && url.pathname === '/api/analyze-position') return handleAnalyzePosition(req, res);
      if (req.method === 'GET' && url.pathname === '/api/puzzle') return handlePuzzle(url, res);
      if (req.method === 'GET' && url.pathname === '/api/puzzle-progress') return handlePuzzleProgress(url, res);
      if (req.method === 'POST' && url.pathname === '/api/puzzle-progress') return handlePuzzleProgressUpdate(req, res);
      if (req.method === 'POST' && url.pathname === '/api/puzzle-plan') return handlePuzzlePlan(req, res);
      if (req.method === 'POST' && url.pathname === '/api/coach-explain') return handleCoachExplain(req, res);
      if (req.method === 'POST' && url.pathname === '/api/pattern-clusters') return handlePatternClusters(req, res);
      if (req.method === 'GET' && url.pathname === '/api/analysis-runs') return handleAnalysisRunsList(url, res);
      if (req.method === 'POST' && url.pathname === '/api/analysis-runs') return handleAnalysisRunsCreate(req, res);
      return sendJson(res, 404, { code: 'NOT_FOUND', message: 'Route not found', retryable: false });
    } catch (error) {
      const normalized = normalizeUnknownError(error);
      return sendJson(res, normalized.status, {
        code: normalized.code,
        message: normalized.message,
        retryable: normalized.retryable,
      });
    }
  };
}


async function handleProfile(url, res) {
  const username = (url.searchParams.get('username') || '').trim();
  const platform = (url.searchParams.get('platform') || '').trim();
  if (!username || !platform) {
    return sendJson(res, 400, { code: 'VALIDATION_ERROR', message: 'username and platform are required', retryable: false });
  }
  if (platform === 'chess.com') return sendJson(res, 200, await fetchChesscomProfile(username));
  if (platform === 'lichess') return sendJson(res, 200, await fetchLichessProfile(username));
  return sendJson(res, 400, { code: 'VALIDATION_ERROR', message: 'unsupported platform', retryable: false });
}

async function handleStats(url, res) {
  const username = (url.searchParams.get('username') || '').trim();
  const platform = (url.searchParams.get('platform') || '').trim();
  if (!username || platform !== 'chess.com') {
    return sendJson(res, 400, { code: 'VALIDATION_ERROR', message: 'chess.com username is required', retryable: false });
  }
  return sendJson(res, 200, await fetchChesscomStats(username));
}

async function handleGames(url, res) {
  const username = (url.searchParams.get('username') || '').trim();
  const platform = (url.searchParams.get('platform') || '').trim();
  const count = Number(url.searchParams.get('count') || 20);
  const dateFrom = url.searchParams.get('dateFrom') || '';
  const dateTo = url.searchParams.get('dateTo') || '';

  if (!username || !platform) {
    return sendJson(res, 400, { code: 'VALIDATION_ERROR', message: 'username and platform are required', retryable: false });
  }

  const cacheKey = `games:${platform}:${username}:${dateFrom}:${dateTo}:${count}`;
  const games = await gameCache.getOrSet(cacheKey, async () => {
    if (platform === 'chess.com') return fetchChesscomRecentGames(username, count);
    if (platform === 'lichess') return fetchLichessRecentGames(username, count);
    return [];
  });

  return sendJson(res, 200, filterByDate(games, dateFrom, dateTo));
}

async function handleAnalyze(req, res) {
  const body = await readJsonBody(req);
  const { pgn, playerColor = 'white', cacheKey = '', engineMode = 'auto', forceRefresh = false } = body;

  if (!pgn) {
    return sendJson(res, 400, { code: 'VALIDATION_ERROR', message: 'pgn is required', retryable: false });
  }

  if (forceRefresh) {
    const fresh = await analyzeGameWithEngine(pgn, playerColor, engineMode, { bypassCooldown: true });
    return sendJson(res, 200, fresh);
  }

  const key = createAnalysisCacheKey({ pgn, playerColor, engineMode, cacheKey });
  const analysis = await evalCache.getOrSet(key, () => analyzeGameWithEngine(pgn, playerColor, engineMode));
  return sendJson(res, 200, analysis);
}





async function handleAnalyzeJobsCreate(req, res) {
  const body = await readJsonBody(req);
  if (!body.pgn) {
    return sendJson(res, 400, { code: 'VALIDATION_ERROR', message: 'pgn is required', retryable: false });
  }

  const job = enqueueAnalysisJob({
    pgn: body.pgn,
    playerColor: body.playerColor || 'white',
    engineMode: body.engineMode || 'auto',
  });
  return sendJson(res, 202, job);
}

function handleAnalyzeJobsStatus(url, res) {
  const id = (url.searchParams.get('id') || '').trim();
  if (!id) {
    return sendJson(res, 400, { code: 'VALIDATION_ERROR', message: 'id is required', retryable: false });
  }

  const job = getAnalysisJob(id);
  if (!job) {
    return sendJson(res, 404, { code: 'NOT_FOUND', message: 'analysis job not found', retryable: false });
  }

  return sendJson(res, 200, job);
}

async function handleCoachExplain(req, res) {
  const body = await readJsonBody(req);
  const explanation = buildMoveCoachExplanation(body);
  return sendJson(res, 200, explanation);
}

async function handlePatternClusters(req, res) {
  const body = await readJsonBody(req);
  const payload = await buildPatternClusters(body.games || []);
  return sendJson(res, 200, payload);
}
async function handleAnalyzePosition(req, res) {
  const body = await readJsonBody(req);
  const {
    fen,
    engineMode = 'auto',
    maxPlies = 6,
    forceRefresh = false,
  } = body;

  if (!fen) {
    return sendJson(res, 400, { code: 'VALIDATION_ERROR', message: 'fen is required', retryable: false });
  }

  const analysis = await analyzePositionWithContext(fen, engineMode, {
    maxPlies,
    bypassCooldown: Boolean(forceRefresh),
  });
  return sendJson(res, 200, analysis);
}

export function createAnalysisCacheKey({ pgn, playerColor = 'white', engineMode = 'auto', cacheKey = '' }) {
  const pgnHash = hashString(pgn);
  const safeCacheKey = cacheKey || pgn.slice(0, 64);
  return `analysis:${safeCacheKey}:${playerColor}:${engineMode}:${pgnHash}`;
}

async function handlePuzzle(url, res) {
  const mappedTheme = resolvePuzzleTheme(url.searchParams.get('theme') || 'short');
  try {
    const [payload] = await fetchLichessPuzzles(mappedTheme, 1);
    if (!payload) return sendJson(res, 200, buildFallbackPuzzle(mappedTheme));
    return sendJson(res, 200, normalizePuzzlePayload(payload));
  } catch {
    return sendJson(res, 200, buildFallbackPuzzle(mappedTheme));
  }
}


async function handlePuzzlePlan(req, res) {
  const body = await readJsonBody(req);
  const games = Array.isArray(body.games) ? body.games : [];
  const patterns = Array.isArray(body.patterns) ? body.patterns : [];
  const plan = buildPersonalizedPuzzlePlan({ games, patterns });
  return sendJson(res, 200, plan);
}

function handlePuzzleProgress(url, res) {
  const userKey = (url.searchParams.get('userKey') || 'guest').trim();
  const pattern = (url.searchParams.get('pattern') || 'short').trim();
  return sendJson(res, 200, getPuzzleProgress(userKey, pattern));
}

async function handlePuzzleProgressUpdate(req, res) {
  const body = await readJsonBody(req);
  const userKey = (body.userKey || 'guest').trim();
  const pattern = (body.pattern || 'short').trim();
  const solved = Boolean(body.solved);
  const tries = Number(body.tries || 1);
  const timeSpent = Number(body.timeSpent || 0);
  const progress = recordPuzzleAttempt({ userKey, pattern, solved, tries, timeSpent });
  return sendJson(res, 200, progress);
}



function handleAnalysisRunsList(url, res) {
  const userId = (url.searchParams.get('userId') || '').trim();
  if (!userId) {
    return sendJson(res, 400, { code: 'VALIDATION_ERROR', message: 'userId is required', retryable: false });
  }

  return listPersistedAnalysisRuns(userId)
    .then((runs) => sendJson(res, 200, runs))
    .catch(() => sendJson(res, 500, { code: 'INTERNAL_ERROR', message: 'Could not load analysis runs', retryable: true }));
}

async function handleAnalysisRunsCreate(req, res) {
  const body = await readJsonBody(req);
  const userId = (body.userId || '').trim();
  if (!userId) {
    return sendJson(res, 400, { code: 'VALIDATION_ERROR', message: 'userId is required', retryable: false });
  }

  const run = await createPersistedAnalysisRun({
    userId,
    usernames: body.usernames || {},
    games: Array.isArray(body.games) ? body.games : [],
    patterns: Array.isArray(body.patterns) ? body.patterns : [],
  });
  return sendJson(res, 201, run);
}
function filterByDate(games, dateFrom, dateTo) {
  if (!dateFrom && !dateTo) return games;
  return games.filter((game) => {
    if (dateFrom && game.date < dateFrom) return false;
    if (dateTo && game.date > dateTo) return false;
    return true;
  });
}

function hashString(value = '') {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

function sendJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk.toString();
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('Invalid JSON payload'));
      }
    });
    req.on('error', reject);
  });
}
