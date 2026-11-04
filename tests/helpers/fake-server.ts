// A fake server for online tests: the rules simulator plus a controllable clock.
// Each client is a RoomBackend signed in as its own uid; every write goes through the rules.
import { getAt } from '../../src/online/tree.ts';
import type { RoomBackend } from '../../src/online/index.ts';
import { RulesDatabase } from './rules-db.ts';

export class FakeServer {
  readonly db = new RulesDatabase();
  now = 1_700_000_000_000;
  readonly #listeners = new Set<() => void>();

  advance(ms: number): void {
    this.now += ms;
  }

  client(uid: string): RoomBackend {
    const auth = { uid };
    return {
      uid,
      serverNow: () => this.now,
      get: async (path) => this.db.read(auth, path, this.now),
      watch: (path, callback) => {
        let last = '';
        const check = () => {
          const value = getAt(this.db.data, path);
          const json = JSON.stringify(value);
          if (json !== last) {
            last = json;
            callback(value);
          }
        };
        this.#listeners.add(check);
        check();
        return () => this.#listeners.delete(check);
      },
      update: async (updates) => {
        this.db.update(auth, updates, this.now);
        for (const listener of [...this.#listeners]) listener();
      },
      newestRooms: async (limit) => {
        const query = { orderByChild: 'createdAt', limitToLast: limit };
        const rooms = this.db.read(auth, 'rooms', this.now, query) ?? {};
        const entries = Object.entries(rooms as Record<string, unknown>).sort(
          ([, a], [, b]) => Number(getAt(a, 'createdAt')) - Number(getAt(b, 'createdAt')),
        );
        return Object.fromEntries(entries.slice(-limit));
      },
    };
  }
}
