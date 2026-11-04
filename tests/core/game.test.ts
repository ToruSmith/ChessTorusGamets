import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  Game,
  IllegalMoveError,
  InvalidFenError,
  SQUARES,
  STARTING_FEN,
  checkFen,
  fileIndex,
  isLightSquare,
  parseUci,
  rankIndex,
  squareAt,
  toUci,
} from '../../src/core/index.ts';

describe('squares and UCI', () => {
  it('lists squares from a8 to h1', () => {
    assert.equal(SQUARES.length, 64);
    assert.equal(SQUARES[0], 'a8');
    assert.equal(SQUARES[7], 'h8');
    assert.equal(SQUARES[63], 'h1');
  });

  it('converts between squares and indices', () => {
    assert.equal(fileIndex('e4'), 4);
    assert.equal(rankIndex('e4'), 3);
    assert.equal(squareAt(4, 3), 'e4');
    assert.equal(squareAt(8, 0), null);
    assert.equal(isLightSquare('a1'), false);
    assert.equal(isLightSquare('h1'), true);
  });

  it('parses and prints UCI', () => {
    assert.deepEqual(parseUci('e2e4'), { from: 'e2', to: 'e4' });
    assert.deepEqual(parseUci('e7e8q'), { from: 'e7', to: 'e8', promotion: 'q' });
    for (const bad of ['', 'e2', 'e2e9', 'e2e4k', 'e2e2', 'E2E4', 'e2e4 ']) {
      assert.equal(parseUci(bad), null, bad);
    }
    assert.equal(toUci({ from: 'e7', to: 'e8', promotion: 'n' }), 'e7e8n');
  });
});

describe('Game basics', () => {
  it('starts from the standard position', () => {
    const game = new Game();
    assert.equal(game.fen(), STARTING_FEN);
    assert.equal(game.turn(), 'w');
    assert.equal(game.legalMoves().length, 20);
    assert.deepEqual(game.pieceAt('e1'), { color: 'w', type: 'k' });
    assert.equal(game.pieceAt('e4'), null);
    assert.equal(game.pieces().length, 32);
  });

  it('plays UCI, object and SAN moves', () => {
    const game = new Game();
    const e4 = game.play('e2e4');
    assert.equal(e4.san, 'e4');
    assert.equal(e4.uci, 'e2e4');
    assert.equal(e4.piece, 'p');
    assert.equal(game.play({ from: 'e7', to: 'e5' }).san, 'e5');
    assert.equal(game.playSan('Nf3').uci, 'g1f3');
    assert.equal(game.ply, 3);
    assert.equal(game.turn(), 'b');
    assert.equal(game.lastMove?.san, 'Nf3');
  });

  it('rejects illegal moves without changing the game', () => {
    const game = new Game();
    const fen = game.fen();
    assert.throws(() => game.play('e2e5'), IllegalMoveError);
    assert.throws(() => game.play('e7e5'), IllegalMoveError);
    assert.throws(() => game.play('nonsense'), IllegalMoveError);
    assert.throws(() => game.playSan('Ke2'), IllegalMoveError);
    assert.equal(game.fen(), fen);
    assert.equal(game.ply, 0);
  });

  it('lists legal moves from one square', () => {
    const game = new Game();
    assert.deepEqual(
      game
        .legalMoves('g1')
        .map((move) => move.to)
        .sort(),
      ['f3', 'h3'],
    );
    assert.deepEqual(game.legalMoves('e4'), []);
  });

  it('requires an explicit promotion piece and rejects one on other moves', () => {
    const game = new Game('8/4P3/8/8/8/8/k7/4K3 w - - 0 1');
    assert.equal(game.isLegal('e7e8'), false);
    assert.equal(game.isLegal('e1e2q'), false);
    const move = game.play('e7e8n');
    assert.equal(move.promotion, 'n');
    assert.equal(move.san, 'e8=N');
    assert.deepEqual(game.pieceAt('e8'), { color: 'w', type: 'n' });
  });

  it('castles and reports it', () => {
    const game = new Game('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
    const short = game.play('e1g1');
    assert.equal(short.castle, 'kingside');
    assert.equal(short.san, 'O-O');
    assert.deepEqual(game.pieceAt('f1'), { color: 'w', type: 'r' });
    const long = game.play('e8c8');
    assert.equal(long.castle, 'queenside');
    assert.equal(long.san, 'O-O-O');
  });

  it('captures en passant', () => {
    const game = new Game('rnbqkbnr/pppppppp/8/4P3/8/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1');
    game.play('d7d5');
    const capture = game.play('e5d6');
    assert.equal(capture.isEnPassant, true);
    assert.equal(capture.isCapture, true);
    assert.equal(capture.captured, 'p');
    assert.equal(game.pieceAt('d5'), null);
  });

  it('marks check and checkmate', () => {
    const game = Game.fromUci(['f2f3', 'e7e5', 'g2g4']);
    const mate = game.play('d8h4');
    assert.equal(mate.isCheck, true);
    assert.equal(mate.isCheckmate, true);
    assert.equal(mate.san, 'Qh4#');
    assert.equal(game.inCheck(), true);
  });

  it('undoes moves and clones games', () => {
    const game = Game.fromUci(['e2e4', 'e7e5']);
    const copy = game.clone();
    assert.equal(game.undo()?.uci, 'e7e5');
    assert.equal(game.ply, 1);
    assert.equal(copy.ply, 2);
    game.undo();
    assert.equal(game.undo(), null);
    assert.equal(game.fen(), STARTING_FEN);
  });

  it('reports the move index of a bad replay', () => {
    assert.throws(
      () => Game.fromUci(['e2e4', 'e2e4']),
      (error: unknown) => error instanceof IllegalMoveError && error.move === 'e2e4',
    );
  });
});

describe('FEN validation', () => {
  it('accepts normal positions', () => {
    assert.deepEqual(checkFen(STARTING_FEN), { ok: true });
    assert.doesNotThrow(() => new Game('4k3/8/8/8/8/8/8/4K2R w K - 0 1'));
  });

  it('rejects broken or impossible positions', () => {
    const bad = {
      malformed: 'not a fen',
      'missing king': '8/8/8/8/8/8/8/4K3 w - - 0 1',
      'castling without rook': '4k3/8/8/8/8/8/8/4K3 w K - 0 1',
      'castling with king moved': '4k3/8/8/8/8/8/8/3K3R w K - 0 1',
      'pawn on last rank': 'P3k3/8/8/8/8/8/8/4K3 w - - 0 1',
      'pawn on first rank': '4k3/8/8/8/8/8/8/p3K3 w - - 0 1',
      'side not to move in check': '4k3/8/8/8/8/8/8/4K2r b - - 0 1',
    };
    for (const [name, fen] of Object.entries(bad)) {
      assert.equal(checkFen(fen).ok, false, name);
      assert.throws(() => new Game(fen), InvalidFenError, name);
    }
  });
});
