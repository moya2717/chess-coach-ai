import test from 'node:test';
import assert from 'node:assert/strict';
import { requestWithRetry } from '../lib/http-client.js';

test('requestWithRetry retries 429 and succeeds on next attempt', async () => {
  const originalFetch = global.fetch;
  let calls = 0;

  global.fetch = async () => {
    calls += 1;
    if (calls === 1) {
      return {
        ok: false,
        status: 429,
      };
    }

    return {
      ok: true,
      json: async () => ({ ok: true }),
    };
  };

  const payload = await requestWithRetry('https://example.com/test', {
    retries: 1,
    backoffMs: 1,
  });

  global.fetch = originalFetch;

  assert.equal(calls, 2);
  assert.deepEqual(payload, { ok: true });
});

test('requestWithRetry surfaces retryable upstream 429 after final attempt', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({ ok: false, status: 429 });

  await assert.rejects(
    () => requestWithRetry('https://example.com/test', { retries: 0 }),
    (error) => error?.code === 'UPSTREAM_ERROR' && error?.retryable === true && error?.status === 429,
  );

  global.fetch = originalFetch;
});
