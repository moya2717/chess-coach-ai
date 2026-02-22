import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHandler } from '../app.js';

function makeRequest(url) {
  return { method: 'GET', url };
}

function makeResponse() {
  return {
    status: 0,
    headers: {},
    body: '',
    writeHead(status, headers) {
      this.status = status;
      this.headers = headers;
    },
    end(payload) {
      this.body = payload;
    },
  };
}

test('api health endpoint responds with ok payload for frontend reachability checks', async () => {
  const handler = createHandler();
  const res = makeResponse();
  await handler(makeRequest('/api/health'), res);
  const payload = JSON.parse(res.body);

  assert.equal(res.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.service, 'chess-coach-api');
  assert.equal(typeof payload.timestamp, 'string');
});

test('vercel rewrites preserve /api/* and route non-api paths to index.html', async () => {
  const raw = await readFile(new URL('../../vercel.json', import.meta.url), 'utf8');
  const vercelConfig = JSON.parse(raw);

  assert.deepEqual(vercelConfig.rewrites, [
    { source: '/api/(.*)', destination: '/api/$1' },
    { source: '/(.*)', destination: '/index.html' },
  ]);
});

test('vite dev proxy forwards /api to local backend host', async () => {
  const raw = await readFile(new URL('../../vite.config.js', import.meta.url), 'utf8');

  assert.match(raw, /target:\s*'http:\/\/localhost:3001'/);
});
