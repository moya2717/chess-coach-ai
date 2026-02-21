import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectTrainingTheme,
  formatPunishmentLine,
  isCriticalMove,
  toSanFromUci,
} from '../../src/services/critical-moments.js';

test('isCriticalMove only includes player inaccuracies/mistakes/blunders', () => {
  assert.equal(isCriticalMove({ isPlayerMove: true, classification: 'blunder' }), true);
  assert.equal(isCriticalMove({ isPlayerMove: true, classification: 'mistake' }), true);
  assert.equal(isCriticalMove({ isPlayerMove: true, classification: 'inaccuracy' }), true);
  assert.equal(isCriticalMove({ isPlayerMove: false, classification: 'blunder' }), false);
  assert.equal(isCriticalMove({ isPlayerMove: true, classification: 'good' }), false);
});

test('toSanFromUci converts legal move from FEN', () => {
  const fen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
  assert.equal(toSanFromUci(fen, 'e7e5'), 'e5');
  assert.equal(toSanFromUci(fen, 'a1a8'), null);
});

test('formatPunishmentLine formats SAN sequence', () => {
  const line = [{ san: 'Qh5+' }, { san: 'g6' }, { san: 'Qxe5+' }];
  assert.equal(formatPunishmentLine(line), '1. Qh5+ · 2. g6 · 3. Qxe5+');
  assert.equal(formatPunishmentLine([]), 'No forcing punishment found at current depth.');
});

test('detectTrainingTheme derives stable tactical labels', () => {
  assert.equal(detectTrainingTheme({ classification: 'mistake', evalDrop: 0.6 }, [{ san: 'Qh7#' }]), 'back-rank');
  assert.equal(detectTrainingTheme({ classification: 'mistake', evalDrop: 0.6 }, [{ san: 'Nf7+' }]), 'fork');
  assert.equal(detectTrainingTheme({ classification: 'mistake', evalDrop: 0.6 }, [{ san: 'Bb5+' }]), 'pin');
  assert.equal(detectTrainingTheme({ classification: 'blunder', evalDrop: 2.5, san: 'h3' }, []), 'hanging');
});
