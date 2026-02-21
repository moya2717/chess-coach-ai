import test from 'node:test';
import assert from 'node:assert/strict';
import { TTLCache } from '../lib/cache.js';

test('TTLCache returns value before expiration', () => {
  const cache = new TTLCache(1000);
  cache.set('k1', { value: 42 });
  assert.deepEqual(cache.get('k1'), { value: 42 });
});

test('TTLCache expires stale entries', async () => {
  const cache = new TTLCache(5);
  cache.set('k2', 'payload', 5);
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(cache.get('k2'), null);
});
