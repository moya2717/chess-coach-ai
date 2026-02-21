import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMoveCoachExplanation } from '../services/coach-explanations.js';

test('buildMoveCoachExplanation returns deterministic summary fields', () => {
  const result = buildMoveCoachExplanation({
    san: 'Qh5',
    classification: 'inaccuracy',
    evalDrop: 0.8,
    phase: 'opening',
    tacticTags: ['fork'],
    candidatePlans: ['Develop and castle quickly.'],
  });

  assert.equal(typeof result.headline, 'string');
  assert.equal(result.explanation.includes('fork'), true);
  assert.equal(result.nextStep, 'Try this plan: Develop and castle quickly.');
});
