import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Game, OpeningBook, loadOpeningBook } from '../../src/core/index.ts';

describe('opening book', () => {
  it('names openings along the move sequence', async () => {
    const book = await loadOpeningBook();
    assert.ok(book.size > 3000);
    assert.equal(book.name([]), null);
    assert.equal(book.name(['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5'])?.name, 'Ruy Lopez');
    assert.equal(book.name(['e2e4', 'c7c5'])?.eco, 'B20');
    // Out of book: keeps the last name.
    assert.equal(book.name(['e2e4', 'c7c5', 'a2a3', 'h7h5', 'h2h4'])?.eco?.startsWith('B2'), true);
  });

  it('offers only legal book continuations', async () => {
    const book = await loadOpeningBook();
    const game = Game.fromUci(['e2e4', 'e7e5']);
    const next = book.continuations(['e2e4', 'e7e5']);
    assert.ok(next.includes('g1f3'));
    assert.ok(next.every((move) => game.isLegal(move)));
    assert.deepEqual(book.continuations(['a2a3', 'h7h5', 'h2h4', 'a7a5', 'b2b4', 'g7g5']), []);
  });

  it('builds from plain lines', () => {
    const book = new OpeningBook([
      ['C20', "King's Pawn Game", 'e2e4 e7e5'],
      ['C40', "King's Knight Opening", 'e2e4 e7e5 g1f3'],
    ]);
    assert.equal(book.name(['e2e4', 'e7e5', 'g1f3', 'b8c6'])?.eco, 'C40');
    assert.deepEqual(book.continuations(['e2e4']), ['e7e5']);
  });
});
