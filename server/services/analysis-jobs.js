import { randomUUID } from 'node:crypto';
import { analyzeGameWithEngine } from '../providers/analysis-provider.js';

const JOB_TTL_MS = 20 * 60_000;
const jobs = new Map();

export function enqueueAnalysisJob({ pgn, playerColor = 'white', engineMode = 'auto' }) {
  const now = Date.now();
  purgeExpiredJobs(now);

  const id = randomUUID();
  const job = {
    id,
    status: 'queued',
    progress: 0,
    createdAt: new Date(now).toISOString(),
    updatedAt: new Date(now).toISOString(),
    input: { playerColor, engineMode },
    result: null,
    error: null,
  };

  jobs.set(id, job);
  queueMicrotask(() => runJob(id, { pgn, playerColor, engineMode }));
  return job;
}

export function getAnalysisJob(id = '') {
  const job = jobs.get(String(id));
  if (!job) return null;
  return { ...job };
}

async function runJob(id, { pgn, playerColor, engineMode }) {
  const job = jobs.get(id);
  if (!job) return;

  markJob(job, { status: 'running', progress: 10 });
  try {
    const result = await analyzeGameWithEngine(pgn, playerColor, engineMode, { bypassCooldown: true });
    markJob(job, { status: 'completed', progress: 100, result });
  } catch (error) {
    markJob(job, {
      status: 'failed',
      progress: 100,
      error: error?.message || 'Analysis failed',
    });
  }
}

function markJob(job, updates) {
  Object.assign(job, updates, { updatedAt: new Date().toISOString() });
}

function purgeExpiredJobs(now = Date.now()) {
  for (const [id, job] of jobs.entries()) {
    if (now - Date.parse(job.updatedAt) > JOB_TTL_MS) jobs.delete(id);
  }
}
