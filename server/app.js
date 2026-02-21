import { URL } from 'node:url';
import { TTLCache } from './lib/cache.js';
import { normalizeUnknownError } from './lib/errors.js';
import { fetchChesscomRecentGames, fetchChesscomProfile, fetchChesscomStats } from './providers/chesscom-provider.js';
import { fetchLichessRecentGames, fetchLichessPuzzles, fetchLichessProfile } from './providers/lichess-provider.js';
import { analyzeGameWithEngine } from './providers/analysis-provider.js';
import {
  getPuzzleProgress,
  normalizePuzzlePayload,
  recordPuzzleAttempt,
  resolvePuzzleTheme,
} from './services/puzzle-service.js';

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
      if (req.method === 'GET' && url.pathname === '/api/puzzle') return handlePuzzle(url, res);
      if (req.method === 'GET' && url.pathname === '/api/puzzle-progress') return handlePuzzleProgress(url, res);
      if (req.method === 'POST' && url.pathname === '/api/puzzle-progress') return handlePuzzleProgressUpdate(req, res);
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
  const { pgn, playerColor = 'white', cacheKey = '', engineMode = 'auto' } = body;

  if (!pgn) {
    return sendJson(res, 400, { code: 'VALIDATION_ERROR', message: 'pgn is required', retryable: false });
  }

  const key = `analysis:${cacheKey || pgn.slice(0, 64)}:${playerColor}:${engineMode}`;
  const analysis = await evalCache.getOrSet(key, () => analyzeGameWithEngine(pgn, playerColor, engineMode));
  return sendJson(res, 200, analysis);
}

async function handlePuzzle(url, res) {
  const mappedTheme = resolvePuzzleTheme(url.searchParams.get('theme') || 'short');
  const [payload] = await fetchLichessPuzzles(mappedTheme, 1);
  return sendJson(res, 200, normalizePuzzlePayload(payload));
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

function filterByDate(games, dateFrom, dateTo) {
  if (!dateFrom && !dateTo) return games;
  return games.filter((game) => {
    if (dateFrom && game.date < dateFrom) return false;
    if (dateTo && game.date > dateTo) return false;
    return true;
  });
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
