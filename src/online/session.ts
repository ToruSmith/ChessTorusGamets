// Room operations on top of RoomBackend. Every write here must pass database.rules.json.
import { opposite, type Color, type MatchEventType } from '../core/index.ts';
import { randomRoomCode } from './code.ts';
import { isOpenRoom, parseRoom, type Room, type RoomConfig } from './room.ts';
import { SERVER_TIME, type RoomBackend } from './types.ts';

export interface NewRoomOptions {
  readonly initialMs: number;
  readonly incrementMs: number;
  readonly public: boolean;
  readonly creatorColor: Color;
  /** Set when this room is a rematch of another. */
  readonly prev?: string;
}

const roomPath = (code: string) => `rooms/${code}`;

function newRoomData(uid: string, options: NewRoomOptions): Record<string, unknown> {
  const config: RoomConfig = {
    initialMs: options.initialMs,
    incrementMs: options.incrementMs,
    public: options.public,
    creatorColor: options.creatorColor,
  };
  return {
    createdAt: SERVER_TIME,
    createdBy: uid,
    config,
    players: { [options.creatorColor]: uid },
    n: 0,
    ...(options.prev ? { prev: options.prev } : {}),
  };
}

/** Create a room and return its code. Retries with a new code if one is taken. */
export async function createRoom(
  backend: RoomBackend,
  options: NewRoomOptions,
  extraUpdates: (code: string) => Record<string, unknown> = () => ({}),
): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = randomRoomCode();
    if ((await backend.get(roomPath(code))) !== null) continue;
    try {
      await backend.update({
        [roomPath(code)]: newRoomData(backend.uid, options),
        ...extraUpdates(code),
      });
      return code;
    } catch (error) {
      if (attempt === 4) throw error;
    }
  }
  throw new Error('Could not find a free room code');
}

export async function readRoom(backend: RoomBackend, code: string): Promise<Room | null> {
  return parseRoom(code, await backend.get(roomPath(code)));
}

/** Take the free seat. Returns the seat, or null when the room is full or already yours. */
export async function joinRoom(backend: RoomBackend, code: string): Promise<Color | null> {
  const room = await readRoom(backend, code);
  if (!room || room.startedAt !== null) return null;
  const free = (['w', 'b'] as const).find((color) => room.players[color] === undefined);
  if (!free || room.players[opposite(free)] === backend.uid) return null;
  await backend.update({
    [`${roomPath(code)}/players/${free}`]: backend.uid,
    [`${roomPath(code)}/startedAt`]: SERVER_TIME,
  });
  return free;
}

/**
 * Append move number `ply` (0-based). With `claimDraw`, the mover's draw claim is written
 * in the same update, as FIDE 9.2.1.1 / 9.3.1 require.
 */
export async function appendMove(
  backend: RoomBackend,
  code: string,
  ply: number,
  uci: string,
  claimDraw?: Color,
): Promise<void> {
  const base = roomPath(code);
  const updates: Record<string, unknown> = {
    [`${base}/moves/${ply}`]: { i: ply, m: uci, t: SERVER_TIME },
    [`${base}/n`]: ply + 1,
  };
  if (claimDraw) {
    updates[`${base}/events/${eventKey(ply + 1)}`] = {
      type: 'draw-claim',
      by: claimDraw,
      ply: ply + 1,
      t: SERVER_TIME,
    };
  }
  await backend.update(updates);
}

/** Append an event at the current move count `ply`. */
export async function appendEvent(
  backend: RoomBackend,
  code: string,
  type: MatchEventType,
  by: Color,
  ply: number,
): Promise<void> {
  await backend.update({
    [`${roomPath(code)}/events/${eventKey(ply)}`]: { type, by, ply, t: SERVER_TIME },
  });
}

export async function voteRematch(backend: RoomBackend, code: string, seat: Color): Promise<void> {
  await backend.update({ [`${roomPath(code)}/rematch/${seat}`]: true });
}

/**
 * Create the rematch room with colours swapped and link it from the old room in the same
 * update. The old room's White does this once both voted; the rules allow `next` only
 * once, so even a duplicate attempt fails as a whole and leaves nothing behind.
 */
export async function createRematch(backend: RoomBackend, room: Room): Promise<string> {
  const mySeat: Color = room.players.w === backend.uid ? 'w' : 'b';
  return createRoom(
    backend,
    {
      initialMs: room.config.initialMs,
      incrementMs: room.config.incrementMs,
      public: false,
      creatorColor: opposite(mySeat),
      prev: room.code,
    },
    (code) => ({ [`${roomPath(room.code)}/next`]: code }),
  );
}

export async function listOpenRooms(backend: RoomBackend, limit = 30): Promise<Room[]> {
  const raw = await backend.newestRooms(limit);
  return Object.entries(raw)
    .map(([code, value]) => parseRoom(code, value))
    .filter(
      (room): room is Room => room !== null && isOpenRoom(room) && room.createdBy !== backend.uid,
    )
    .sort((a, b) => b.createdAt - a.createdAt);
}

/** Sortable, unique-enough key for an appended event: ply, then time, then randomness. */
function eventKey(ply: number): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `${String(ply).padStart(4, '0')}-${Date.now().toString(36)}-${random}`;
}
