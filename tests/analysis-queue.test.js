import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { AnalysisQueue } from '../server/analysis-queue.js';
import { Persistence } from '../server/persistence.js';

function fixtureAnalyzer(result) {
  return async (_pgn, _color, options = {}) => {
    options.onProgress?.({ processedMoves: 1, totalMoves: 2 });
    options.onProgress?.({ processedMoves: 2, totalMoves: 2 });
    return result;
  };
}

test('processes queued jobs and persists completed analyses by gameId', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'analysis-queue-'));
  const filePath = path.join(dir, 'db.json');
  const persistence = new Persistence(filePath);
  const result = { moves: [{ san: 'e4' }, { san: 'e5' }], accuracy: 88 };
  const queue = new AnalysisQueue({ persistence, analyzeGame: fixtureAnalyzer(result) });

  await queue.init();
  const created = await queue.enqueue({ gameId: 'game-1', pgn: '1. e4 e5', playerColor: 'white' });
  await waitForJob(queue, created.jobId);

  const first = queue.getJob(created.jobId);
  assert.equal(first.status, 'completed');
  assert.equal(first.progress.processedMoves, 2);

  const cached = await queue.enqueue({ gameId: 'game-1', pgn: '1. e4 e5', playerColor: 'white' });
  assert.equal(cached.status, 'completed');

  const db = JSON.parse(await fs.readFile(filePath, 'utf8'));
  assert.ok(db.completedByGameId['game-1']);
});

async function waitForJob(queue, jobId) {
  for (let i = 0; i < 40; i++) {
    const job = queue.getJob(jobId);
    if (job?.status === 'completed' || job?.status === 'failed') return job;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error('Job did not finish in time');
}
