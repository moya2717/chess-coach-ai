import { Chess } from 'chess.js';

const THEME_MAP = Object.freeze({
  hangingPiece: 'hangingPiece',
  endgame: 'endgame',
  opening: 'opening',
  short: 'short',
});

const progressStore = new Map();

export function resolvePuzzleTheme(puzzleTheme) {
  if (!puzzleTheme) return 'short';
  return THEME_MAP[puzzleTheme] || 'short';
}

export function normalizePuzzlePayload(payload) {
  const fen = deriveFen(payload);
  const solution = payload?.puzzle?.solution || [];
  return {
    id: payload?.puzzle?.id || 'unknown',
    fen,
    toMove: fen.split(' ')[1] === 'w' ? 'white' : 'black',
    solution,
    solutionLine: solution.join(' '),
    rating: payload?.puzzle?.rating || 0,
    themeTags: payload?.puzzle?.themes || [],
  };
}

function deriveFen(payload) {
  const pgn = payload?.game?.pgn || '';
  const initialPly = payload?.puzzle?.initialPly || 0;
  const replay = new Chess();
  if (!pgn) return replay.fen();

  try {
    replay.loadPgn(pgn);
    const history = replay.history({ verbose: true });
    const position = new Chess();
    for (let i = 0; i < Math.min(initialPly, history.length); i += 1) {
      position.move(history[i]);
    }
    return position.fen();
  } catch {
    return new Chess().fen();
  }
}

export function getPuzzleProgress(userKey, pattern) {
  return { ...ensureProgress(userKey, pattern) };
}

export function recordPuzzleAttempt({ userKey, pattern, solved, tries = 1, timeSpent = 0 }) {
  const progress = ensureProgress(userKey, pattern);
  progress.attempts += 1;
  progress.completedCount += solved ? 1 : 0;
  progress.totalTries += Math.max(1, tries);
  progress.totalTimeSpent += Math.max(0, timeSpent);
  progress.streak = solved ? progress.streak + 1 : 0;
  progress.bestStreak = Math.max(progress.bestStreak, progress.streak);
  progress.accuracy = Math.round((progress.completedCount / progress.attempts) * 100);
  return { ...progress };
}

function ensureProgress(userKey, pattern) {
  const key = `${userKey || 'guest'}:${pattern || 'short'}`;
  if (!progressStore.has(key)) {
    progressStore.set(key, {
      userKey: userKey || 'guest',
      pattern: pattern || 'short',
      attempts: 0,
      completedCount: 0,
      streak: 0,
      bestStreak: 0,
      totalTries: 0,
      totalTimeSpent: 0,
      accuracy: 0,
    });
  }
  return progressStore.get(key);
}

export function resetProgressStore() {
  progressStore.clear();
}
