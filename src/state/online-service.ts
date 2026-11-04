// Entry point for online play: connects once, lists the lobby, creates and opens rooms.
import type { Color, TimeControl } from '../core/index.ts';
import {
  connectBackend,
  createRoom,
  joinRoom,
  listOpenRooms,
  timeControlOf,
  type OnlineConfig,
  type RoomBackend,
} from '../online/index.ts';
import { OnlineMatch } from './online-match.ts';

export type { OnlineConfig };

export interface LobbyRoom {
  readonly code: string;
  readonly timeControl: TimeControl | null;
  /** The colour the visitor would play. */
  readonly yourColor: Color;
  readonly createdAt: number;
}

export interface NewRoomRequest {
  readonly timeControl: TimeControl | null;
  readonly color: Color | 'random';
  readonly public: boolean;
}

export class OnlineService {
  readonly #backend: RoomBackend;

  constructor(backend: RoomBackend) {
    this.#backend = backend;
  }

  async lobby(): Promise<LobbyRoom[]> {
    const rooms = await listOpenRooms(this.#backend);
    return rooms.map((room) => ({
      code: room.code,
      timeControl: timeControlOf(room.config),
      yourColor: room.config.creatorColor === 'w' ? 'b' : 'w',
      createdAt: room.createdAt,
    }));
  }

  createRoom(request: NewRoomRequest, random: () => number = Math.random): Promise<string> {
    const color = request.color === 'random' ? (random() < 0.5 ? 'w' : 'b') : request.color;
    return createRoom(this.#backend, {
      initialMs: request.timeControl?.initialMs ?? 0,
      incrementMs: request.timeControl?.incrementMs ?? 0,
      public: request.public,
      creatorColor: color,
    });
  }

  /** Take the free seat in a room; false when it is no longer free. */
  async join(code: string): Promise<boolean> {
    return (await joinRoom(this.#backend, code)) !== null;
  }

  open(code: string): OnlineMatch {
    return new OnlineMatch(this.#backend, code);
  }
}

const connections = new Map<string, Promise<OnlineService>>();

/** Connect (and sign in anonymously) once per configuration. */
export function getOnlineService(config: OnlineConfig): Promise<OnlineService> {
  const key = JSON.stringify(config);
  let connection = connections.get(key);
  if (!connection) {
    connection = connectBackend(config).then((backend) => new OnlineService(backend));
    connection.catch(() => connections.delete(key));
    connections.set(key, connection);
  }
  return connection;
}
