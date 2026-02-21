import test from 'node:test';
import assert from 'node:assert/strict';
import {
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
