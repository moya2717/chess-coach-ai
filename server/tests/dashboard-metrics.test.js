import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTrendSeries, computeDeltaSummary, formatDelta } from '../../src/services/dashboard-metrics.js';

const NOW = Date.parse('2026-02-20T00:00:00.000Z');

function makeRun(daysAgo, metrics) {
  return {
    createdAt: new Date(NOW - daysAgo * 24 * 60 * 60 * 1000).toISOString(),
    metrics,
  };
}

test('buildTrendSeries sorts by createdAt asc and maps metric fields', () => {
  const runs = [
    makeRun(2, { accuracy: 70, blundersPerGame: 1.3, phaseWeakness: { opening: 22, endgame: 35 } }),
    makeRun(5, { accuracy: 65, blundersPerGame: 1.8, phaseWeakness: { opening: 28, endgame: 40 } }),
  ];

  const trend = buildTrendSeries(runs);

  assert.equal(trend[0].accuracy, 65);
  assert.equal(trend[1].blundersPerGame, 1.3);
  assert.equal(trend[1].endgameWeakness, 35);
});

test('computeDeltaSummary compares last 30 days to previous 30 days', () => {
  const runs = [
    makeRun(10, { accuracy: 80, blundersPerGame: 1, phaseWeakness: { opening: 15, endgame: 20 } }),
    makeRun(20, { accuracy: 76, blundersPerGame: 1.2, phaseWeakness: { opening: 18, endgame: 24 } }),
    makeRun(40, { accuracy: 70, blundersPerGame: 2, phaseWeakness: { opening: 30, endgame: 38 } }),
    makeRun(50, { accuracy: 72, blundersPerGame: 1.8, phaseWeakness: { opening: 26, endgame: 34 } }),
  ];

  const delta = computeDeltaSummary(runs, NOW);

  assert.equal(Math.round(delta.accuracy * 10) / 10, 7);
  assert.equal(Math.round(delta.blundersPerGame * 10) / 10, -0.8);
  assert.equal(Math.round(delta.openingWeakness * 10) / 10, -11.5);
  assert.equal(Math.round(delta.endgameWeakness * 10) / 10, -14);
});

test('formatDelta handles positive, negative, and unavailable values', () => {
  assert.equal(formatDelta(1.25, '%'), '+1.3%');
  assert.equal(formatDelta(-0.44, ''), '-0.4');
  assert.equal(formatDelta(Number.NaN, '%'), 'N/A');
});
