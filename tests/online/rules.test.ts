// Every write here is checked against database.rules.json by the rules simulator.
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { SERVER_TIME } from '../../src/online/index.ts';
import { PermissionDenied, RulesDatabase } from '../helpers/rules-db.ts';

const NOW = 1_700_000_000_000;
const alice = { uid: 'alice' };
const bob = { uid: 'bob' };
const eve = { uid: 'eve' };
const CODE = 'ABCDEF';
const ROOM = `rooms/${CODE}`;

function newRoom(overrides: Record<string, unknown> = {}) {
  return {
    createdAt: SERVER_TIME,
    createdBy: 'alice',
    config: { initialMs: 300_000, incrementMs: 0, public: true, creatorColor: 'w' },
    players: { w: 'alice' },
    n: 0,
    ...overrides,
  };
}

let db: RulesDatabase;
const allowed = (auth: { uid: string } | null, updates: Record<string, unknown>, now = NOW) =>
  assert.doesNotThrow(() => db.update(auth, updates, now));
const denied = (auth: { uid: string } | null, updates: Record<string, unknown>, now = NOW) =>
  assert.throws(() => db.update(auth, updates, now), PermissionDenied);

function startedRoom() {
  allowed(alice, { [ROOM]: newRoom() });
  allowed(bob, { [`${ROOM}/players/b`]: 'bob', [`${ROOM}/startedAt`]: SERVER_TIME });
}

const move = (i: number, m: string, t: unknown = SERVER_TIME) => ({
  [`${ROOM}/moves/${i}`]: { i, m, t },
  [`${ROOM}/n`]: i + 1,
});

const event = (key: string, type: string, by: string, ply: number, t: unknown = SERVER_TIME) => ({
  [`${ROOM}/events/${key}`]: { type, by, ply, t },
});

beforeEach(() => {
  db = new RulesDatabase();
});

describe('rules: reading', () => {
  it('signed-in users can read rooms; anonymous visitors without auth cannot', () => {
    startedRoom();
    assert.ok(db.read(eve, ROOM, NOW));
    assert.throws(() => db.read(null, ROOM, NOW), PermissionDenied);
    assert.throws(() => db.read(eve, '', NOW), PermissionDenied);
  });
});

describe('rules: creating a room', () => {
  it('accepts a well-formed room', () => allowed(alice, { [ROOM]: newRoom() }));

  it('rejects rooms that are malformed or not your own', () => {
    denied(null, { [ROOM]: newRoom() });
    denied(bob, { [ROOM]: newRoom() }); // createdBy is alice
    denied(alice, { [ROOM]: newRoom({ createdAt: NOW - 5 }) }); // not server time
    denied(alice, { [ROOM]: newRoom({ players: { b: 'alice' } }) }); // wrong seat
    denied(alice, { [ROOM]: newRoom({ players: { w: 'alice', b: 'bob' } }) });
    denied(alice, { [ROOM]: newRoom({ n: 3 }) });
    denied(alice, { [ROOM]: newRoom({ startedAt: SERVER_TIME }) });
    denied(alice, { [ROOM]: newRoom({ moves: { 0: { i: 0, m: 'e2e4', t: SERVER_TIME } } }) });
    denied(alice, { [ROOM]: newRoom({ winner: 'w' }) });
    denied(alice, {
      [ROOM]: newRoom({
        config: { initialMs: 99_999_999, incrementMs: 0, public: true, creatorColor: 'w' },
      }),
    });
    denied(alice, {
      [ROOM]: newRoom({
        config: { initialMs: 0, incrementMs: 0, public: true, creatorColor: 'w', rated: true },
      }),
    });
    denied(alice, { 'rooms/abc123': newRoom() }); // invalid code
  });

  it('cannot overwrite an existing room', () => {
    allowed(alice, { [ROOM]: newRoom() });
    denied(alice, { [ROOM]: newRoom() });
    denied(alice, { [`${ROOM}/config/public`]: false });
  });
});

describe('rules: joining', () => {
  beforeEach(() => allowed(alice, { [ROOM]: newRoom() }));

  it('the second player takes the free seat and starts the game', () => {
    allowed(bob, { [`${ROOM}/players/b`]: 'bob', [`${ROOM}/startedAt`]: SERVER_TIME });
  });

  it('must start the clock with the server time in the same write', () => {
    denied(bob, { [`${ROOM}/players/b`]: 'bob' });
    denied(bob, { [`${ROOM}/players/b`]: 'bob', [`${ROOM}/startedAt`]: NOW - 1000 });
  });

  it('cannot take the seat for someone else, take both seats, or take a taken seat', () => {
    denied(bob, { [`${ROOM}/players/b`]: 'eve', [`${ROOM}/startedAt`]: SERVER_TIME });
    denied(alice, { [`${ROOM}/players/b`]: 'alice', [`${ROOM}/startedAt`]: SERVER_TIME });
    denied(bob, { [`${ROOM}/players/w`]: 'bob', [`${ROOM}/startedAt`]: SERVER_TIME });
    allowed(bob, { [`${ROOM}/players/b`]: 'bob', [`${ROOM}/startedAt`]: SERVER_TIME });
    denied(eve, { [`${ROOM}/players/b`]: 'eve' });
    denied(eve, { [`${ROOM}/startedAt`]: SERVER_TIME });
  });
});

describe('rules: moves are append-only and in turn', () => {
  beforeEach(startedRoom);

  it('players move alternately, White first', () => {
    denied(bob, move(0, 'e2e4'));
    allowed(alice, move(0, 'e2e4'));
    denied(alice, move(1, 'e7e5'));
    allowed(bob, move(1, 'e7e5'));
  });

  it('a move must be written together with n, at index n', () => {
    denied(alice, { [`${ROOM}/moves/0`]: { i: 0, m: 'e2e4', t: SERVER_TIME } });
    denied(alice, { [`${ROOM}/n`]: 1 });
    denied(alice, { [`${ROOM}/moves/1`]: { i: 1, m: 'e2e4', t: SERVER_TIME }, [`${ROOM}/n`]: 2 });
    denied(alice, { ...move(0, 'e2e4'), [`${ROOM}/n`]: 2 });
  });

  it('cannot rewrite or delete a move', () => {
    allowed(alice, move(0, 'e2e4'));
    allowed(bob, move(1, 'e7e5'));
    denied(alice, { [`${ROOM}/moves/0`]: { i: 0, m: 'd2d4', t: SERVER_TIME } });
    denied(alice, { [`${ROOM}/moves/0`]: null });
    denied(alice, { [`${ROOM}/moves/0/m`]: 'd2d4' });
    denied(alice, { [`${ROOM}/n`]: 0 });
  });

  it('every move carries the server time and a UCI string', () => {
    denied(alice, move(0, 'e2e4', NOW - 60_000));
    denied(alice, move(0, 'e2e9'));
    denied(alice, move(0, 'Nf3'));
    denied(alice, {
      [`${ROOM}/moves/0`]: { i: 0, m: 'e2e4', t: SERVER_TIME, clock: 1 },
      [`${ROOM}/n`]: 1,
    });
  });

  it('spectators and strangers cannot move', () => {
    denied(eve, move(0, 'e2e4'));
    denied(null, move(0, 'e2e4'));
  });

  it('no moves before the opponent has joined', () => {
    db = new RulesDatabase();
    allowed(alice, { [ROOM]: newRoom() });
    denied(alice, move(0, 'e2e4'));
  });

  it('nobody can write a result', () => {
    denied(alice, { [`${ROOM}/result`]: 'white wins' });
    denied(alice, { [`${ROOM}/winner`]: 'w' });
  });
});

describe('rules: events', () => {
  beforeEach(startedRoom);

  it('players append events for their own seat at the current move count', () => {
    allowed(bob, event('0000-a', 'resign', 'b', 0));
    denied(bob, event('0000-b', 'resign', 'w', 0));
    denied(eve, event('0000-c', 'resign', 'w', 0));
    denied(alice, event('0000-d', 'draw-offer', 'w', 3));
    denied(alice, event('0000-e', 'draw-offer', 'w', 0, NOW - 1));
    denied(alice, event('0000-f', 'checkmate', 'w', 0));
    denied(alice, {
      [`${ROOM}/events/0000-g`]: { type: 'resign', by: 'w', ply: 0, t: SERVER_TIME, winner: 'w' },
    });
  });

  it('events cannot be changed or removed', () => {
    allowed(alice, event('0000-a', 'draw-offer', 'w', 0));
    denied(alice, event('0000-a', 'resign', 'w', 0));
    denied(alice, { [`${ROOM}/events/0000-a`]: null });
  });

  it('a draw claim can be written together with the move', () => {
    allowed(alice, { ...move(0, 'g1f3'), ...event('0001-a', 'draw-claim', 'w', 1) });
  });

  it('no events before the game starts', () => {
    db = new RulesDatabase();
    allowed(alice, { [ROOM]: newRoom() });
    denied(alice, event('0000-a', 'resign', 'w', 0));
  });
});

describe('rules: rematch', () => {
  beforeEach(startedRoom);

  it('each player votes only for their own seat', () => {
    allowed(alice, { [`${ROOM}/rematch/w`]: true });
    denied(alice, { [`${ROOM}/rematch/b`]: true });
    denied(eve, { [`${ROOM}/rematch/b`]: true });
  });

  it('the next room can be linked once, after both voted, together with creating it', () => {
    const next = 'QRSTUV';
    const rematch = {
      [`rooms/${next}`]: newRoom({
        players: { b: 'alice' },
        config: { initialMs: 300_000, incrementMs: 0, public: false, creatorColor: 'b' },
        prev: CODE,
      }),
      [`${ROOM}/next`]: next,
    };
    allowed(alice, { [`${ROOM}/rematch/w`]: true });
    denied(alice, rematch);
    allowed(bob, { [`${ROOM}/rematch/b`]: true });
    allowed(alice, rematch);
    denied(bob, { [`${ROOM}/next`]: 'WXYZ23' });
  });
});
