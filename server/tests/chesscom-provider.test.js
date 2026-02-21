import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchChesscomRecentGames } from '../providers/chesscom-provider.js';

test('fetchChesscomRecentGames maps upstream games to app format', async () => {
  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    const value = String(url);
    if (value.includes('/archives')) {
      return okJson({ archives: ['https://api.chess.com/pub/player/demo/games/2024/01'] });
    }
    return okJson({
      games: [{
        uuid: 'g1',
        white: { username: 'demo', rating: 1500, result: 'win' },
        black: { username: 'opp', rating: 1490, result: 'checkmated' },
        pgn: '[ECO "C20"]\n[Opening "King Pawn Game"]',
        url: 'https://chess.com/game/1',
        time_control: '600+5',
        time_class: 'rapid',
        rated: true,
        rules: 'chess',
        end_time: 1704067200,
      }],
    });
  };

  const games = await fetchChesscomRecentGames('demo', 1);
  global.fetch = originalFetch;

  assert.equal(games.length, 1);
  assert.equal(games[0].id, 'chesscom-g1');
  assert.equal(games[0].platform, 'chess.com');
  assert.equal(games[0].result, 'win');
  assert.equal(games[0].timeControl, 'Rapid');
  assert.equal(games[0].eco, 'C20');
});

test('fetchChesscomRecentGames excludes coach and bot games from pulled data', async () => {
  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    const value = String(url);
    if (value.includes('/archives')) {
      return okJson({ archives: ['https://api.chess.com/pub/player/demo/games/2024/01'] });
    }
    return okJson({
      games: [
        {
          uuid: 'g2',
          white: { username: 'demo', rating: 1500, result: 'win' },
          black: { username: 'Coach_Bot', rating: 1600, result: 'checkmated' },
          pgn: '[ECO "C20"]\n[Opening "King Pawn Game"]',
          url: 'https://chess.com/game/2',
          time_control: '600+5',
          time_class: 'blitz',
          rated: true,
          rules: 'chess',
          end_time: 1704067201,
        },
        {
          uuid: 'g3',
          white: { username: 'demo', rating: 1500, result: 'win' },
          black: { username: 'real_opp', rating: 1490, result: 'checkmated' },
          pgn: '[ECO "C44"]\n[Opening "Scotch Game"]',
          url: 'https://chess.com/game/3',
          time_control: '600+5',
          time_class: 'blitz',
          rated: true,
          rules: 'chess',
          end_time: 1704067202,
        },
      ],
    });
  };

  const games = await fetchChesscomRecentGames('demo', 2);
  global.fetch = originalFetch;

  assert.equal(games.length, 1);
  assert.equal(games[0].id, 'chesscom-g3');
  assert.equal(games[0].opponent, 'real_opp');
});

test('fetchChesscomRecentGames keeps only games that include the requested username', async () => {
  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    const value = String(url);
    if (value.includes('/archives')) {
      return okJson({ archives: ['https://api.chess.com/pub/player/demo/games/2024/01'] });
    }
    return okJson({
      games: [
        {
          uuid: 'g4',
          white: { username: 'third_party', rating: 1500, result: 'win' },
          black: { username: 'another_user', rating: 1490, result: 'checkmated' },
          pgn: '[ECO "C20"]\n[Opening "King Pawn Game"]',
          url: 'https://chess.com/game/4',
          time_control: '600+5',
          time_class: 'rapid',
          rated: true,
          rules: 'chess',
          end_time: 1704067203,
        },
        {
          uuid: 'g5',
          white: { username: 'Demo', rating: 1500, result: 'win' },
          black: { username: 'real_opp', rating: 1490, result: 'checkmated' },
          pgn: '[ECO "C44"]\n[Opening "Scotch Game"]',
          url: 'https://chess.com/game/5',
          time_control: '600+5',
          time_class: 'rapid',
          rated: true,
          rules: 'chess',
          end_time: 1704067204,
        },
      ],
    });
  };

  const games = await fetchChesscomRecentGames('@demo', 2);
  global.fetch = originalFetch;

  assert.equal(games.length, 1);
  assert.equal(games[0].id, 'chesscom-g5');
  assert.equal(games[0].playerColor, 'white');
});

function okJson(payload) {
  return {
    ok: true,
    status: 200,
    async json() { return payload; },
  };
}


test('fetchChesscomRecentGames includes only rated daily/rapid/blitz/bullet chess games', async () => {
  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    const value = String(url);
    if (value.includes('/archives')) {
      return okJson({ archives: ['https://api.chess.com/pub/player/demo/games/2024/01'] });
    }
    return okJson({
      games: [
        {
          uuid: 'g6',
          white: { username: 'demo', rating: 1500, result: 'win' },
          black: { username: 'opp1', rating: 1490, result: 'checkmated' },
          pgn: '',
          url: 'https://chess.com/game/6',
          time_control: '1/86400',
          time_class: 'daily',
          rated: true,
          rules: 'chess',
          end_time: 1704067205,
        },
        {
          uuid: 'g7',
          white: { username: 'demo', rating: 1500, result: 'win' },
          black: { username: 'opp2', rating: 1490, result: 'checkmated' },
          pgn: '',
          url: 'https://chess.com/game/7',
          time_control: '180+0',
          time_class: 'blitz',
          rated: false,
          rules: 'chess',
          end_time: 1704067206,
        },
        {
          uuid: 'g8',
          white: { username: 'demo', rating: 1500, result: 'win' },
          black: { username: 'opp3', rating: 1490, result: 'checkmated' },
          pgn: '',
          url: 'https://chess.com/game/8',
          time_control: '180+0',
          time_class: 'blitz',
          rated: true,
          rules: 'chess960',
          end_time: 1704067207,
        },
      ],
    });
  };

  const games = await fetchChesscomRecentGames('demo', 3);
  global.fetch = originalFetch;

  assert.equal(games.length, 1);
  assert.equal(games[0].id, 'chesscom-g6');
  assert.equal(games[0].timeControl, 'Daily');
});
