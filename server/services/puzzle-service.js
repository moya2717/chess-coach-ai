import { Chess } from 'chess.js';

const THEME_MAP = Object.freeze({
  hangingPiece: 'hangingPiece',
  endgame: 'endgame',
  opening: 'opening',
  short: 'short',
});

const progressStore = new Map();

const THEME_SIGNALS = Object.freeze({
  hangingPiece: ['hanging', 'blunder', 'undefended'],
  endgame: ['endgame', 'king and pawn', 'rook ending'],
  opening: ['opening', 'theory', 'development'],
  short: ['tactic', 'fork', 'pin', 'skewer'],
});

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

export function buildPersonalizedPuzzlePlan({ games = [], patterns = [] } = {}) {
  const scores = { hangingPiece: 0, endgame: 0, opening: 0, short: 0 };
  const totalGames = games.length || 1;

  for (const game of games) {
    const analysis = game.analysis || {};
    const phases = analysis.phases || {};
    scores.hangingPiece += Math.min(analysis.blunders || 0, 4) * 4;
    scores.short += Math.min(analysis.inaccuracies || 0, 6) * 2;
    scores.opening += Math.max(0, 70 - (phases.opening || 70));
    scores.endgame += Math.max(0, 70 - (phases.endgame || 70));
  }

  for (const pattern of patterns) {
    const theme = resolvePuzzleTheme(pattern?.puzzleTheme);
    if (!scores[theme]) continue;
    const frequencyBoost = Math.round((pattern.frequency || 0) / 10);
    const severityBoost = pattern.severity === 'critical' ? 8 : 4;
    scores[theme] += frequencyBoost + severityBoost;
    scores[theme] += scorePatternTextSignal(pattern?.name);
    scores[theme] += scorePatternTextSignal(pattern?.description);
  }

  const rankedThemes = Object.entries(scores)
    .map(([theme, score]) => ({
      theme,
      score,
      share: Math.round((score / Math.max(totalScore(scores), 1)) * 100),
    }))
    .sort((a, b) => b.score - a.score);

  return {
    recommendedTheme: rankedThemes[0]?.theme || 'short',
    rankedThemes,
    targetPuzzleCount: Math.max(6, Math.min(20, totalGames * 2)),
  };
}

function totalScore(scores) {
  return Object.values(scores).reduce((sum, value) => sum + value, 0);
}

function scorePatternTextSignal(text) {
  if (!text || typeof text !== 'string') return 0;
  const lower = text.toLowerCase();
  let score = 0;
  for (const signals of Object.values(THEME_SIGNALS)) {
    for (const signal of signals) {
      if (lower.includes(signal)) {
        score += 1;
      }
    }
  }
  return score;
}


export function buildFallbackPuzzle(theme = 'short') {
  const mapped = resolvePuzzleTheme(theme);
  const starter = {
    short: {
      fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4',
      solution: ['h5f7'],
      rating: 900,
      tags: ['short', 'mate'],
    },
    hangingPiece: {
      fen: 'rnbqkbnr/pppp1ppp/8/4p3/3P4/5N2/PPP1PPPP/RNBQKB1R b KQkq - 1 2',
      solution: ['e5d4'],
      rating: 950,
      tags: ['hangingPiece', 'opening'],
    },
    opening: {
      fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 2 3',
      solution: ['g8f6'],
      rating: 1000,
      tags: ['opening'],
    },
    endgame: {
      fen: '8/8/3k4/3P4/8/3K4/8/8 w - - 0 1',
      solution: ['d3d4'],
      rating: 1100,
      tags: ['endgame', 'kingAndPawn'],
    },
  };
  const puzzle = starter[mapped] || starter.short;
  return {
    id: `fallback-${mapped}`,
    fen: puzzle.fen,
    toMove: puzzle.fen.split(' ')[1] === 'w' ? 'white' : 'black',
    solution: puzzle.solution,
    solutionLine: puzzle.solution.join(' '),
    rating: puzzle.rating,
    themeTags: puzzle.tags,
    isFallback: true,
  };
}
