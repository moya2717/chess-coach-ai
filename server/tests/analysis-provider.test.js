import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeGameWithEngine, buildEngineLineFromFen } from '../providers/analysis-provider.js';

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

test('analyzeGameWithEngine emits varied move classifications with engine best-move context', async () => {
  const originalFetch = global.fetch;
  const originalNow = Date.now;
  Date.now = () => originalNow() + 10 * 60_000;
  const responses = [
    { eval: 25, move: 'e2e4' },
    { eval: 10, move: 'e7e5' },
    { eval: 28, move: 'g1f3' },
    { eval: 30, move: 'b8c6' },
    { eval: 28, move: 'f1b5' },
    { eval: -30, move: 'a7a6' },
    { eval: -320, move: 'b5a4' },
  ];

  global.fetch = async () => {
    const next = responses.shift() || { eval: 0, move: 'a2a3' };
    return {
      ok: true,
      json: async () => next,
    };
  };

  const pgn = '1. e4 e5 2. Nf3 Nc6 3. Bb5 a6';
  const analysis = await analyzeGameWithEngine(pgn, 'white', 'web');
  global.fetch = originalFetch;
  Date.now = originalNow;

  const playerMoves = analysis.moves.filter((move) => move.isPlayerMove);
  assert.deepEqual(
    playerMoves.map((move) => move.classification),
    ['great', 'book', 'inaccuracy'],
  );
  assert.equal(playerMoves[1].bestMove, 'g1f3');
  assert.equal(playerMoves[1].playerMatchedBestMove, true);
  assert.equal(typeof playerMoves[0].beforeEval, 'number');
  assert.equal(typeof playerMoves[0].evalSwing, 'number');
});


test('analyzeGameWithEngine returns analysis quality metadata', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => {
    throw new Error('network down');
  };

  const pgn = '1. e4 e5 2. Nf3 Nc6 3. Bb5 a6';
  const analysis = await analyzeGameWithEngine(pgn, 'white', 'web');
  global.fetch = originalFetch;

  assert.equal(analysis.quality.primarySource, 'material');
  assert.equal(typeof analysis.quality.engineShare, 'number');
  assert.equal(analysis.quality.needsRefinement, true);
});


test('analyzeGameWithEngine bypasses cooldown when explicitly forced', async () => {
  const originalFetch = global.fetch;
  const originalNow = Date.now;
  Date.now = () => originalNow() + 10 * 60_000;

  let calls = 0;
  global.fetch = async () => {
    calls += 1;
    if (calls === 1) {
      throw new Error('network down');
    }
    return {
      ok: true,
      json: async () => ({ eval: 22, move: 'e2e4' }),
    };
  };

  const pgn = '1. e4 e5 2. Nf3 Nc6 3. Bb5 a6';
  await analyzeGameWithEngine(pgn, 'white', 'web');
  const callsAfterFirstRun = calls;
  await analyzeGameWithEngine(pgn, 'white', 'web', { bypassCooldown: true });

  global.fetch = originalFetch;
  Date.now = originalNow;

  assert.equal(callsAfterFirstRun, 1);
  assert.ok(calls > callsAfterFirstRun);
});


test('buildEngineLineFromFen returns deterministic continuation line', async () => {
  const originalFetch = global.fetch;
  const responses = [
    { eval: 20, move: 'e2e4' },
    { eval: 12, move: 'e7e5' },
    { eval: 35, move: 'g1f3' },
  ];

  global.fetch = async () => {
    const next = responses.shift() || { eval: 0, move: null };
    return {
      ok: true,
      json: async () => next,
    };
  };

  const line = await buildEngineLineFromFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 'web', {
    maxPlies: 3,
    bypassCooldown: true,
  });

  global.fetch = originalFetch;

  assert.equal(line.line.length, 3);
  assert.deepEqual(line.line.map((step) => step.san), ['e4', 'e5', 'Nf3']);
  assert.equal(line.quality, 'engine');
});
