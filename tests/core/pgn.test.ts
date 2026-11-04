import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Game, PgnError, exportPgn, parsePgn, type GameResult } from '../../src/core/index.ts';

const DRAW: GameResult = { winner: null, reason: 'agreement', ply: 4 };

describe('PGN', () => {
  it('exports tags and numbered moves', () => {
    const game = Game.fromUci(['e2e4', 'e7e5', 'g1f3', 'b8c6']);
    const text = exportPgn({ startFen: game.startFen, moves: game.moves, result: DRAW });
    assert.match(text, /\[Result "1\/2-1\/2"\]/);
    assert.ok(text.endsWith('1. e4 e5 2. Nf3 Nc6 1/2-1/2\n'));
    assert.ok(!text.includes('[FEN'));
  });

  it('round-trips a game from a set-up position with Black to move', () => {
    const fen = '4k3/8/8/8/8/8/4P3/4K3 b - - 0 7';
    const game = Game.fromUci(['e8d7', 'e2e4'], fen);
    const result: GameResult = { winner: 'w', reason: 'resignation', ply: 2 };
    const text = exportPgn({ startFen: game.startFen, moves: game.moves, result });
    assert.match(text, /7\.\.\. Kd7 8\. e4 1-0/);
    const parsed = parsePgn(text);
    assert.equal(parsed.startFen, game.startFen);
    assert.deepEqual(parsed.moves, ['e8d7', 'e2e4']);
    assert.equal(parsed.result.winner, 'w');
  });

  it('reads comments, variations, glyphs and zero castling', () => {
    const parsed = parsePgn(`[White "A"]
[Result "0-1"]

1. e4 {best} e5 (1... c5 2. Nf3 (2. c3)) 2. Nf3! $1 Nc6?! 3. Bc4 Bc5 ; note
4. 0-0 Nf6 0-1`);
    assert.equal(parsed.moves.length, 8);
    assert.equal(parsed.moves[6], 'e1g1');
    assert.deepEqual(parsed.result, { winner: 'b', reason: 'imported', ply: 8 });
  });

  it('recognises a mate on the board and an unfinished game', () => {
    assert.equal(parsePgn('1. f3 e5 2. g4 Qh4# 0-1').result.reason, 'checkmate');
    assert.equal(parsePgn('1. e4 *').result.reason, 'unfinished');
  });

  it('rejects text that cannot be replayed', () => {
    assert.throws(() => parsePgn('1. e5'), PgnError);
    assert.throws(() => parsePgn('hello world'), PgnError);
    assert.throws(() => parsePgn(''), PgnError);
    assert.throws(() => parsePgn('[FEN "nonsense"]\n\n1. e4'), PgnError);
  });
});
