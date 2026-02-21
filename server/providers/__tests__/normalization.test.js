import { describe, expect, it } from 'vitest';
import chessComRawGame from '../../../src/test/fixtures/chesscom-game.json';
import lichessRawGame from '../../../src/test/fixtures/lichess-game.json';
import chessComPgn from '../../../src/test/fixtures/chesscom-game.pgn?raw';
import lichessPgn from '../../../src/test/fixtures/lichess-game.pgn?raw';
import { processChessComGame } from '../chesscom-provider';
import { processLichessGame } from '../lichess-provider';

describe('processChessComGame contract', () => {
  it('normalizes Chess.com payloads into internal game shape', () => {
    const game = processChessComGame({ ...chessComRawGame, pgn: chessComPgn }, 'CoachPlayer', 0);

    expect(game).toMatchObject({
      id: 'chesscom-abc123-def456',
      platform: 'chess.com',
      playerColor: 'white',
      opponent: 'Opponent123',
      result: 'win',
      timeControl: '10+5',
      date: '2024-01-15',
      opening: 'Kings Pawn Game',
      eco: 'C20',
    });
    expect(game.pgn).toContain('[Event "Live Chess"]');
  });
});

describe('processLichessGame contract', () => {
  it('normalizes Lichess payloads into internal game shape', () => {
    const game = processLichessGame({ ...lichessRawGame, pgn: lichessPgn }, 'CoachPlayer', 0);

    expect(game).toMatchObject({
      id: 'lichess-Zyx987Qw',
      platform: 'lichess',
      url: 'https://lichess.org/Zyx987Qw',
      playerColor: 'white',
      opponent: 'SharpTactics',
      result: 'loss',
      timeControl: '5+3',
      date: '2024-01-15',
      opening: 'Scandinavian Defense',
      eco: 'B01',
    });
    expect(game.pgn).toContain('[Opening "Scandinavian Defense"]');
  });
});
