import { Chess } from 'chess.js';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { requestWithRetry } from '../lib/http-client.js';

const execFileAsync = promisify(execFile);
const ENGINE_COOLDOWN_MS = 2 * 60_000;
let engineUnavailableUntil = 0;
let localStockfishAvailable;


export async function buildEngineLineFromFen(fen, engineMode = 'auto', options = {}) {
  const chess = new Chess(fen);
  const line = [];
  const maxPlies = Math.max(1, Math.min(Number(options.maxPlies || 6), 12));

  for (let ply = 0; ply < maxPlies; ply += 1) {
    const evaluation = await getStockfishEval(chess.fen(), 14, engineMode, options);
    const bestMove = evaluation.bestMove;
    if (!bestMove) break;

    const san = toSanFromUci(chess, bestMove);
    if (!san) break;

    line.push({
      ply: ply + 1,
      fen: chess.fen(),
      uci: bestMove,
      san,
      eval: evaluation.eval || 0,
      source: evaluation.source || 'unknown',
    });
    chess.move(san);
  }

  return {
    startFen: fen,
    line,
    quality: summarizeLineQuality(line),
  };
}


export async function analyzePositionWithContext(fen, engineMode = 'auto', options = {}) {
  const lineResult = await buildEngineLineFromFen(fen, engineMode, options);
  const candidates = await buildCandidateMovesFromFen(fen, engineMode, options);
  return {
    startFen: fen,
    phase: inferPhaseFromFen(fen),
    line: lineResult.line,
    quality: lineResult.quality,
    candidates,
    assessment: evaluatePositionSnapshot(fen),
  };
}

export async function analyzeGameWithEngine(pgn, playerColor = 'white', engineMode = 'auto', options = {}) {
  if (engineMode === 'python') {
    return analyzeGameWithPythonBridge(pgn, playerColor, options);
  }

  const chess = new Chess();
  chess.loadPgn(pgn);

  const moves = chess.history({ verbose: true });
  chess.reset();

  const analyzedMoves = [];
  let prevEvaluation = await getStockfishEval(chess.fen(), 14, engineMode, options);
  let blunders = 0;
  let mistakes = 0;
  let inaccuracies = 0;
  const openingAccuracy = [];
  const middlegameAccuracy = [];
  const endgameAccuracy = [];

  for (let i = 0; i < moves.length; i += 1) {
    const analyzedMove = await analyzeMove(chess, moves[i], i, moves.length, prevEvaluation, playerColor, engineMode, options);
    prevEvaluation = analyzedMove.afterEvaluation;

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
    quality: summarizeAnalysisQuality(analyzedMoves),
  };
}

async function analyzeGameWithPythonBridge(pgn, playerColor, options = {}) {
  try {
    const payload = await runPythonAnalyzer(pgn, playerColor, options);
    if (payload && Array.isArray(payload.moves) && payload.moves.length > 0) {
      return payload;
    }
  } catch {
    // Fall through to JS analysis fallback for reliability.
  }

  return analyzeGameWithEngine(pgn, playerColor, 'local', options);
}

async function runPythonAnalyzer(pgn, playerColor, options = {}) {
  const scriptPath = new URL('../python/chesscom_analyzer_bridge.py', import.meta.url);
  const request = JSON.stringify({
    pgn,
    playerColor,
    depth: Number(options.depth || 12),
  });
  const { stdout } = await execFileAsync('python3', [scriptPath], {
    input: request,
    timeout: 15000,
    maxBuffer: 1024 * 1024,
  });
  return JSON.parse(stdout);
}

async function analyzeMove(chess, move, index, totalMoves, prevEval, playerColor, engineMode, options = {}) {
  const fenBefore = chess.fen();
  const moveIndex = index + 1;
  const beforeEvaluation = prevEval || { eval: 0, source: 'material', bestMove: null };
  chess.move(move.san);
  const fenAfter = chess.fen();
  const afterEvaluation = await getStockfishEval(fenAfter, 14, engineMode, options);
  const isPlayerMove = (index % 2 === 0 && playerColor === 'white') || (index % 2 === 1 && playerColor === 'black');
  const currentEval = afterEvaluation?.eval || 0;
  const previousEval = beforeEvaluation.eval || 0;
  const evalDrop = getEvalDrop({
    isPlayerMove,
    isWhiteMove: index % 2 === 0,
    previousEval,
    currentEval,
  });

  const evalSource = mergeEvalSources(beforeEvaluation.source, afterEvaluation.source);
  const bestMoveUci = beforeEvaluation.bestMove || null;
  const playerMatchedBestMove = bestMoveUci ? toUciMove(move) === bestMoveUci : false;
  const classification = isPlayerMove
    ? classifyMove({ evalDrop, evalSource, moveIndex, playerMatchedBestMove })
    : 'book';

  return {
    num: Math.floor(index / 2) + 1,
    san: move.san,
    isWhite: index % 2 === 0,
    fenBefore,
    fenAfter,
    eval: currentEval,
    beforeEval: previousEval,
    evalSwing: Number((currentEval - previousEval).toFixed(2)),
    evalDrop,
    classification,
    phase: getGamePhase(index, totalMoves),
    isPlayerMove,
    from: move.from,
    to: move.to,
    evalSource,
    bestMove: bestMoveUci,
    playerMatchedBestMove,
    moveScore: computeMoveScore(evalSource, evalDrop),
    afterEvaluation,
  };
}




function summarizeAnalysisQuality(moves) {
  const playerMoves = moves.filter((move) => move.isPlayerMove);
  if (!playerMoves.length) {
    return { primarySource: 'unknown', engineShare: 0, materialShare: 0, needsRefinement: true };
  }

  const materialMoves = playerMoves.filter((move) => move.evalSource === 'material').length;
  const engineMoves = playerMoves.length - materialMoves;
  const engineShare = Math.round((engineMoves / playerMoves.length) * 100);
  const materialShare = 100 - engineShare;

  let primarySource = 'engine';
  if (engineMoves === 0) primarySource = 'material';
  else if (materialMoves > 0) primarySource = 'mixed';

  return {
    primarySource,
    engineShare,
    materialShare,
    needsRefinement: materialShare > 30,
  };
}

function computeMoveScore(evalSource, evalDrop) {
  if (evalSource === 'material') {
    return Math.max(45, Math.round(72 - evalDrop * 15));
  }
  return Math.max(0, Math.round(100 - evalDrop * 30));
}

function getEvalDrop({ isPlayerMove, isWhiteMove, previousEval, currentEval }) {
  if (!isPlayerMove) return 0;
  return isWhiteMove ? Math.max(0, previousEval - currentEval) : Math.max(0, currentEval - previousEval);
}

function mergeEvalSources(beforeSource, afterSource) {
  if (afterSource === 'material') return 'material';
  if (beforeSource === 'material' && afterSource && afterSource !== 'material') return afterSource;
  if (beforeSource === 'engine-local' || afterSource === 'engine-local') return 'engine-local';
  if (beforeSource === 'engine-web' || afterSource === 'engine-web') return 'engine-web';
  return afterSource || beforeSource || 'unknown';
}

async function getStockfishEval(fen, depth = 14, engineMode = 'auto', options = {}) {
  if (engineMode === 'local') return getLocalEvalWithFallback(fen, depth);
  if (engineMode === 'web') return getWebEvalWithFallback(fen, depth, options);

  const local = await getLocalEval(fen, depth);
  if (local) return local;
  return getWebEvalWithFallback(fen, depth, options);
}

async function getWebEvalWithFallback(fen, depth, options = {}) {
  if (!options.bypassCooldown && !isEngineAvailable()) return { eval: estimateMaterialEval(fen), source: 'material' };
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
    const bestMoveLine = lines.find((line) => line.startsWith('bestmove ')) || '';
    return { eval: parseUciScore(bestLine), source: 'engine-local', depth, bestMove: parseUciBestMove(bestMoveLine) };
  } catch {
    return null;
  }
}

function parseUciBestMove(line) {
  const match = line.match(/^bestmove\s+([a-h][1-8][a-h][1-8][qrbn]?)/);
  return match ? match[1] : null;
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

function classifyMove({ evalDrop, evalSource, moveIndex, playerMatchedBestMove }) {
  if (evalSource !== 'material' && moveIndex <= 12 && playerMatchedBestMove && evalDrop <= 0.08) return 'book';
  if (evalDrop > 2.0) return 'blunder';
  if (evalDrop > 1.0) return 'mistake';
  if (evalDrop > 0.45) return 'inaccuracy';
  if (playerMatchedBestMove && evalDrop <= 0.03) return 'best';
  if (evalDrop <= 0.08) return evalSource === 'material' ? 'good' : 'excellent';
  if (evalDrop <= 0.18) return 'great';
  if (evalDrop <= 0.35) return 'good';
  return 'inaccuracy';
}

function toUciMove(move) {
  const promotion = move.promotion || '';
  return `${move.from}${move.to}${promotion}`;
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


function summarizeLineQuality(line) {
  if (!line.length) return 'limited';
  const hasMaterial = line.some((step) => step.source === 'material');
  return hasMaterial ? 'mixed' : 'engine';
}

function toSanFromUci(chess, uciMove) {
  const match = String(uciMove || '').match(/^([a-h][1-8])([a-h][1-8])([qrbn])?$/);
  if (!match) return null;
  const [, from, to, promotion] = match;
  try {
    const move = chess.move({ from, to, promotion });
    if (!move) return null;
    chess.undo();
    return move.san;
  } catch {
    return null;
  }
}


async function buildCandidateMovesFromFen(fen, engineMode, options = {}) {
  const chess = new Chess(fen);
  const legalMoves = chess.moves({ verbose: true });
  const isWhiteToMove = fen.split(' ')[1] === 'w';

  const scored = [];
  for (const move of legalMoves.slice(0, 18)) {
    chess.move(move);
    const evaluation = await getStockfishEval(chess.fen(), 13, engineMode, options);
    chess.undo();

    scored.push({
      uci: `${move.from}${move.to}${move.promotion || ''}`,
      san: move.san,
      eval: Number((evaluation.eval || 0).toFixed(2)),
      source: evaluation.source || 'unknown',
      concepts: inferMoveConcepts(move),
      variation: await buildCandidateVariation(fen, move, engineMode, options),
    });
  }

  scored.sort((a, b) => (isWhiteToMove ? b.eval - a.eval : a.eval - b.eval));
  return scored.slice(0, 5);
}

async function buildCandidateVariation(fen, move, engineMode, options = {}) {
  const chess = new Chess(fen);
  chess.move(move);
  const responseLine = await buildEngineLineFromFen(chess.fen(), engineMode, {
    ...options,
    maxPlies: 2,
  });
  return responseLine.line.map((step) => step.san);
}

function inferMoveConcepts(move) {
  const concepts = [];
  if (move.san.includes('x')) concepts.push('capture / sacrifice tension');
  if (move.san.includes('+') || move.san.includes('#')) concepts.push('forcing check sequence');
  if (move.piece === 'n' && (move.san.includes('+') || move.san.includes('x'))) concepts.push('possible fork motif');
  if (move.piece === 'b' || move.piece === 'r' || move.piece === 'q') concepts.push('pin / skewer pressure');
  if (['a3', 'h3', 'a6', 'h6', 'Kh1', 'Kh8'].includes(move.san)) concepts.push('prophylaxis');
  return concepts.slice(0, 2);
}

function inferPhaseFromFen(fen) {
  const board = fen.split(' ')[0];
  const nonPawnPieces = (board.match(/[nbrqNBRQ]/g) || []).length;
  if (nonPawnPieces >= 12) return 'opening';
  if (nonPawnPieces >= 6) return 'middlegame';
  return 'endgame';
}

function evaluatePositionSnapshot(fen) {
  const board = fen.split(' ')[0];
  const whiteMaterial = materialForSide(board, true);
  const blackMaterial = materialForSide(board, false);
  const sideToMove = fen.split(' ')[1] === 'w' ? 'white' : 'black';
  const materialEdge = Number((whiteMaterial - blackMaterial).toFixed(1));

  return {
    sideToMove,
    materialEdge,
    strengths: materialEdge >= 0 ? ['material parity or edge', 'initiative potential'] : ['counterplay chances'],
    weaknesses: materialEdge < 0 ? ['material deficit', 'must avoid trades'] : ['watch king safety and loose pieces'],
    threats: ['checks, captures, and tactical motifs (forks/pins/skewers)'],
    opportunities: ['improve worst piece', 'consider prophylaxis against opponent threats'],
  };
}

function materialForSide(board, whiteSide) {
  const values = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  return board.split('').reduce((sum, piece) => {
    const lower = piece.toLowerCase();
    if (!(lower in values)) return sum;
    const isWhite = piece === piece.toUpperCase();
    if (isWhite !== whiteSide) return sum;
    return sum + values[lower];
  }, 0);
}

function avg(numbers) {
  if (!numbers.length) return 0;
  return Math.round(numbers.reduce((sum, n) => sum + n, 0) / numbers.length);
}
