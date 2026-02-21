import { ApiError } from '../lib/errors.js';
import { requestWithRetry } from '../lib/http-client.js';

const BASE_URL = 'https://lichess.org/api';
const INCLUDED_SPEEDS = new Set(['rapid', 'blitz', 'bullet', 'classical', 'correspondence']);

export async function fetchLichessProfile(username) {
  try {
    return await requestWithRetry(`${BASE_URL}/user/${username}`);
  } catch (error) {
    if (error.status === 404) {
      throw new ApiError({ code: 'USER_NOT_FOUND', message: `Lichess user "${username}" not found`, retryable: false, status: 404 });
    }
    throw error;
  }
}


export async function fetchLichessRecentGames(username, count = 20) {
  try {
    const text = await requestWithRetry(`${BASE_URL}/games/user/${username}`, {
      params: {
        max: count,
        rated: true,
        evals: true,
        opening: true,
        pgnInJson: true,
        clocks: true,
      },
      headers: { Accept: 'application/x-ndjson' },
      responseType: 'text',
      timeoutMs: 12_000,
    });

    return parseNdjson(text)
      .filter(isIncludedLichessGame)
      .map((game, index) => processLichessGame(game, username, index))
      .filter((game) => !isCoachGame(game));
  } catch (error) {
    if (error.status === 404) {
      throw new ApiError({
        code: 'USER_NOT_FOUND',
        message: `Lichess user "${username}" not found`,
        retryable: false,
        status: 404,
      });
    }
    throw error;
  }
}

export async function fetchLichessPuzzles(theme = '', count = 5) {
  const puzzles = [];
  for (let i = 0; i < count; i += 1) {
    const payload = await requestWithRetry('https://lichess.org/api/puzzle/next', {
      params: theme ? { theme } : {},
      headers: { Accept: 'application/json' },
      timeoutMs: 8_000,
    });
    puzzles.push(payload);
  }
  return puzzles;
}

function parseNdjson(text) {
  return text
    .trim()
    .split('\n')
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function processLichessGame(rawGame, username, index) {
  const isWhite = rawGame.players?.white?.user?.name?.toLowerCase() === username.toLowerCase();
  const playerColor = isWhite ? 'white' : 'black';
  const opponent = isWhite ? rawGame.players?.black : rawGame.players?.white;
  const player = isWhite ? rawGame.players?.white : rawGame.players?.black;

  return {
    id: `lichess-${rawGame.id || index}`,
    platform: 'lichess',
    pgn: rawGame.pgn || '',
    url: `https://lichess.org/${rawGame.id}`,
    playerColor,
    opponent: opponent?.user?.name || 'Anonymous',
    opponentRating: opponent?.rating || 0,
    playerRating: player?.rating || 0,
    result: resolveResult(rawGame, playerColor),
    timeControl: parseTimeControl(rawGame.clock, rawGame.speed),
    date: rawGame.createdAt ? new Date(rawGame.createdAt).toISOString().split('T')[0] : 'Unknown',
    opening: rawGame.opening?.name || 'Unknown Opening',
    eco: rawGame.opening?.eco || '',
    lichessEvals: rawGame.analysis || null,
    analysis: null,
    moves: [],
  };
}

function isIncludedLichessGame(rawGame) {
  if (!rawGame?.rated) return false;
  if ((rawGame.variant || 'standard') !== 'standard') return false;
  return INCLUDED_SPEEDS.has((rawGame.speed || '').toLowerCase());
}

function isCoachGame(game) {
  const opponentName = (game?.opponent || '').toLowerCase();
  return /(coach|bot|computer|stockfish|chesscoach|maia)/.test(opponentName);
}

function resolveResult(rawGame, playerColor) {
  if (rawGame.winner === playerColor) return 'win';
  if (rawGame.winner && rawGame.winner !== playerColor) return 'loss';
  return 'draw';
}

function parseTimeControl(clock, speed) {
  const normalizedSpeed = (speed || '').toLowerCase();
  if (normalizedSpeed === 'correspondence') return 'Daily';
  if (normalizedSpeed === 'rapid') return 'Rapid';
  if (normalizedSpeed === 'blitz') return 'Blitz';
  if (normalizedSpeed === 'bullet') return 'Bullet';
  if (!clock) return 'Unknown';
  const baseMinutes = Math.floor(clock.initial / 60);
  return `${baseMinutes}+${clock.increment}`;
}
