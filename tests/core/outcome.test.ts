// Results and draws under the FIDE Laws of Chess (article numbers in test names).
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Game, canCheckmate, isDeadByMaterial, type PlacedPiece } from '../../src/core/index.ts';

const KNIGHT_SHUFFLE = ['g1f3', 'g8f6', 'f3g1', 'f6g8'];

function shuffle(game: Game, times: number): void {
  for (let i = 0; i < times; i += 1) for (const move of KNIGHT_SHUFFLE) game.play(move);
}

function placed(text: string): PlacedPiece[] {
  // "wKe1 bKe8 wBc1" → pieces
  return text.split(' ').map((token) => ({
    color: token[0] === 'w' ? 'w' : 'b',
    type: token[1]?.toLowerCase() as PlacedPiece['type'],
    square: token.slice(2) as PlacedPiece['square'],
  }));
}

describe('automatic results', () => {
  it('5.1.1 checkmate wins', () => {
    const game = Game.fromUci(['f2f3', 'e7e5', 'g2g4', 'd8h4']);
    assert.deepEqual(game.automaticResult(), { winner: 'b', reason: 'checkmate', ply: 4 });
  });

  it('5.2.1 stalemate draws', () => {
    const game = new Game('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1');
    assert.deepEqual(game.automaticResult(), { winner: null, reason: 'stalemate', ply: 0 });
  });

  it('5.2.2 a capture leaving bare kings is a dead position', () => {
    const game = new Game('4k3/8/8/8/8/8/4q3/4K3 w - - 0 1');
    assert.equal(game.automaticResult(), null);
    game.play('e1e2');
    assert.deepEqual(game.automaticResult(), { winner: null, reason: 'dead-position', ply: 1 });
  });

  it('the game goes on in a normal position', () => {
    assert.equal(Game.fromUci(['e2e4', 'e7e5']).automaticResult(), null);
  });
});

describe('dead positions by material (5.2.2)', () => {
  const dead = [
    'wKe1 bKe8',
    'wKe1 bKe8 wBc1',
    'wKe1 bKe8 bNb8',
    'wKe1 bKe8 wBc1 bBf8',
    'wKe1 bKe8 wBc1 wBe3',
  ];
  const alive = [
    'wKe1 bKe8 wBc1 bBc8', // bishops on opposite colours
    'wKe1 bKe8 wNb1 wNg1', // two knights can help-mate
    'wKe1 bKe8 wBc1 bNb8',
    'wKe1 bKe8 wPe2',
    'wKe1 bKe8 wRa1',
  ];
  for (const text of dead)
    it(`dead: ${text}`, () => assert.equal(isDeadByMaterial(placed(text)), true));
  for (const text of alive)
    it(`not dead: ${text}`, () => assert.equal(isDeadByMaterial(placed(text)), false));
});

describe('who can still checkmate (6.9)', () => {
  it('a bare king cannot', () => {
    assert.equal(canCheckmate(placed('wKe1 bKe8 bQd8'), 'w'), false);
  });

  it('a single minor piece can, when the other side has material to block with', () => {
    assert.equal(canCheckmate(placed('wKe1 wNb1 bKe8 bPe7'), 'w'), true);
  });

  it('nobody can in a dead position', () => {
    assert.equal(canCheckmate(placed('wKe1 wNb1 bKe8'), 'w'), false);
  });
});

describe('repetition (9.2, 9.6.1)', () => {
  it('9.2 threefold repetition can be claimed but does not end the game', () => {
    const game = new Game();
    shuffle(game, 1);
    assert.equal(game.repetitionCount(), 2);
    assert.equal(game.drawClaimReason(), null);
    shuffle(game, 1);
    assert.equal(game.repetitionCount(), 3);
    assert.equal(game.drawClaimReason(), 'threefold-repetition');
    assert.equal(game.automaticResult(), null);
  });

  it('9.2.1.1 a move that would repeat the position a third time can be claimed with', () => {
    const game = new Game();
    shuffle(game, 1);
    game.play('g1f3');
    game.play('g8f6');
    game.play('f3g1');
    assert.equal(game.drawClaimReasonAfter('f6g8'), 'threefold-repetition');
    assert.equal(game.drawClaimReasonAfter('b8c6'), null);
    assert.equal(game.ply, 7, 'checking a move must not play it');
  });

  it('9.6.1 fivefold repetition ends the game', () => {
    const game = new Game();
    shuffle(game, 3);
    assert.equal(game.automaticResult(), null);
    shuffle(game, 1);
    assert.deepEqual(game.automaticResult(), {
      winner: null,
      reason: 'fivefold-repetition',
      ply: 16,
    });
  });

  it('9.2.2 a position with an en passant capture differs from the same placement without one', () => {
    const game = new Game('rnbqkbnr/pppppppp/8/4P3/8/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1');
    game.play('d7d5'); // white may capture e5xd6 en passant here
    for (const move of KNIGHT_SHUFFLE) game.play(move);
    assert.equal(game.repetitionCount(), 1);
    for (const move of KNIGHT_SHUFFLE) game.play(move);
    assert.equal(game.repetitionCount(), 2);
  });

  it('9.2.2 an en passant square nobody can use does not make the position different', () => {
    const game = Game.fromUci(['e2e4']);
    for (const move of ['g8f6', 'g1f3', 'f6g8', 'f3g1']) game.play(move);
    assert.equal(game.repetitionCount(), 2);
  });

  it('9.2.2 losing a castling right makes the position different', () => {
    const game = new Game('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
    const kingWalk = ['e1e2', 'e8e7', 'e2e1', 'e7e8'];
    for (const move of kingWalk) game.play(move);
    assert.equal(game.repetitionCount(), 1);
    for (const move of kingWalk) game.play(move);
    assert.equal(game.repetitionCount(), 2);
  });

  it('undo keeps the repetition count right', () => {
    const game = new Game();
    shuffle(game, 2);
    game.undo();
    game.play('f6g8');
    assert.equal(game.repetitionCount(), 3);
  });
});

describe('50- and 75-move rules (9.3, 9.6.2)', () => {
  const quiet = (halfmoves: number) => new Game(`4k3/8/8/8/8/8/4P3/R3K3 w - - ${halfmoves} 80`);

  it('9.3 fifty moves without capture or pawn move can be claimed', () => {
    const game = quiet(99);
    assert.equal(game.drawClaimReason(), null);
    assert.equal(game.drawClaimReasonAfter('a1a2'), 'fifty-move-rule');
    game.play('a1a2');
    assert.equal(game.halfmoveClock(), 100);
    assert.equal(game.drawClaimReason(), 'fifty-move-rule');
    assert.equal(game.automaticResult(), null);
  });

  it('a pawn move resets the count', () => {
    const game = quiet(99);
    assert.equal(game.drawClaimReasonAfter('e2e3'), null);
    game.play('e2e3');
    assert.equal(game.halfmoveClock(), 0);
  });

  it('9.6.2 seventy-five moves end the game', () => {
    const game = quiet(149);
    game.play('a1a2');
    assert.deepEqual(game.automaticResult(), {
      winner: null,
      reason: 'seventy-five-move-rule',
      ply: 1,
    });
  });

  it('9.6.2 checkmate on the 75th move takes precedence', () => {
    const game = new Game('k7/8/1K6/8/8/8/8/7R w - - 149 100');
    game.play('h1h8');
    assert.deepEqual(game.automaticResult(), { winner: 'w', reason: 'checkmate', ply: 1 });
  });
});

describe('flag fall (6.9)', () => {
  it('the opponent wins when they could still checkmate', () => {
    assert.deepEqual(new Game().timeoutResult('w'), { winner: 'b', reason: 'timeout', ply: 0 });
  });

  it('a draw when the opponent has only a king', () => {
    const game = new Game('4k3/8/8/8/8/8/4P3/R3K3 b - - 0 1');
    assert.deepEqual(game.timeoutResult('w'), {
      winner: null,
      reason: 'timeout-vs-insufficient-material',
      ply: 0,
    });
    assert.equal(game.timeoutResult('b').winner, 'w');
  });
});
