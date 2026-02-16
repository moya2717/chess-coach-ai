// ═══════════════════════════════════════════
// Chess.com Public API Service
// ═══════════════════════════════════════════
// API Docs: https://www.chess.com/news/view/published-data-api
//
// ANALOGY: Think of this like a library card catalog.
// You give it a name, and it finds all the books (games)
// that person has checked out (played).
// ═══════════════════════════════════════════

import axios from 'axios';

const BASE_URL = 'https://api.chess.com/pub';

/**
 * Check if a Chess.com user exists and get their profile
 */
export async function getPlayerProfile(username) {
  try {
    const response = await axios.get(`${BASE_URL}/player/${username}`);
    return response.data;
  } catch (error) {
    if (error.response?.status === 404) {
      throw new Error(`Chess.com user "${username}" not found`);
    }
    throw error;
  }
}

/**
 * Get a player's current ratings across all time controls
 */
export async function getPlayerStats(username) {
  try {
    const response = await axios.get(`${BASE_URL}/player/${username}/stats`);
    return response.data;
  } catch (error) {
    throw new Error(`Could not fetch stats for "${username}"`);
  }
}

/**
 * Get the list of monthly game archives available
 * Returns URLs like: ["https://api.chess.com/pub/player/erik/games/2022/01", ...]
 */
export async function getGameArchives(username) {
  try {
    const response = await axios.get(`${BASE_URL}/player/${username}/games/archives`);
    return response.data.archives || [];
  } catch (error) {
    throw new Error(`Could not fetch archives for "${username}"`);
  }
}

/**
 * Fetch games from a specific month
 * @param {string} archiveUrl - Full archive URL from getGameArchives
 * @returns {Array} Array of game objects with PGN data
 */
export async function getGamesFromArchive(archiveUrl) {
  try {
    const response = await axios.get(archiveUrl);
    return response.data.games || [];
  } catch (error) {
    throw new Error('Could not fetch games from archive');
  }
}

/**
 * HIGH-LEVEL: Get a player's most recent games
 * This is the main function you'll call.
 *
 * @param {string} username - Chess.com username
 * @param {number} count - How many recent games to fetch (default 20)
 * @returns {Array} Processed game objects ready for analysis
 */
export async function getRecentGames(username, count = 20) {
  // Step 1: Get the list of all monthly archives
  const archives = await getGameArchives(username);

  if (archives.length === 0) {
    return [];
  }

  // Step 2: Start from the most recent month and work backwards
  // until we have enough games
  const allGames = [];
  for (let i = archives.length - 1; i >= 0 && allGames.length < count; i--) {
    const monthGames = await getGamesFromArchive(archives[i]);
    allGames.push(...monthGames);
  }

  // Step 3: Take only the most recent 'count' games and process them
  const recentGames = allGames.slice(-count).reverse();

  // Step 4: Transform into our app's format
  return recentGames.map((game, index) => processChessComGame(game, username, index));
}

/**
 * Transform a raw Chess.com game object into our app's format
 */
function processChessComGame(rawGame, username, index) {
  const isWhite = rawGame.white?.username?.toLowerCase() === username.toLowerCase();
  const playerColor = isWhite ? 'white' : 'black';
  const opponent = isWhite ? rawGame.black : rawGame.white;
  const player = isWhite ? rawGame.white : rawGame.black;

  // Determine result
  let result = 'draw';
  if (player.result === 'win') result = 'win';
  else if (opponent.result === 'win') result = 'loss';

  // Parse time control into human-readable format
  const tc = rawGame.time_control || '';
  let timeControl = tc;
  if (tc.includes('+')) {
    const [base, inc] = tc.split('+');
    timeControl = `${Math.floor(parseInt(base) / 60)}+${inc}`;
  } else if (tc.includes('/')) {
    timeControl = 'Daily';
  }

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
    timeControl,
    date: rawGame.end_time
      ? new Date(rawGame.end_time * 1000).toISOString().split('T')[0]
      : 'Unknown',
    opening: extractOpeningFromPGN(rawGame.pgn),
    eco: extractECOFromPGN(rawGame.pgn),
    // Analysis will be filled in later by the analysis service
    analysis: null,
    moves: [] // Will be populated by analysis service
  };
}

/**
 * Extract the opening name from a PGN string
 */
function extractOpeningFromPGN(pgn) {
  if (!pgn) return 'Unknown Opening';
  const match = pgn.match(/\[ECOUrl ".*?\/(.+?)"\]/);
  if (match) {
    return match[1].replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }
  const openingMatch = pgn.match(/\[Opening "(.+?)"\]/);
  return openingMatch ? openingMatch[1] : 'Unknown Opening';
}

/**
 * Extract ECO code from PGN
 */
function extractECOFromPGN(pgn) {
  if (!pgn) return '';
  const match = pgn.match(/\[ECO "(.+?)"\]/);
  return match ? match[1] : '';
}
