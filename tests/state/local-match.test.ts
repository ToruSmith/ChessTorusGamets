import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { LocalMatch, TIME_PRESETS } from '../../src/state/index.ts';

function fakeClock(start = 1_000_000) {
  let now = start;
  return {
    now: () => now,
    advance: (ms: number) => {
      now += ms;
    },
  };
}

const untimed = () => LocalMatch.create({ timeControl: null });

describe('LocalMatch', () => {
  it('starts with White to move and 20 legal moves', () => {
    const match = untimed();
    assert.equal(match.snapshot.turn, 'w');
    assert.equal(match.snapshot.legalMoves.length, 20);
    assert.equal(match.snapshot.pieces.length, 32);
    assert.equal(match.snapshot.result, null);
    assert.equal(match.snapshot.canUndo, false);
  });

  it('plays legal moves and refuses illegal ones', () => {
    const match = untimed();
    assert.equal(match.play('e2e4'), true);
    assert.equal(match.play('e2e4'), false);
    assert.equal(match.play({ from: 'e7', to: 'e5' }), true);
    assert.deepEqual(
      match.snapshot.history.map((move) => move.san),
      ['e4', 'e5'],
    );
    assert.equal(match.snapshot.lastMove?.uci, 'e7e5');
  });

  it('notifies subscribers with a new snapshot', () => {
    const match = untimed();
    const before = match.snapshot;
    let calls = 0;
    const unsubscribe = match.store.subscribe(() => {
      calls += 1;
    });
    match.play('e2e4');
    unsubscribe();
    match.play('e7e5');
    assert.equal(calls, 1);
    assert.notEqual(match.snapshot, before);
  });

  it('marks the king in check and ends on checkmate', () => {
    const match = untimed();
    for (const move of ['f2f3', 'e7e5', 'g2g4', 'd8h4']) match.play(move);
    assert.equal(match.snapshot.checkSquare, 'e1');
    assert.deepEqual(match.snapshot.result, { winner: 'b', reason: 'checkmate', ply: 4 });
    assert.deepEqual(match.snapshot.legalMoves, []);
    assert.equal(match.play('e1f2'), false);
  });

  it('undoes moves, including after the game ended', () => {
    const match = untimed();
    for (const move of ['f2f3', 'e7e5', 'g2g4', 'd8h4']) match.play(move);
    assert.equal(match.undo(), true);
    assert.equal(match.snapshot.result, null);
    assert.equal(match.snapshot.history.length, 3);
  });

  it('undo also removes a resignation made after the last move', () => {
    const match = untimed();
    match.play('e2e4');
    match.resign();
    assert.equal(match.snapshot.result?.reason, 'resignation');
    match.undo();
    assert.equal(match.snapshot.result, null);
    assert.equal(match.snapshot.history.length, 0);
  });

  it('the side to move resigns', () => {
    const match = untimed();
    match.play('e2e4');
    match.resign();
    assert.deepEqual(match.snapshot.result, { winner: 'w', reason: 'resignation', ply: 1 });
  });

  it('draw offers: accepted by the opponent, declined by a move', () => {
    const match = untimed();
    match.play('e2e4');
    match.offerDraw(); // Black offers
    assert.equal(match.snapshot.drawOffer, 'b');
    match.play('e7e5'); // Black moves; the offer stands
    assert.equal(match.snapshot.drawOffer, 'b');
    match.play('g1f3'); // White moves: declined
    assert.equal(match.snapshot.drawOffer, null);
    match.offerDraw(); // Black offers again
    match.acceptDraw();
    assert.equal(match.snapshot.result?.reason, 'agreement');
  });

  it('offers a threefold repetition claim and records it', () => {
    const match = untimed();
    const shuffle = ['g1f3', 'g8f6', 'f3g1', 'f6g8'];
    for (const move of shuffle) match.play(move);
    assert.equal(match.snapshot.drawClaim, null);
    assert.equal(match.claimDraw(), false);
    for (const move of shuffle) match.play(move);
    assert.equal(match.snapshot.drawClaim, 'threefold-repetition');
    assert.equal(match.claimDraw(), true);
    assert.deepEqual(match.snapshot.result, {
      winner: null,
      reason: 'threefold-repetition',
      ply: 8,
    });
  });

  it('restores from JSON and rejects broken records', () => {
    const match = untimed();
    match.play('e2e4');
    match.offerDraw();
    const copy = LocalMatch.fromJSON(JSON.parse(JSON.stringify(match.toJSON())));
    assert.ok(copy);
    assert.equal(copy.snapshot.fen, match.snapshot.fen);
    assert.equal(copy.snapshot.drawOffer, 'b');
    for (const bad of [
      null,
      {},
      { version: 2 },
      { ...match.toJSON(), startFen: 'x' },
      { ...match.toJSON(), moves: [{ uci: 1 }] },
    ]) {
      assert.equal(LocalMatch.fromJSON(bad), null);
    }
  });
});

describe('LocalMatch with a clock', () => {
  const blitz = TIME_PRESETS.find((preset) => preset.id === '3+2')?.control ?? null;

  it('does not run the clock before the first move and cannot undo', () => {
    const clock = fakeClock();
    const match = LocalMatch.create({ timeControl: blitz }, clock.now);
    assert.equal(match.snapshot.clock?.running, false);
    clock.advance(10 * 60_000);
    match.tick();
    assert.equal(match.snapshot.result, null);
    match.play('e2e4');
    assert.equal(match.snapshot.clock?.running, true);
    assert.equal(match.snapshot.canUndo, false);
    assert.equal(match.undo(), false);
  });

  it('charges time between moves and adds the increment', () => {
    const clock = fakeClock();
    const match = LocalMatch.create({ timeControl: blitz }, clock.now);
    match.play('e2e4');
    clock.advance(5_000);
    match.play('e7e5');
    assert.deepEqual(match.snapshot.clock?.remaining, { w: 182_000, b: 177_000 });
  });

  it('flags a player whose time runs out', () => {
    const clock = fakeClock();
    const match = LocalMatch.create({ timeControl: blitz }, clock.now);
    match.play('e2e4');
    clock.advance(180_000);
    match.tick();
    assert.deepEqual(match.snapshot.result, { winner: 'w', reason: 'timeout', ply: 1 });
    assert.equal(match.snapshot.clock?.running, false);
    assert.equal(match.play('e7e5'), false);
  });
});
