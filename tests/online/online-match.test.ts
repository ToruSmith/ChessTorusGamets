// Two clients play through the fake server; every write passes the database rules.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseUci } from '../../src/core/index.ts';
import { OnlineService, type OnlineMatch } from '../../src/state/index.ts';
import { FakeServer } from '../helpers/fake-server.ts';

const flush = async () => {
  for (let i = 0; i < 5; i += 1) await new Promise((resolve) => setImmediate(resolve));
};

async function setup(timeControl: { initialMs: number; incrementMs: number } | null = null) {
  const server = new FakeServer();
  const alice = new OnlineService(server.client('alice'));
  const bob = new OnlineService(server.client('bob'));
  const code = await alice.createRoom({ timeControl, color: 'w', public: true });
  const a = alice.open(code);
  const b = bob.open(code);
  a.start();
  b.start();
  await flush();
  return { server, alice, bob, code, a, b };
}

async function startGame(timeControl: { initialMs: number; incrementMs: number } | null = null) {
  const ctx = await setup(timeControl);
  assert.equal(await ctx.b.join(), true);
  await flush();
  return ctx;
}

async function playAll(white: OnlineMatch, black: OnlineMatch, moves: string[]) {
  for (const [index, uci] of moves.entries()) {
    const player = index % 2 === 0 ? white : black;
    const move = parseUci(uci);
    assert.ok(move, uci);
    assert.equal(await player.play(move), true, uci);
    await flush();
  }
}

describe('online: lobby and joining', () => {
  it('lists open public rooms to others and lets a visitor join', async () => {
    const { alice, bob, code, a, b } = await setup({ initialMs: 300_000, incrementMs: 2_000 });
    assert.deepEqual(await alice.lobby(), [], 'your own room is not listed for you');
    const listed = await bob.lobby();
    assert.equal(listed.length, 1);
    assert.equal(listed[0]?.code, code);
    assert.equal(listed[0]?.yourColor, 'b');
    assert.deepEqual(listed[0]?.timeControl, { initialMs: 300_000, incrementMs: 2_000 });

    assert.equal(a.snapshot.phase, 'waiting');
    assert.equal(a.snapshot.seat, 'w');
    assert.equal(a.snapshot.canJoin, false);
    assert.equal(b.snapshot.canJoin, true);
    assert.equal(await b.join(), true);
    await flush();
    assert.equal(b.snapshot.seat, 'b');
    assert.equal(a.snapshot.phase, 'playing');
    assert.deepEqual(await bob.lobby(), []);
  });

  it('a third visitor is a spectator and cannot play', async () => {
    const { server, code, a } = await startGame();
    const eve = new OnlineService(server.client('eve')).open(code);
    eve.start();
    await flush();
    assert.equal(eve.snapshot.seat, null);
    assert.equal(eve.snapshot.canJoin, false);
    assert.equal(await eve.join(), false);
    assert.equal(await eve.play({ from: 'e2', to: 'e4' }), false);
    assert.equal(a.snapshot.match?.legalMoves.length, 20);
    assert.deepEqual(eve.snapshot.match?.legalMoves, []);
  });

  it('reports a missing room', async () => {
    const server = new FakeServer();
    const match = new OnlineService(server.client('x')).open('ZZZZZZ');
    match.start();
    await flush();
    assert.equal(match.snapshot.phase, 'missing');
  });
});

describe('online: playing', () => {
  it('only the side to move can play; both see the same game and result', async () => {
    const { a, b } = await startGame();
    assert.equal(await b.play({ from: 'e7', to: 'e5' }), false);
    await playAll(a, b, ['f2f3', 'e7e5', 'g2g4', 'd8h4']);
    for (const client of [a, b]) {
      assert.equal(client.snapshot.phase, 'over');
      assert.deepEqual(client.snapshot.match?.result, { winner: 'b', reason: 'checkmate', ply: 4 });
    }
  });

  it('engine analysis is only allowed after the game', async () => {
    const { a, b } = await startGame();
    assert.equal(a.snapshot.analysisAllowed, false);
    assert.equal(b.snapshot.analysisAllowed, false);
    await b.resign();
    await flush();
    assert.equal(a.snapshot.analysisAllowed, true);
  });

  it('resignation, at any time', async () => {
    const { a, b } = await startGame();
    await playAll(a, b, ['e2e4']);
    assert.equal(await a.resign(), true);
    await flush();
    assert.deepEqual(b.snapshot.match?.result, { winner: 'b', reason: 'resignation', ply: 1 });
  });

  it('draw offer and acceptance', async () => {
    const { a, b } = await startGame();
    await playAll(a, b, ['e2e4']);
    await a.offerDraw();
    await flush();
    assert.equal(b.snapshot.match?.drawOffer, 'w');
    await b.acceptDraw();
    await flush();
    assert.equal(a.snapshot.match?.result?.reason, 'agreement');
  });

  it('claiming a threefold repetition, on the board or together with the move', async () => {
    const shuffle = ['g1f3', 'g8f6', 'f3g1', 'f6g8'];
    const first = await startGame();
    await playAll(first.a, first.b, [...shuffle, ...shuffle]);
    assert.equal(first.a.snapshot.match?.drawClaim, 'threefold-repetition');
    assert.equal(first.b.snapshot.match?.drawClaim, null, 'only the side to move sees the claim');
    await first.a.claimDraw();
    await flush();
    assert.equal(first.b.snapshot.match?.result?.reason, 'threefold-repetition');

    const second = await startGame();
    await playAll(second.a, second.b, [...shuffle, ...shuffle.slice(0, 3)]);
    assert.equal(second.b.claimAfter({ from: 'f6', to: 'g8' }), 'threefold-repetition');
    assert.equal(await second.b.play({ from: 'f6', to: 'g8' }, { claimDraw: true }), true);
    await flush();
    assert.equal(second.a.snapshot.match?.result?.reason, 'threefold-repetition');
  });

  it('the clock runs on server time and a flag fall ends the game', async () => {
    const { server, a, b } = await startGame({ initialMs: 60_000, incrementMs: 0 });
    server.advance(5_000);
    await playAll(a, b, ['e2e4']);
    assert.equal(a.snapshot.match?.clock?.remaining.w, 55_000);
    server.advance(60_000);
    a.tick();
    b.tick();
    assert.deepEqual(a.snapshot.match?.result, { winner: 'w', reason: 'timeout', ply: 1 });
    assert.equal(await b.play({ from: 'e7', to: 'e5' }), false);
  });
});

describe('online: rematch', () => {
  it('after both vote, a new room opens with colours swapped and both are seated', async () => {
    const { server, a, b, code } = await startGame();
    await b.resign();
    await flush();
    // Black votes first this time; the room is still created once, by White.
    assert.equal(await b.voteRematch(), true);
    await flush();
    assert.equal(a.snapshot.next, null);
    assert.equal(await a.voteRematch(), true);
    await flush();
    const next = a.snapshot.next;
    assert.ok(next);
    assert.notEqual(next, code);
    assert.equal(b.snapshot.next, next);

    const a2 = new OnlineService(server.client('alice')).open(next);
    const b2 = new OnlineService(server.client('bob')).open(next);
    a2.start();
    b2.start();
    await flush();
    await flush();
    assert.equal(a2.snapshot.phase, 'playing');
    assert.equal(a2.snapshot.seat, 'b');
    assert.equal(b2.snapshot.seat, 'w');
  });
});

describe('online: lobby join', () => {
  it('takes the seat from the lobby', async () => {
    const { bob, code, a } = await setup();
    assert.equal(await bob.join(code), true);
    await flush();
    assert.equal(a.snapshot.phase, 'playing');
    assert.equal(await bob.join(code), false, 'the seat is gone now');
  });
});
