import { Chess } from 'chess.js';
import axios from 'axios';

export async function analyzeGame(pgn, playerColor = 'white', options = {}) {
  const chess = new Chess();
  try {
    chess.loadPgn(pgn);
  } catch {
    throw new Error('Invalid PGN format');
  }

  const moves = chess.history({ verbose: true });
  chess.reset();

  const state = createAnalysisState();
  const onProgress = typeof options.onProgress === 'function' ? options.onProgress : null;
  const totalMoves = moves.length;

  for (let i = 0; i < totalMoves; i++) {
    const analyzedMove = await analyzeMove({ chess, move: moves[i], index: i, totalMoves, playerColor, prevEval: state.prevEval });
    state.prevEval = analyzedMove.eval;
    applyMoveStats(state, analyzedMove);
    state.moves.push(analyzedMove);

    onProgress?.({
      processedMoves: i + 1,
      totalMoves,
      latestMove: analyzedMove,
    });

    if (i < totalMoves - 1) await sleep(200);
  }

  return buildFinalResult(state);
}

function createAnalysisState() {
  return {
    moves: [],
    prevEval: 0,
    blunders: 0,
    mistakes: 0,
    inaccuracies: 0,
    openingAccuracy: [],
    middlegameAccuracy: [],
    endgameAccuracy: [],
  };
}

async function analyzeMove({ chess, move, index, totalMoves, playerColor, prevEval }) {
  const fenBefore = chess.fen();
  chess.move(move.san);
  const fenAfter = chess.fen();
  const evaluation = await getStockfishEval(fenAfter);
  const currentEval = evaluation?.eval || 0;
  const isPlayerMove = isMoveByPlayer(index, playerColor);
  const evalDrop = isPlayerMove ? Math.max(0, prevEval - currentEval) : 0;
  const classification = classifyMove(evalDrop);
  const phase = getGamePhase(index, totalMoves);

  return {
    num: Math.floor(index / 2) + 1,
    san: move.san,
    isWhite: index % 2 === 0,
    fenBefore,
    fenAfter,
    eval: currentEval,
    evalDrop,
    classification,
    phase,
    isPlayerMove,
    from: move.from,
    to: move.to,
  };
}

function applyMoveStats(state, analyzedMove) {
  if (analyzedMove.isPlayerMove) {
    if (analyzedMove.classification === 'blunder') state.blunders += 1;
    if (analyzedMove.classification === 'mistake') state.mistakes += 1;
    if (analyzedMove.classification === 'inaccuracy') state.inaccuracies += 1;
  }

  const moveAccuracy = Math.max(0, 100 - analyzedMove.evalDrop * 30);
  if (analyzedMove.phase === 'opening') state.openingAccuracy.push(moveAccuracy);
  else if (analyzedMove.phase === 'middlegame') state.middlegameAccuracy.push(moveAccuracy);
  else state.endgameAccuracy.push(moveAccuracy);
}

function buildFinalResult(state) {
  const playerMoves = state.moves.filter((m) => m.isPlayerMove);
  const avgAccuracy = playerMoves.length > 0
    ? Math.round(playerMoves.reduce((sum, m) => sum + Math.max(0, 100 - m.evalDrop * 30), 0) / playerMoves.length)
    : 0;

  return {
    moves: state.moves,
    accuracy: Math.min(100, avgAccuracy),
    blunders: state.blunders,
    mistakes: state.mistakes,
    inaccuracies: state.inaccuracies,
    phases: {
      opening: avg(state.openingAccuracy),
      middlegame: avg(state.middlegameAccuracy),
      endgame: avg(state.endgameAccuracy),
    },
  };
}

function isMoveByPlayer(index, playerColor) {
  return (index % 2 === 0 && playerColor === 'white') || (index % 2 === 1 && playerColor === 'black');
}

function classifyMove(evalDrop) {
  if (evalDrop > 2.0) return 'blunder';
  if (evalDrop > 1.0) return 'mistake';
  if (evalDrop > 0.5) return 'inaccuracy';
  if (evalDrop < 0.1) return 'great';
  return 'good';
}

async function getStockfishEval(fen, depth = 14) {
  try {
    const response = await axios.get('https://chess-api.com/v1', {
      params: { fen, depth },
      timeout: 10000
    });

    if (response.data) {
      return {
        eval: response.data.eval ? response.data.eval / 100 : 0,
        bestMove: response.data.move || null,
        depth: response.data.depth || depth,
        mate: response.data.mate || null,
      };
    }
    return { eval: 0 };
  } catch {
    return { eval: estimateMaterialEval(fen) };
  }
}

function estimateMaterialEval(fen) {
  const pieceValues = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  const position = fen.split(' ')[0];
  let eval_ = 0;

  for (const char of position) {
    const lower = char.toLowerCase();
    if (pieceValues[lower] !== undefined) {
      eval_ += char === char.toUpperCase() ? pieceValues[lower] : -pieceValues[lower];
    }
  }
  return eval_;
}

function getGamePhase(moveIndex, totalMoves) {
  const progress = moveIndex / totalMoves;
  if (progress < 0.25) return 'opening';
  if (progress < 0.7) return 'middlegame';
  return 'endgame';
}

export function detectPatterns(games) {
  const patterns = [];
  const analyzedGames = games.filter(g => g.analysis && g.analysis.moves?.length > 0);

  if (analyzedGames.length === 0) return [];

  const gamesWithBlunders = analyzedGames.filter(g => g.analysis.blunders > 0);
  if (gamesWithBlunders.length > 0) {
    const frequency = Math.round((gamesWithBlunders.length / analyzedGames.length) * 100);
    patterns.push({
      name: 'Hanging Pieces', icon: '🔴', severity: frequency > 50 ? 'critical' : 'moderate', frequency,
      description: `In ${frequency}% of your games, you left pieces undefended — leading to blunders. Think of it like leaving valuables on the table: if they're not protected, someone will grab them.`,
      coaching: `Before every move, do a quick "safety scan": look at all your pieces and ask "if my opponent attacks this right now, is it defended?" This 5-second habit prevents most piece losses.`,
      puzzleTheme: 'hangingPiece',
    });
  }

  const avgEndgame = avg(analyzedGames.map(g => g.analysis.phases.endgame));
  const avgMiddlegame = avg(analyzedGames.map(g => g.analysis.phases.middlegame));
  if (avgEndgame < avgMiddlegame - 10) {
    patterns.push({
      name: 'Weak Endgame Technique', icon: '🔴', severity: avgEndgame < 50 ? 'critical' : 'moderate',
      frequency: Math.round(100 - avgEndgame),
      description: `Your endgame accuracy is ${Math.round(avgEndgame)}%, significantly lower than your middlegame (${Math.round(avgMiddlegame)}%). It's like running a strong race but stumbling in the final stretch.`,
      coaching: `Focus on two things: 1) Push your King to the center in endgames (it becomes a fighting piece). 2) Create passed pawns — a pawn with no enemies blocking its promotion path is your most powerful weapon.`,
      puzzleTheme: 'endgame',
    });
  }

  const avgOpening = avg(analyzedGames.map(g => g.analysis.phases.opening));
  if (avgOpening < 70) {
    patterns.push({
      name: 'Opening Preparation Gaps', icon: '🟠', severity: 'moderate', frequency: Math.round(100 - avgOpening),
      description: `Your opening accuracy is ${Math.round(avgOpening)}%. You may be deviating from known theory too early. Think of openings like a GPS route — follow the proven path until you know the territory well enough to go off-road.`,
      coaching: `Pick one opening as White and one as Black. Play them exclusively for 30+ games. You'll start to recognize recurring patterns and plans naturally.`,
      puzzleTheme: 'opening',
    });
  }

  const totalInaccuracies = analyzedGames.reduce((s, g) => s + g.analysis.inaccuracies, 0);
  const gamesCount = analyzedGames.length;
  if (totalInaccuracies / gamesCount > 2) {
    patterns.push({
      name: 'Missed Tactical Opportunities', icon: '🟡', severity: 'moderate',
      frequency: Math.min(80, Math.round((totalInaccuracies / gamesCount) * 15)),
      description: `You average ${(totalInaccuracies / gamesCount).toFixed(1)} inaccuracies per game. Many of these are missed tactical shots — like a soccer player who gets into scoring position but doesn't shoot.`,
      coaching: `Practice tactical puzzles daily — even just 10 minutes. Focus on recognizing forks (one piece attacking two targets), pins (a piece stuck in front of a more valuable one), and skewers (attacking through a piece to one behind it).`,
      puzzleTheme: 'short',
    });
  }

  return patterns.sort((a, b) => {
    if (a.severity === 'critical' && b.severity !== 'critical') return -1;
    if (a.severity !== 'critical' && b.severity === 'critical') return 1;
    return b.frequency - a.frequency;
  });
}

function avg(arr) {
  if (arr.length === 0) return 0;
  return Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
