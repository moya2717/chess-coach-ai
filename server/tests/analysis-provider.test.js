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
  const analysis = await analyzeGameWithEngine(pgn, 'white', 'web');
  global.fetch = originalFetch;

  assert.equal(analysis.moves.length, 6);
  assert.equal(calls, 1);
  assert.equal(typeof analysis.accuracy, 'number');
});

test('analyzeGameWithEngine local mode avoids web fetch when stockfish binary is missing', async () => {
  const originalFetch = global.fetch;
  let calls = 0;
  global.fetch = async () => {
    calls += 1;
    return { ok: true };
  };

  const pgn = '1. d4 d5 2. c4 e6 3. Nc3 Nf6';
  const analysis = await analyzeGameWithEngine(pgn, 'white', 'local');
  global.fetch = originalFetch;

  assert.equal(analysis.moves.length, 6);
  assert.equal(calls, 0);
  assert.equal(typeof analysis.accuracy, 'number');
});


test('analyzeGameWithEngine marks opponent moves as book and avoids great spam on material fallback', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => {
    throw new Error('network down');
  };

  const pgn = '1. e4 e5 2. Nf3 Nc6 3. Bb5 a6';
  const analysis = await analyzeGameWithEngine(pgn, 'white', 'web');
  global.fetch = originalFetch;

  const opponentMoves = analysis.moves.filter((move) => !move.isPlayerMove);
  const playerMoves = analysis.moves.filter((move) => move.isPlayerMove);
  assert.ok(opponentMoves.every((move) => move.classification === 'book'));
  assert.ok(playerMoves.every((move) => move.classification !== 'great'));
});
