import { randomUUID } from 'node:crypto';

export class AnalysisQueue {
  constructor({ persistence, analyzeGame }) {
    this.persistence = persistence;
    this.analyzeGame = analyzeGame;
    this.jobs = new Map();
    this.queue = [];
    this.completedByGameId = new Map();
    this.processing = false;
  }

  async init() {
    const db = await this.persistence.read();
    this.completedByGameId = new Map(Object.entries(db.completedByGameId || {}));

    for (const [id, job] of Object.entries(db.jobs || {})) {
      if (job.status === 'completed' || job.status === 'failed') {
        this.jobs.set(id, job);
      } else {
        const resetJob = { ...job, status: 'queued', error: null };
        this.jobs.set(id, resetJob);
        this.queue.push(id);
      }
    }

    this.processNext();
  }

  async enqueue(payload) {
    const cached = this.completedByGameId.get(payload.gameId);
    if (cached) {
      const completedJob = this.createCachedJob(payload, cached);
      this.jobs.set(completedJob.jobId, completedJob);
      await this.persist();
      return completedJob;
    }

    const jobId = randomUUID();
    const job = {
      jobId,
      gameId: payload.gameId,
      status: 'queued',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      progress: { processedMoves: 0, totalMoves: 0 },
      result: null,
      error: null,
      payload,
    };

    this.jobs.set(jobId, job);
    this.queue.push(jobId);
    await this.persist();
    this.processNext();
    return this.publicJob(job);
  }

  getJob(jobId) {
    const job = this.jobs.get(jobId);
    return job ? this.publicJob(job) : null;
  }

  createCachedJob(payload, result) {
    const now = new Date().toISOString();
    return {
      jobId: randomUUID(),
      gameId: payload.gameId,
      status: 'completed',
      createdAt: now,
      updatedAt: now,
      progress: {
        processedMoves: result.moves?.length || 0,
        totalMoves: result.moves?.length || 0,
      },
      result,
      error: null,
    };
  }

  async processNext() {
    if (this.processing || this.queue.length === 0) return;
    this.processing = true;

    const jobId = this.queue.shift();
    const job = this.jobs.get(jobId);

    if (job) {
      try {
        await this.runJob(job);
      } catch (error) {
        job.status = 'failed';
        job.error = error.message;
        job.updatedAt = new Date().toISOString();
      }
      await this.persist();
    }

    this.processing = false;
    this.processNext();
  }

  async runJob(job) {
    job.status = 'processing';
    job.updatedAt = new Date().toISOString();
    await this.persist();

    const result = await this.analyzeGame(job.payload.pgn, job.payload.playerColor, {
      onProgress: async ({ processedMoves, totalMoves }) => {
        job.progress = { processedMoves, totalMoves };
        job.updatedAt = new Date().toISOString();
        await this.persist();
      },
    });

    job.status = 'completed';
    job.result = result;
    job.progress = {
      processedMoves: result.moves?.length || 0,
      totalMoves: result.moves?.length || 0,
    };
    job.updatedAt = new Date().toISOString();
    this.completedByGameId.set(job.gameId, result);
  }

  publicJob(job) {
    const { payload, ...safeJob } = job;
    return safeJob;
  }

  async persist() {
    const jobs = Object.fromEntries(this.jobs.entries());
    const completedByGameId = Object.fromEntries(this.completedByGameId.entries());
    await this.persistence.write({ jobs, completedByGameId });
  }
}
