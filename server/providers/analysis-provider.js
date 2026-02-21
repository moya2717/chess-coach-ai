import { Chess } from 'chess.js';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { requestWithRetry } from '../lib/http-client.js';

const execFileAsync = promisify(execFile);
const ENGINE_COOLDOWN_MS = 2 * 60_000;
let engineUnavailableUntil = 0;
let localStockfishAvailable;

export async function analyzeGameWithEngine(pgn, playerColor = 'white', engineMode = 'auto') {
  const chess = new Chess();
  chess.loadPgn(pgn);

  const moves = chess.history({ verbose: true });
  chess.reset();

  const analyzedMoves = [];
  let prevEval = 0;
  let blunders = 0;
  let mistakes = 0;
  let inaccuracies = 0;
  const openingAccuracy = [];
  const middlegameAccuracy = [];
  const endgameAccuracy = [];

  for (let i = 0; i < moves.length; i += 1) {
    const analyzedMove = await analyzeMove(chess, moves[i], i, moves.length, prevEval, playerColor, engineMode);
    prevEval = analyzedMove.eval;

    if (analyzedMove.isPlayerMove) {
      if (analyzedMove.classification === 'blunder') blunders += 1;
      if (analyzedMove.classification === 'mistake') mistakes += 1;
      if (analyzedMove.classification === 'inaccuracy') inaccuracies += 1;
    }

    addPhaseAccuracy(analyzedMove.phase, analyzedMove.moveScore, {
      openingAccuracy,
      middlegameAccuracy,
      endgameAccuracy,
    });
    analyzedMoves.push(analyzedMove);
  }

  return {
    moves: analyzedMoves,
    accuracy: calculateAccuracy(analyzedMoves),
    blunders,
    mistakes,
    inaccuracies,
    phases: {
      opening: avg(openingAccuracy),
      middlegame: avg(middlegameAccuracy),
      endgame: avg(endgameAccuracy),
    },
  };
}

async function analyzeMove(chess, move, index, totalMoves, prevEval, playerColor, engineMode) {
  const fenBefore = chess.fen();
  chess.move(move.san);
  const fenAfter = chess.fen();
  const evaluation = await getStockfishEval(fenAfter, 14, engineMode);
  const isPlayerMove = (index % 2 === 0 && playerColor === 'white') || (index % 2 === 1 && playerColor === 'black');
  const currentEval = evaluation?.eval || 0;
  const evalDrop = getEvalDrop({ isPlayerMove, playerColor, prevEval, currentEval });

  const evalSource = evaluation?.source || 'unknown';

  return {
    num: Math.floor(index / 2) + 1,
    san: move.san,
    isWhite: index % 2 === 0,
    fenBefore,
    fenAfter,
    eval: currentEval,
    evalDrop,
    classification: isPlayerMove ? classifyMove(evalDrop, evalSource) : 'book',
    phase: getGamePhase(index, totalMoves),
    isPlayerMove,
    from: move.from,
    to: move.to,
    evalSource,
    moveScore: computeMoveScore(evalSource, evalDrop),
  };
}



function computeMoveScore(evalSource, evalDrop) {
  if (evalSource === 'material') {
    return Math.max(45, Math.round(72 - evalDrop * 15));
  }
  return Math.max(0, Math.round(100 - evalDrop * 30));
}

function getEvalDrop({ isPlayerMove, playerColor, prevEval, currentEval }) {
  if (!isPlayerMove) return 0;
  if (playerColor === 'black') return Math.max(0, currentEval - prevEval);
  return Math.max(0, prevEval - currentEval);
}

async function getStockfishEval(fen, depth = 14, engineMode = 'auto') {
  if (engineMode === 'local') return getLocalEvalWithFallback(fen, depth);
  if (engineMode === 'web') return getWebEvalWithFallback(fen, depth);

  const local = await getLocalEval(fen, depth);
  if (local) return local;
  return getWebEvalWithFallback(fen, depth);
}

async function getWebEvalWithFallback(fen, depth) {
  if (!isEngineAvailable()) return { eval: estimateMaterialEval(fen), source: 'material' };
  try {
    const data = await requestWithRetry('https://chess-api.com/v1', {
      params: { fen, depth },
      timeoutMs: 2_500,
      retries: 0,
    });

    return {
      eval: data.eval ? data.eval / 100 : 0,
      bestMove: data.move || null,
      depth: data.depth || depth,
      mate: data.mate || null,
      source: 'engine-web',
    };
  } catch {
    markEngineUnavailable();
    return { eval: estimateMaterialEval(fen), source: 'material' };
  }
}

async function getLocalEvalWithFallback(fen, depth) {
  const local = await getLocalEval(fen, depth);
  if (local) return local;
  return { eval: estimateMaterialEval(fen), source: 'material' };
}

async function getLocalEval(fen, depth) {
  const hasStockfish = await hasLocalStockfish();
  if (!hasStockfish) return null;

  const stdin = [`uci`, `isready`, `position fen ${fen}`, `go depth ${depth}`, 'quit'].join('\n');
  try {
    const { stdout } = await execFileAsync('stockfish', [], { timeout: 2000, input: stdin, maxBuffer: 1024 * 1024 });
    const lines = stdout.split('\n');
    const infoLines = lines.filter((line) => line.includes(' score '));
    const bestLine = infoLines[infoLines.length - 1] || '';
    return { eval: parseUciScore(bestLine), source: 'engine-local', depth };
  } catch {
    return null;
  }
}

async function hasLocalStockfish() {
  if (localStockfishAvailable !== undefined) return localStockfishAvailable;
  try {
    await execFileAsync('stockfish', ['--help'], { timeout: 1200 });
    localStockfishAvailable = true;
  } catch {
    localStockfishAvailable = false;
  }
  return localStockfishAvailable;
}

function parseUciScore(line) {
  const cpMatch = line.match(/score cp (-?\d+)/);
  if (cpMatch) return Number(cpMatch[1]) / 100;
  const mateMatch = line.match(/score mate (-?\d+)/);
  if (!mateMatch) return 0;
  const mateDistance = Number(mateMatch[1]);
  return mateDistance > 0 ? 99 : -99;
}

function isEngineAvailable() {
  return Date.now() >= engineUnavailableUntil;
}

function markEngineUnavailable() {
  engineUnavailableUntil = Date.now() + ENGINE_COOLDOWN_MS;
}

function classifyMove(evalDrop, evalSource) {
  if (evalDrop > 2.0) return 'blunder';
  if (evalDrop > 1.0) return 'mistake';
  if (evalDrop > 0.4) return 'inaccuracy';
  if (evalSource !== 'material' && evalDrop <= 0.03) return 'great';
  return 'good';
}

function addPhaseAccuracy(phase, score, buckets) {
  const bounded = Math.max(0, score);
  if (phase === 'opening') buckets.openingAccuracy.push(bounded);
  else if (phase === 'middlegame') buckets.middlegameAccuracy.push(bounded);
  else buckets.endgameAccuracy.push(bounded);
}

function calculateAccuracy(moves) {
  const playerMoves = moves.filter((move) => move.isPlayerMove);
  if (!playerMoves.length) return 0;

  const total = playerMoves.reduce((sum, move) => sum + (move.moveScore || 0), 0);
  return Math.min(100, Math.round(total / playerMoves.length));
}

function estimateMaterialEval(fen) {
  const pieceValues = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  return fen.split(' ')[0].split('').reduce((score, char) => {
    const lower = char.toLowerCase();
    if (!(lower in pieceValues)) return score;
    return char === char.toUpperCase() ? score + pieceValues[lower] : score - pieceValues[lower];
  }, 0);
}

function getGamePhase(moveIndex, totalMoves) {
  const progress = moveIndex / totalMoves;
  if (progress < 0.25) return 'opening';
  if (progress < 0.7) return 'middlegame';
  return 'endgame';
}

function avg(numbers) {
  if (!numbers.length) return 0;
  return Math.round(numbers.reduce((sum, n) => sum + n, 0) / numbers.length);
}
