import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeGameWithEngine } from '../providers/analysis-provider.js';

test('analyzeGameWithEngine stops calling remote engine after first failure', async () => {
  const originalFetch = global.fetch;
  let calls = 0;
  global.fetch = async () => {
    calls += 1;
    throw new Error('network down');
  };

  const pgn = '1. e4 e5 2. Nf3 Nc6 3. Bb5 a6';
  const analysis = await analyzeGameWithEngine(pgn, 'white');
  global.fetch = originalFetch;

  assert.equal(analysis.moves.length, 6);
  assert.equal(calls, 1);
  assert.equal(typeof analysis.accuracy, 'number');
});
