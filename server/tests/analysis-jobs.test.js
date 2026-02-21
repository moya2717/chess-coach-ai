import test from 'node:test';
import assert from 'node:assert/strict';
import { enqueueAnalysisJob, getAnalysisJob } from '../services/analysis-jobs.js';

test('analysis job transitions to completed with deterministic payload shape', async () => {
  const pgn = '1. e4 e5 2. Nf3 Nc6 3. Bb5 a6';
  const job = enqueueAnalysisJob({ pgn, playerColor: 'white', engineMode: 'local' });
  assert.equal(job.status, 'queued');

  let current = getAnalysisJob(job.id);
  for (let i = 0; i < 40 && current?.status !== 'completed'; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 20));
    current = getAnalysisJob(job.id);
  }

  assert.equal(current?.status, 'completed');
  assert.equal(Array.isArray(current?.result?.moves), true);
  assert.equal(typeof current?.result?.accuracy, 'number');
});
