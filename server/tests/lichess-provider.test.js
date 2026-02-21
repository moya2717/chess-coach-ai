import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchLichessRecentGames } from '../providers/lichess-provider.js';

test('fetchLichessRecentGames excludes coach games from pulled data', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => okText([
    JSON.stringify({
      id: 'a1',
      createdAt: '2026-01-01T00:00:00.000Z',
      players: {
        white: { user: { name: 'demo' }, rating: 1800 },
        black: { user: { name: 'CoachTrainer' }, rating: 1900 },
      },
      winner: 'white',
      pgn: '1. e4 e5',
      clock: { initial: 600, increment: 5 },
      opening: { name: 'Italian Game', eco: 'C50' },
      analysis: [],
    }),
    JSON.stringify({
      id: 'a2',
      createdAt: '2026-01-02T00:00:00.000Z',
      players: {
        white: { user: { name: 'demo' }, rating: 1800 },
        black: { user: { name: 'solidOpponent' }, rating: 1820 },
      },
      winner: 'black',
      pgn: '1. d4 Nf6',
      clock: { initial: 600, increment: 5 },
      opening: { name: 'Indian Game', eco: 'A45' },
      analysis: [],
    }),
  ].join('\n'));

  const games = await fetchLichessRecentGames('demo', 2);
  global.fetch = originalFetch;

  assert.equal(games.length, 1);
  assert.equal(games[0].id, 'lichess-a2');
  assert.equal(games[0].opponent, 'solidOpponent');
});

function okText(payload) {
  return {
    ok: true,
    status: 200,
    async text() { return payload; },
  };
}
