import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzeGame } from '../src/services/analysis.js';
import { AnalysisQueue } from './analysis-queue.js';
import { Persistence } from './persistence.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, '..', 'data', 'analysis-db.json');

const persistence = new Persistence(dbPath);
const queue = new AnalysisQueue({ persistence, analyzeGame });
await queue.init();

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'POST' && req.url === '/api/analysis/jobs') {
      const body = await parseJsonBody(req);
      const { gameId, pgn, playerColor = 'white', metadata = {} } = body || {};
      if (!gameId || !pgn) return sendJson(res, 400, { error: 'gameId and pgn are required' });

      const job = await queue.enqueue({ gameId, pgn, playerColor, metadata });
      return sendJson(res, 202, { jobId: job.jobId, status: job.status });
    }

    const match = req.url?.match(/^\/api\/analysis\/jobs\/([^/]+)$/);
    if (req.method === 'GET' && match) {
      const job = queue.getJob(match[1]);
      if (!job) return sendJson(res, 404, { error: 'Job not found' });
      return sendJson(res, 200, job);
    }

    return sendJson(res, 404, { error: 'Not found' });
  } catch (error) {
    return sendJson(res, 500, { error: error.message || 'Internal server error' });
  }
});

const port = process.env.PORT || 3001;
server.listen(port, () => {
  console.log(`Analysis queue API listening on port ${port}`);
});

function sendJson(res, statusCode, body) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

async function parseJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
