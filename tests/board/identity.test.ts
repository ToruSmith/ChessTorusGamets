import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { fromCell, squareFromPoint, toCell } from '../../src/board/geometry.ts';
import { trackIdentity, type TrackedPiece } from '../../src/board/identity.ts';
import { Game } from '../../src/core/index.ts';

function counter() {
  let n = 0;
  return () => `p${(n += 1)}`;
}

function idAt(pieces: readonly TrackedPiece[], square: string): string | undefined {
  return pieces.find((piece) => piece.square === square)?.id;
}

describe('trackIdentity', () => {
  it('keeps ids of pieces that did not move and moves the mover', () => {
    const newId = counter();
    const game = new Game();
    const before = trackIdentity([], game.pieces(), null, newId);
    const move = game.play('e2e4');
    const after = trackIdentity(before, game.pieces(), move, newId);
    assert.equal(idAt(after, 'e4'), idAt(before, 'e2'));
    assert.equal(idAt(after, 'd2'), idAt(before, 'd2'));
    assert.equal(new Set(after.map((p) => p.id)).size, 32);
  });

  it('moves the rook when castling', () => {
    const newId = counter();
    const game = new Game('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
    const before = trackIdentity([], game.pieces(), null, newId);
    const move = game.play('e1g1');
    const after = trackIdentity(before, game.pieces(), move, newId);
    assert.equal(idAt(after, 'g1'), idAt(before, 'e1'));
    assert.equal(idAt(after, 'f1'), idAt(before, 'h1'));
  });

  it('keeps the pawn id when it promotes, and drops captured pieces', () => {
    const newId = counter();
    const game = new Game('3r4/4P3/8/8/8/8/k7/4K3 w - - 0 1');
    const before = trackIdentity([], game.pieces(), null, newId);
    const move = game.play('e7d8q');
    const after = trackIdentity(before, game.pieces(), move, newId);
    assert.equal(idAt(after, 'd8'), idAt(before, 'e7'));
    assert.equal(after.length, before.length - 1);
  });

  it('slides pieces back after an undo', () => {
    const newId = counter();
    const game = new Game();
    const start = trackIdentity([], game.pieces(), null, newId);
    const after = trackIdentity(start, (game.play('e2e4'), game.pieces()), game.lastMove, newId);
    game.undo();
    const undone = trackIdentity(after, game.pieces(), game.lastMove, newId);
    assert.equal(idAt(undone, 'e2'), idAt(start, 'e2'));
  });
});

describe('board geometry', () => {
  it('maps squares to cells for both orientations', () => {
    assert.deepEqual(toCell('a1', 'w'), { col: 0, row: 7 });
    assert.deepEqual(toCell('a1', 'b'), { col: 7, row: 0 });
    assert.equal(fromCell(0, 0, 'w'), 'a8');
    assert.equal(fromCell(0, 0, 'b'), 'h1');
    assert.equal(squareFromPoint(450, 650, 'w'), 'e2');
    assert.equal(squareFromPoint(-1, 0, 'w'), null);
  });
});
