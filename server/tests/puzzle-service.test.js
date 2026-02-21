import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildFallbackPuzzle,
  buildPersonalizedPuzzlePlan,
  getPuzzleProgress,
  normalizePuzzlePayload,
  recordPuzzleAttempt,
  resetProgressStore,
  resolvePuzzleTheme,
} from '../services/puzzle-service.js';

test('resolvePuzzleTheme maps unknown themes to short', () => {
  assert.equal(resolvePuzzleTheme('hangingPiece'), 'hangingPiece');
  assert.equal(resolvePuzzleTheme('unknown-theme'), 'short');
});

test('normalizePuzzlePayload returns fen and required fields', () => {
  const normalized = normalizePuzzlePayload(fixturePuzzle());
  assert.equal(normalized.id, 'abc123');
  assert.equal(normalized.solutionLine, 'h5f7');
  assert.equal(normalized.rating, 1123);
  assert.deepEqual(normalized.themeTags, ['short', 'mate']);
  assert.equal(normalized.fen, 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4');
});

test('recordPuzzleAttempt tracks completed count, streak and accuracy', () => {
  resetProgressStore();
  const p1 = recordPuzzleAttempt({ userKey: 'u1', pattern: 'short', solved: true, tries: 1, timeSpent: 12 });
  const p2 = recordPuzzleAttempt({ userKey: 'u1', pattern: 'short', solved: false, tries: 2, timeSpent: 30 });
  const current = getPuzzleProgress('u1', 'short');

  assert.equal(p1.completedCount, 1);
  assert.equal(p2.streak, 0);
  assert.equal(current.accuracy, 50);
  assert.equal(current.totalTries, 3);
  assert.equal(current.totalTimeSpent, 42);
});

function fixturePuzzle() {
  return {
    puzzle: {
      id: 'abc123',
      initialPly: 6,
      solution: ['h5f7'],
      rating: 1123,
      themes: ['short', 'mate'],
    },
    game: {
      pgn: '1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 *',
    },
  };
}


test('buildPersonalizedPuzzlePlan ranks themes from analyzed games and patterns', () => {
  const plan = buildPersonalizedPuzzlePlan({
    games: [
      {
        analysis: {
          blunders: 3,
          inaccuracies: 4,
          phases: { opening: 52, endgame: 40 },
        },
      },
      {
        analysis: {
          blunders: 1,
          inaccuracies: 2,
          phases: { opening: 63, endgame: 50 },
        },
      },
    ],
    patterns: [
      { puzzleTheme: 'endgame', severity: 'critical', frequency: 70, name: 'Weak Endgame Technique' },
      { puzzleTheme: 'opening', severity: 'moderate', frequency: 50, description: 'Opening preparation issues' },
    ],
  });

  assert.equal(plan.recommendedTheme, 'endgame');
  assert.equal(plan.targetPuzzleCount, 6);
  assert.equal(plan.rankedThemes[0].theme, 'endgame');
  assert.ok(plan.rankedThemes[0].score > plan.rankedThemes[1].score);
});


test('buildFallbackPuzzle returns deterministic local puzzle for unavailable upstream', () => {
  const fallback = buildFallbackPuzzle('endgame');
  assert.equal(fallback.id, 'fallback-endgame');
  assert.equal(fallback.toMove, 'white');
  assert.deepEqual(fallback.solution, ['d3d4']);
  assert.equal(fallback.isFallback, true);
});
