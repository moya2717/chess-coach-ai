import { ApiError } from '../lib/errors.js';
import { requestWithRetry } from '../lib/http-client.js';

const BASE_URL = 'https://api.chess.com/pub';

export async function fetchChesscomProfile(username) {
  try {
    return await requestWithRetry(`${BASE_URL}/player/${username}`);
  } catch (error) {
    if (error.status === 404) {
      throw new ApiError({ code: 'USER_NOT_FOUND', message: `Chess.com user "${username}" not found`, retryable: false, status: 404 });
    }
    throw error;
  }
}

export async function fetchChesscomStats(username) {
  return requestWithRetry(`${BASE_URL}/player/${username}/stats`);
}

export async function fetchChesscomRecentGames(username, count = 20) {
  const archives = await fetchArchives(username);
  if (!archives.length) return [];

  const allGames = [];
  for (let idx = archives.length - 1; idx >= 0 && allGames.length < count; idx -= 1) {
    const month = await requestWithRetry(archives[idx]);
    allGames.push(...(month.games || []));
  }

  return allGames
    .slice(-count)
    .reverse()
    .map((game, index) => processChessComGame(game, username, index));
}

async function fetchArchives(username) {
  try {
    const data = await requestWithRetry(`${BASE_URL}/player/${username}/games/archives`);
    return data.archives || [];
  } catch (error) {
    if (error.status === 404) {
      throw new ApiError({
        code: 'USER_NOT_FOUND',
        message: `Chess.com user "${username}" not found`,
        retryable: false,
        status: 404,
      });
    }
    throw error;
  }
}

export function processChessComGame(rawGame, username, index) {
  const isWhite = rawGame.white?.username?.toLowerCase() === username.toLowerCase();
  const playerColor = isWhite ? 'white' : 'black';
  const opponent = isWhite ? rawGame.black : rawGame.white;
  const player = isWhite ? rawGame.white : rawGame.black;
  const result = resolveResult(player, opponent);

  return {
    id: `chesscom-${rawGame.uuid || index}`,
    platform: 'chess.com',
    pgn: rawGame.pgn || '',
    url: rawGame.url || '',
    playerColor,
    opponent: opponent?.username || 'Unknown',
    opponentRating: opponent?.rating || 0,
    playerRating: player?.rating || 0,
    result,
    timeControl: parseTimeControl(rawGame.time_control || ''),
    date: rawGame.end_time ? new Date(rawGame.end_time * 1000).toISOString().split('T')[0] : 'Unknown',
    opening: extractOpeningFromPGN(rawGame.pgn),
    eco: extractECOFromPGN(rawGame.pgn),
    analysis: null,
    moves: [],
  };
}

function resolveResult(player, opponent) {
  if (player?.result === 'win') return 'win';
  if (opponent?.result === 'win') return 'loss';
  return 'draw';
}

function parseTimeControl(timeControl) {
  if (timeControl.includes('+')) {
    const [base, increment] = timeControl.split('+');
    return `${Math.floor(parseInt(base, 10) / 60)}+${increment}`;
  }
  if (timeControl.includes('/')) return 'Daily';
  return timeControl;
}

function extractOpeningFromPGN(pgn) {
  if (!pgn) return 'Unknown Opening';
  const ecoUrlMatch = pgn.match(/\[ECOUrl ".*?\/(.+?)"\]/);
  if (ecoUrlMatch) {
    return ecoUrlMatch[1].replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  }
  const openingMatch = pgn.match(/\[Opening "(.+?)"\]/);
  return openingMatch ? openingMatch[1] : 'Unknown Opening';
}

function extractECOFromPGN(pgn) {
  if (!pgn) return '';
  const match = pgn.match(/\[ECO "(.+?)"\]/);
  return match ? match[1] : '';
}
