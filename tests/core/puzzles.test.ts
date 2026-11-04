import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Game, PUZZLES, canMate, solves } from '../../src/core/index.ts';

describe('puzzles', () => {
  it('have unique ids', () => {
    assert.equal(new Set(PUZZLES.map((puzzle) => puzzle.id)).size, PUZZLES.length);
  });

  for (const puzzle of PUZZLES) {
    it(`${puzzle.id} is a forced mate in exactly ${puzzle.mateIn}`, () => {
      const game = new Game(puzzle.fen);
      assert.equal(canMate(game, puzzle.mateIn), true, 'has a forced mate');
      if (puzzle.mateIn > 1) assert.equal(canMate(game, puzzle.mateIn - 1), false, 'not shorter');
    });
  }

  it('judges moves by search and leaves the game unchanged', () => {
    const game = new Game('6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1');
    assert.equal(solves(game, { from: 'd1', to: 'd8' }, 1), true);
    assert.equal(solves(game, { from: 'd1', to: 'd7' }, 1), false);
    assert.equal(solves(game, { from: 'a1', to: 'a2' }, 1), false);
    assert.equal(game.ply, 0);
  });
});
