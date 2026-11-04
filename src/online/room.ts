// Room data as stored in the database, parsed defensively: anything malformed is
// dropped here, and anything well-formed but illegal is judged by core's replay.
import type { Color, MatchEvent, MatchRecord, TimeControl, TimedMove } from '../core/index.ts';
import { CODE_PATTERN } from './code.ts';

export interface RoomConfig {
  /** 0 means untimed. */
  readonly initialMs: number;
  readonly incrementMs: number;
  readonly public: boolean;
  readonly creatorColor: Color;
}

export interface Room {
  readonly code: string;
  readonly createdAt: number;
  readonly createdBy: string;
  readonly config: RoomConfig;
  readonly players: Readonly<Partial<Record<Color, string>>>;
  readonly startedAt: number | null;
  readonly n: number;
  /** Moves 0 … n-1 in order (only those written together with `n`). */
  readonly moves: readonly TimedMove[];
  readonly events: readonly MatchEvent[];
  readonly rematch: Readonly<Partial<Record<Color, true>>>;
  /** Code of the rematch room, once created. */
  readonly next: string | null;
  /** Code of the room this one is a rematch of. */
  readonly prev: string | null;
}

const EVENT_TYPES: readonly string[] = ['resign', 'draw-offer', 'draw-accept', 'draw-claim'];

type Obj = Record<string, unknown>;
const isObj = (value: unknown): value is Obj => typeof value === 'object' && value !== null;
const isColor = (value: unknown): value is Color => value === 'w' || value === 'b';
const num = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

export function parseRoom(code: string, raw: unknown): Room | null {
  if (!isObj(raw) || !CODE_PATTERN.test(code)) return null;
  const config = raw['config'];
  const createdAt = num(raw['createdAt']);
  const n = num(raw['n']);
  if (!isObj(config) || createdAt === null || n === null || typeof raw['createdBy'] !== 'string') {
    return null;
  }
  const initialMs = num(config['initialMs']);
  const incrementMs = num(config['incrementMs']);
  if (
    initialMs === null ||
    incrementMs === null ||
    typeof config['public'] !== 'boolean' ||
    !isColor(config['creatorColor'])
  ) {
    return null;
  }

  const players: Partial<Record<Color, string>> = {};
  const rawPlayers = isObj(raw['players']) ? raw['players'] : {};
  for (const color of ['w', 'b'] as const) {
    const uid = rawPlayers[color];
    if (typeof uid === 'string') players[color] = uid;
  }

  const moves: TimedMove[] = [];
  const rawMoves = raw['moves'];
  for (let i = 0; i < n; i += 1) {
    const move = Array.isArray(rawMoves)
      ? rawMoves[i]
      : isObj(rawMoves)
        ? rawMoves[String(i)]
        : undefined;
    const t = isObj(move) ? num(move['t']) : null;
    if (!isObj(move) || typeof move['m'] !== 'string' || t === null) break;
    moves.push({ uci: move['m'], t });
  }

  const events: MatchEvent[] = [];
  const rawEvents = isObj(raw['events']) ? raw['events'] : {};
  for (const key of Object.keys(rawEvents).sort()) {
    const event = rawEvents[key];
    if (!isObj(event)) continue;
    const ply = num(event['ply']);
    const t = num(event['t']);
    const { type, by } = event;
    if (
      typeof type === 'string' &&
      EVENT_TYPES.includes(type) &&
      isColor(by) &&
      ply !== null &&
      t !== null
    ) {
      events.push({ type: type as MatchEvent['type'], by, ply, t });
    }
  }

  const rematch: Partial<Record<Color, true>> = {};
  const rawRematch = isObj(raw['rematch']) ? raw['rematch'] : {};
  for (const color of ['w', 'b'] as const) if (rawRematch[color] === true) rematch[color] = true;

  const next =
    typeof raw['next'] === 'string' && CODE_PATTERN.test(raw['next']) ? raw['next'] : null;
  const prev =
    typeof raw['prev'] === 'string' && CODE_PATTERN.test(raw['prev']) ? raw['prev'] : null;

  return {
    code,
    createdAt,
    createdBy: raw['createdBy'],
    config: {
      initialMs,
      incrementMs,
      public: config['public'],
      creatorColor: config['creatorColor'],
    },
    players,
    startedAt: num(raw['startedAt']),
    n,
    moves,
    events,
    rematch,
    next,
    prev,
  };
}

export function timeControlOf(config: RoomConfig): TimeControl | null {
  return config.initialMs > 0
    ? { initialMs: config.initialMs, incrementMs: config.incrementMs }
    : null;
}

/** The record core's replayMatch judges. Only meaningful once the game has started. */
export function roomRecord(room: Room): MatchRecord {
  return {
    timeControl: timeControlOf(room.config),
    startedAt: room.startedAt ?? room.createdAt,
    moves: room.moves,
    events: room.events,
  };
}

export function seatOf(room: Room, uid: string): Color | null {
  if (room.players.w === uid) return 'w';
  if (room.players.b === uid) return 'b';
  return null;
}

/** A room the lobby lists: public, one player waiting, not started. */
export function isOpenRoom(room: Room): boolean {
  return room.config.public && room.startedAt === null && Object.keys(room.players).length === 1;
}
