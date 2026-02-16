// ═══════════════════════════════════════════
// Lichess Public API Service
// ═══════════════════════════════════════════
// API Docs: https://lichess.org/api
//
// Lichess has a more generous API than Chess.com.
// It's completely free, open source, and gives us
// more data per request. Think of it as a library
// that also lets you photocopy the books for free.
// ═══════════════════════════════════════════

import axios from 'axios';

const BASE_URL = 'https://lichess.org/api';

/**
 * Check if a Lichess user exists and get their profile
 */
export async function getPlayerProfile(username) {
  try {
    const response = await axios.get(`${BASE_URL}/user/${username}`);
    return response.data;
  } catch (error) {
    if (error.response?.status === 404) {
      throw new Error(`Lichess user "${username}" not found`);
    }
    throw error;
  }
}

/**
 * HIGH-LEVEL: Get a player's most recent games with evaluations
 *
 * The beauty of the Lichess API: it can include computer analysis
 * directly in the response! If the player has analyzed their games
 * on Lichess, we get the evaluations for free.
 *
 * @param {string} username - Lichess username
 * @param {number} count - Number of games to fetch (max 300)
 * @returns {Array} Processed game objects
 */
export async function getRecentGames(username, count = 20) {
  try {
    // Lichess returns games as newline-delimited JSON (ndjson)
    // We need to set Accept header to get JSON instead of PGN
    const response = await axios.get(
      `${BASE_URL}/games/user/${username}`,
      {
        params: {
          max: count,
          rated: true,          // Only rated games (more serious play)
          evals: true,          // Include computer evaluations if available
          opening: true,        // Include opening names
          pgnInJson: true,      // Include PGN in the JSON response
          clocks: true,         // Include clock times (useful for detecting time pressure)
        },
        headers: {
          'Accept': 'application/x-ndjson'
        },
        // Lichess returns ndjson (newline-delimited JSON)
        // We need to parse it manually
        transformResponse: [(data) => {
          if (typeof data === 'string') {
            return data.trim().split('\n').map(line => {
              try { return JSON.parse(line); }
              catch { return null; }
            }).filter(Boolean);
          }
          return data;
        }]
      }
    );

    const games = Array.isArray(response.data) ? response.data : [response.data];
    return games.map((game, index) => processLichessGame(game, username, index));
  } catch (error) {
    if (error.response?.status === 404) {
      throw new Error(`Lichess user "${username}" not found`);
    }
    throw new Error(`Could not fetch Lichess games: ${error.message}`);
  }
}

/**
 * Transform a raw Lichess game object into our app's format
 */
function processLichessGame(rawGame, username, index) {
  const isWhite = rawGame.players?.white?.user?.name?.toLowerCase() === username.toLowerCase();
  const playerColor = isWhite ? 'white' : 'black';
  const opponent = isWhite ? rawGame.players?.black : rawGame.players?.white;
  const player = isWhite ? rawGame.players?.white : rawGame.players?.black;

  // Determine result
  let result = 'draw';
  if (rawGame.winner === playerColor) result = 'win';
  else if (rawGame.winner && rawGame.winner !== playerColor) result = 'loss';
  else if (rawGame.status === 'draw' || rawGame.status === 'stalemate') result = 'draw';

  // Parse time control
  const clock = rawGame.clock;
  let timeControl = 'Unknown';
  if (clock) {
    const baseMinutes = Math.floor(clock.initial / 60);
    const increment = clock.increment;
    timeControl = `${baseMinutes}+${increment}`;
  }

  // Extract opening info
  const opening = rawGame.opening?.name || 'Unknown Opening';
  const eco = rawGame.opening?.eco || '';

  return {
    id: `lichess-${rawGame.id || index}`,
    platform: 'lichess',
    pgn: rawGame.pgn || '',
    url: `https://lichess.org/${rawGame.id}`,
    playerColor,
    opponent: opponent?.user?.name || 'Anonymous',
    opponentRating: opponent?.rating || 0,
    playerRating: player?.rating || 0,
    result,
    timeControl,
    date: rawGame.createdAt
      ? new Date(rawGame.createdAt).toISOString().split('T')[0]
      : 'Unknown',
    opening,
    eco,
    // Lichess may include evaluations already!
    lichessEvals: rawGame.analysis || null,
    analysis: null,
    moves: []
  };
}

/**
 * Get the Lichess cloud evaluation for a specific position
 * This taps into Lichess's database of ~7 million pre-analyzed positions
 *
 * @param {string} fen - FEN string of the position
 * @returns {Object|null} Evaluation data or null if not cached
 */
export async function getCloudEval(fen) {
  try {
    const response = await axios.get('https://lichess.org/api/cloud-eval', {
      params: { fen, multiPv: 3 }
    });
    return response.data;
  } catch {
    return null; // Position not in cloud database
  }
}

/**
 * Query the Lichess Opening Explorer
 * Shows win/draw/loss statistics for any position
 *
 * @param {string} fen - Position to look up
 * @param {string} type - 'masters' for master games, 'lichess' for all games
 */
export async function getOpeningExplorer(fen, type = 'lichess') {
  try {
    const url = type === 'masters'
      ? 'https://explorer.lichess.ovh/masters'
      : 'https://explorer.lichess.ovh/lichess';

    const response = await axios.get(url, {
      params: {
        fen,
        ratings: '1000,1200,1400,1600', // Filter by rating range
        speeds: 'rapid,classical',
      }
    });
    return response.data;
  } catch {
    return null;
  }
}

/**
 * Query the Syzygy endgame tablebase
 * For positions with 7 or fewer pieces, this gives PERFECT play
 *
 * @param {string} fen - Position to look up
 * @returns {Object|null} Tablebase result with optimal moves
 */
export async function getTablebase(fen) {
  try {
    const response = await axios.get('https://tablebase.lichess.ovh/standard', {
      params: { fen }
    });
    return response.data;
  } catch {
    return null;
  }
}

/**
 * Get themed puzzles from Lichess
 * Themes include: fork, pin, hangingPiece, endgame, etc.
 *
 * @param {string} theme - Puzzle theme to filter by
 * @param {number} count - Number of puzzles
 */
export async function getPuzzles(theme = '', count = 5) {
  try {
    // Lichess puzzle API returns a single random puzzle at a time
    // We'll call it multiple times
    const puzzles = [];
    for (let i = 0; i < count; i++) {
      const response = await axios.get('https://lichess.org/api/puzzle/next', {
        params: theme ? { theme } : {},
        headers: { 'Accept': 'application/json' }
      });
      if (response.data) puzzles.push(response.data);
    }
    return puzzles;
  } catch {
    return [];
  }
}
