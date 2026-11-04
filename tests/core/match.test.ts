import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  replayMatch,
  type MatchEvent,
  type MatchRecord,
  type TimeControl,
} from '../../src/core/index.ts';

const MIN = 60_000;
const ONE_MINUTE: TimeControl = { initialMs: MIN, incrementMs: 0 };

/** Moves one second apart, starting at t=1000. */
function timed(...ucis: string[]) {
  return ucis.map((uci, index) => ({ uci, t: (index + 1) * 1_000 }));
}

function record(partial: Partial<MatchRecord>): MatchRecord {
  return { timeControl: null, startedAt: 0, moves: [], events: [], ...partial };
}

const KNIGHTS = ['g1f3', 'g8f6', 'f3g1', 'f6g8'];

describe('replayMatch: moves', () => {
  it('replays a game in progress', () => {
    const state = replayMatch(record({ moves: timed('e2e4', 'e7e5') }));
    assert.equal(state.result, null);
    assert.equal(state.game.ply, 2);
    assert.equal(state.clock, null);
  });

  it('ends on checkmate and ignores anything after it', () => {
    const moves = timed('f2f3', 'e7e5', 'g2g4', 'd8h4', 'e1f2');
    const events: MatchEvent[] = [{ type: 'resign', by: 'b', ply: 4, t: 4_500 }];
    const state = replayMatch(record({ moves, events }));
    assert.deepEqual(state.result, { winner: 'b', reason: 'checkmate', ply: 4 });
    assert.equal(state.game.ply, 4);
  });

  it('an illegal stored move loses for its writer', () => {
    const state = replayMatch(record({ moves: timed('e2e4', 'e7e4') }));
    assert.deepEqual(state.result, { winner: 'w', reason: 'illegal-move', ply: 1 });
  });

  it('a malformed stored move loses too', () => {
    const state = replayMatch(record({ moves: timed('xyz') }));
    assert.deepEqual(state.result, { winner: 'b', reason: 'illegal-move', ply: 0 });
  });

  it('starts from a custom position', () => {
    const state = replayMatch(
      record({ startFen: '4k3/8/8/8/8/8/4q3/4K3 w - - 0 1', moves: timed('e1e2') }),
    );
    assert.equal(state.result?.reason, 'dead-position');
  });
});

describe('replayMatch: resignation and draw offers', () => {
  it('resignation ends the game, even when it is not your turn', () => {
    const events: MatchEvent[] = [{ type: 'resign', by: 'w', ply: 1, t: 1_500 }];
    const state = replayMatch(record({ moves: timed('e2e4', 'e7e5'), events }));
    assert.deepEqual(state.result, { winner: 'b', reason: 'resignation', ply: 1 });
    assert.equal(state.game.ply, 1, 'moves after the resignation do not count');
  });

  it('an accepted offer is a draw by agreement', () => {
    const events: MatchEvent[] = [
      { type: 'draw-offer', by: 'w', ply: 1, t: 1_100 },
      { type: 'draw-accept', by: 'b', ply: 1, t: 1_200 },
    ];
    const state = replayMatch(record({ moves: timed('e2e4'), events }));
    assert.deepEqual(state.result, { winner: null, reason: 'agreement', ply: 1 });
  });

  it('the offer stands while the offering side moves', () => {
    const events: MatchEvent[] = [
      { type: 'draw-offer', by: 'w', ply: 0, t: 500 },
      { type: 'draw-accept', by: 'b', ply: 1, t: 1_500 },
    ];
    const state = replayMatch(record({ moves: timed('e2e4'), events }));
    assert.equal(state.result?.reason, 'agreement');
  });

  it('the opponent making a move declines the offer', () => {
    const events: MatchEvent[] = [
      { type: 'draw-offer', by: 'w', ply: 1, t: 1_100 },
      { type: 'draw-accept', by: 'b', ply: 2, t: 2_500 },
    ];
    const state = replayMatch(record({ moves: timed('e2e4', 'e7e5'), events }));
    assert.equal(state.result, null);
    assert.equal(state.drawOffer, null);
  });

  it('reports a standing offer', () => {
    const events: MatchEvent[] = [{ type: 'draw-offer', by: 'w', ply: 1, t: 1_100 }];
    assert.equal(replayMatch(record({ moves: timed('e2e4'), events })).drawOffer, 'w');
  });

  it('cannot accept your own offer or one that was never made', () => {
    const own: MatchEvent[] = [
      { type: 'draw-offer', by: 'w', ply: 1, t: 1_100 },
      { type: 'draw-accept', by: 'w', ply: 1, t: 1_200 },
    ];
    assert.equal(replayMatch(record({ moves: timed('e2e4'), events: own })).result, null);
    const none: MatchEvent[] = [{ type: 'draw-accept', by: 'b', ply: 1, t: 1_200 }];
    assert.equal(replayMatch(record({ moves: timed('e2e4'), events: none })).result, null);
  });

  it('offers from both sides are an agreement', () => {
    const events: MatchEvent[] = [
      { type: 'draw-offer', by: 'w', ply: 1, t: 1_100 },
      { type: 'draw-offer', by: 'b', ply: 1, t: 1_200 },
    ];
    assert.equal(replayMatch(record({ moves: timed('e2e4'), events })).result?.reason, 'agreement');
  });
});

describe('replayMatch: draw claims (9.2, 9.3)', () => {
  const twoShuffles = timed(...KNIGHTS, ...KNIGHTS); // start position occurs a third time at ply 8

  it('the player to move can claim a threefold repetition', () => {
    const events: MatchEvent[] = [{ type: 'draw-claim', by: 'w', ply: 8, t: 8_500 }];
    const state = replayMatch(record({ moves: twoShuffles, events }));
    assert.deepEqual(state.result, { winner: null, reason: 'threefold-repetition', ply: 8 });
  });

  it('the player who is not to move cannot claim on the board position', () => {
    const events: MatchEvent[] = [{ type: 'draw-claim', by: 'b', ply: 8, t: 8_500 }];
    assert.equal(replayMatch(record({ moves: twoShuffles, events })).result, null);
  });

  it('a claim written together with the move that repeats the position counts', () => {
    const events: MatchEvent[] = [{ type: 'draw-claim', by: 'b', ply: 8, t: 8_000 }];
    const state = replayMatch(record({ moves: twoShuffles, events }));
    assert.equal(state.result?.reason, 'threefold-repetition');
  });

  it('a claim when the position does not qualify is ignored and play goes on', () => {
    const events: MatchEvent[] = [{ type: 'draw-claim', by: 'w', ply: 4, t: 4_500 }];
    const state = replayMatch(record({ moves: twoShuffles, events }));
    assert.equal(state.result, null);
    assert.equal(state.game.ply, 8);
  });

  it('fifty moves can be claimed', () => {
    const startFen = '4k3/8/8/8/8/8/4P3/R3K3 w - - 99 80';
    const events: MatchEvent[] = [{ type: 'draw-claim', by: 'b', ply: 1, t: 1_500 }];
    const state = replayMatch(record({ startFen, moves: timed('a1a2'), events }));
    assert.deepEqual(state.result, { winner: null, reason: 'fifty-move-rule', ply: 1 });
  });

  it('fivefold repetition ends the game without a claim', () => {
    const moves = timed(...KNIGHTS, ...KNIGHTS, ...KNIGHTS, ...KNIGHTS, 'e2e4');
    const state = replayMatch(record({ moves }));
    assert.deepEqual(state.result, { winner: null, reason: 'fivefold-repetition', ply: 16 });
  });
});

describe('replayMatch: time (6.9)', () => {
  it('runs the clocks from the move timestamps', () => {
    const state = replayMatch(record({ timeControl: ONE_MINUTE, moves: timed('e2e4', 'e7e5') }));
    assert.deepEqual(state.clock?.remaining, { w: 59_000, b: 59_000 });
    assert.equal(state.clock?.turn, 'w');
  });

  it('a move after the deadline does not count and its player loses on time', () => {
    const moves = [
      { uci: 'e2e4', t: 1_000 },
      { uci: 'e7e5', t: 1_000 + MIN },
    ];
    const state = replayMatch(record({ timeControl: ONE_MINUTE, moves }));
    assert.deepEqual(state.result, { winner: 'w', reason: 'timeout', ply: 1 });
    assert.equal(state.game.ply, 1);
  });

  it('a flag fall is found from the current time', () => {
    const base = record({ timeControl: ONE_MINUTE, moves: timed('e2e4') });
    assert.equal(replayMatch(base, 1_000 + MIN - 1).result, null);
    assert.deepEqual(replayMatch(base, 1_000 + MIN).result, {
      winner: 'w',
      reason: 'timeout',
      ply: 1,
    });
  });

  it('an event after the flag fell is too late', () => {
    const events: MatchEvent[] = [{ type: 'resign', by: 'w', ply: 1, t: 2 * MIN }];
    const state = replayMatch(record({ timeControl: ONE_MINUTE, moves: timed('e2e4'), events }));
    assert.equal(state.result?.reason, 'timeout');
    assert.equal(state.result?.winner, 'w');
  });

  it('a flag fall against a bare king is a draw', () => {
    const startFen = '4k3/8/8/8/8/8/4P3/R3K3 b - - 0 1';
    const state = replayMatch(
      record({ startFen, timeControl: ONE_MINUTE, moves: timed('e8d8') }),
      10 * MIN,
    );
    assert.deepEqual(state.result, {
      winner: null,
      reason: 'timeout-vs-insufficient-material',
      ply: 1,
    });
  });

  it('untimed games never flag', () => {
    assert.equal(replayMatch(record({ moves: timed('e2e4') }), 10 ** 12).result, null);
  });
});
