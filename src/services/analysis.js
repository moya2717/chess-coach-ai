// ═══════════════════════════════════════════
// Game Analysis Service
// ═══════════════════════════════════════════
// This is the "doctor" in our analogy — it takes your game
// (medical records) and runs diagnostic tests (engine analysis)
// to figure out exactly where things went wrong.
//
// We use chess.js to replay the game move by move, and
// Chess-API.com to get Stockfish evaluations at each position.
// ═══════════════════════════════════════════

import { Chess } from 'chess.js';
import axios from 'axios';

/**
 * Analyze a full game and return move-by-move evaluations
 *
 * @param {string} pgn - The game in PGN format
 * @param {string} playerColor - 'white' or 'black'
 * @returns {Object} Full analysis with moves, evals, and classifications
 */
export async function analyzeGame(pgn, playerColor = 'white') {
  const chess = new Chess();

  // Load the PGN into chess.js
  // This is like feeding the game transcript into a chess computer
  try {
    chess.loadPgn(pgn);
  } catch (error) {
    throw new Error('Invalid PGN format');
  }

  // Get the move history
  const moves = chess.history({ verbose: true });
  chess.reset(); // Go back to the starting position

  const analyzedMoves = [];
  let prevEval = 0;
  let blunders = 0, mistakes = 0, inaccuracies = 0;
  let openingAccuracy = [], middlegameAccuracy = [], endgameAccuracy = [];

  for (let i = 0; i < moves.length; i++) {
    const move = moves[i];
    const fenBefore = chess.fen();

    // Make the move
    chess.move(move.san);
    const fenAfter = chess.fen();

    // Get engine evaluation for this position
    // We use a try-catch because the API might rate-limit us
    let evaluation = null;
    try {
      evaluation = await getStockfishEval(fenAfter);
    } catch {
      // If API fails, estimate based on material count
      evaluation = { eval: estimateMaterialEval(fenAfter) };
    }

    const currentEval = evaluation?.eval || 0;
    const isPlayerMove = (i % 2 === 0 && playerColor === 'white') ||
                          (i % 2 === 1 && playerColor === 'black');

    // Calculate eval drop (how much worse the position got after this move)
    const evalDrop = isPlayerMove ? Math.max(0, prevEval - currentEval) : 0;

    // Classify the move
    let classification = 'good';
    if (evalDrop > 2.0) { classification = 'blunder'; if (isPlayerMove) blunders++; }
    else if (evalDrop > 1.0) { classification = 'mistake'; if (isPlayerMove) mistakes++; }
    else if (evalDrop > 0.5) { classification = 'inaccuracy'; if (isPlayerMove) inaccuracies++; }
    else if (evalDrop < 0.1) { classification = 'great'; }

    // Determine game phase
    const phase = getGamePhase(i, moves.length);
    const moveAccuracy = Math.max(0, 100 - evalDrop * 30);

    if (phase === 'opening') openingAccuracy.push(moveAccuracy);
    else if (phase === 'middlegame') middlegameAccuracy.push(moveAccuracy);
    else endgameAccuracy.push(moveAccuracy);

    analyzedMoves.push({
      num: Math.floor(i / 2) + 1,
      san: move.san,
      isWhite: i % 2 === 0,
      fenBefore,
      fenAfter,
      eval: currentEval,
      evalDrop,
      classification,
      phase,
      isPlayerMove,
      from: move.from,
      to: move.to,
    });

    prevEval = currentEval;

    // Small delay to avoid hammering the API
    // (like waiting your turn in line at the library)
    if (i < moves.length - 1) {
      await sleep(200);
    }
  }

  // Calculate overall accuracy (Chess.com-style percentage)
  const playerMoves = analyzedMoves.filter(m => m.isPlayerMove);
  const avgAccuracy = playerMoves.length > 0
    ? Math.round(playerMoves.reduce((sum, m) => sum + Math.max(0, 100 - m.evalDrop * 30), 0) / playerMoves.length)
    : 0;

  return {
    moves: analyzedMoves,
    accuracy: Math.min(100, avgAccuracy),
    blunders,
    mistakes,
    inaccuracies,
    phases: {
      opening: avg(openingAccuracy),
      middlegame: avg(middlegameAccuracy),
      endgame: avg(endgameAccuracy),
    }
  };
}

/**
 * Get Stockfish evaluation for a position using Chess-API.com
 *
 * ANALOGY: This is like sending an X-ray to a specialist.
 * You give them the position, they tell you who's winning and by how much.
 *
 * Depth 12 ≈ International Master level (~2350)
 * Depth 16 ≈ Strong Grandmaster level (~2600)
 * Depth 18 ≈ Super Grandmaster level (~2750)
 */
async function getStockfishEval(fen, depth = 14) {
  try {
    const response = await axios.get('https://chess-api.com/v1', {
      params: { fen, depth },
      timeout: 10000
    });

    if (response.data) {
      return {
        eval: response.data.eval ? response.data.eval / 100 : 0, // Convert centipawns to pawns
        bestMove: response.data.move || null,
        depth: response.data.depth || depth,
        mate: response.data.mate || null,
      };
    }
    return { eval: 0 };
  } catch {
    return { eval: 0 };
  }
}

/**
 * Quick material-based evaluation as fallback
 * Not as accurate as Stockfish, but better than nothing
 */
function estimateMaterialEval(fen) {
  const pieceValues = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  const position = fen.split(' ')[0];
  let eval_ = 0;

  for (const char of position) {
    const lower = char.toLowerCase();
    if (pieceValues[lower] !== undefined) {
      eval_ += char === char.toUpperCase()
        ? pieceValues[lower]   // White piece: positive
        : -pieceValues[lower]; // Black piece: negative
    }
  }
  return eval_;
}

/**
 * Determine the phase of the game based on move number
 */
function getGamePhase(moveIndex, totalMoves) {
  const progress = moveIndex / totalMoves;
  if (progress < 0.25) return 'opening';
  if (progress < 0.7) return 'middlegame';
  return 'endgame';
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

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
