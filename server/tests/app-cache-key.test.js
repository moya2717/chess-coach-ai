import test from 'node:test';
import assert from 'node:assert/strict';
import { createAnalysisCacheKey } from '../app.js';

test('createAnalysisCacheKey includes pgn hash to avoid cache collisions', () => {
  const base = {
    playerColor: 'white',
    engineMode: 'auto',
    cacheKey: 'https://www.chess.com/game/live/123',
  };

  const keyA = createAnalysisCacheKey({ ...base, pgn: '[Event "A"]\n1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 *' });
  const keyB = createAnalysisCacheKey({ ...base, pgn: '[Event "B"]\n1. d4 d5 2. c4 e6 3. Nc3 Nf6 *' });

  assert.notEqual(keyA, keyB);
});

test('createAnalysisCacheKey is stable for identical input', () => {
  const params = {
    pgn: '[Event "Stable"]\n1. e4 c5 2. Nf3 d6 3. d4 cxd4 *',
    playerColor: 'black',
    engineMode: 'web',
    cacheKey: 'https://lichess.org/abc123',
  };

  assert.equal(createAnalysisCacheKey(params), createAnalysisCacheKey(params));
});
