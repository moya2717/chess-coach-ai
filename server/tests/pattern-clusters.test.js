import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPatternClusters } from '../services/pattern-clusters.js';

test('buildPatternClusters returns top themes payload', async () => {
  const games = [
    { analysis: { blunders: 2, mistakes: 2, inaccuracies: 2, phases: { opening: 55, middlegame: 62, endgame: 58 } } },
    { analysis: { blunders: 1, mistakes: 1, inaccuracies: 3, phases: { opening: 60, middlegame: 64, endgame: 57 } } },
    { analysis: { blunders: 0, mistakes: 1, inaccuracies: 1, phases: { opening: 72, middlegame: 68, endgame: 52 } } },
  ];

  const payload = await buildPatternClusters(games);
  assert.equal(Array.isArray(payload.themes), true);
  assert.equal(payload.themes.length > 0, true);
  assert.equal(typeof payload.themes[0].theme, 'string');
  assert.equal(typeof payload.themes[0].frequency, 'number');
});
