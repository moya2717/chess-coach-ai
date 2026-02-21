import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  createPersistedAnalysisRun,
  listPersistedAnalysisRuns,
} from '../services/analysis-runs-store.js';

test('analysis runs persist and are listed newest-first for a user', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'analysis-runs-'));
  const original = process.env.ANALYSIS_RUNS_FILE;
  process.env.ANALYSIS_RUNS_FILE = path.join(tempDir, 'runs.json');

  try {
    const baseGame = {
    analysis: {
      accuracy: 80,
      blunders: 1,
      phases: { opening: 70, middlegame: 75, endgame: 72 },
    },
  };

  await createPersistedAnalysisRun({
    userId: 'u1',
    usernames: { lichess: 'alpha' },
    games: [baseGame],
    patterns: [{ severity: 'critical' }],
  });

  await new Promise((r) => setTimeout(r, 2));

  await createPersistedAnalysisRun({
    userId: 'u1',
    usernames: { lichess: 'alpha' },
    games: [{ ...baseGame, analysis: { ...baseGame.analysis, accuracy: 82 } }],
    patterns: [],
  });

  await createPersistedAnalysisRun({
    userId: 'u2',
    usernames: { lichess: 'other' },
    games: [baseGame],
    patterns: [],
  });

    const runs = await listPersistedAnalysisRuns('u1');

    assert.equal(runs.length, 2);
    assert.equal(runs[0].userId, 'u1');
    assert.equal(runs[0].metrics.accuracy, 82);
    assert.equal(runs[1].metrics.accuracy, 80);
  } finally {
    process.env.ANALYSIS_RUNS_FILE = original;
    await rm(tempDir, { recursive: true, force: true });
  }
});
