// A same-browser stand-in for Firebase, used only by the e2e build (VITE_ONLINE_BACKEND=local).
// Tabs share the data through localStorage and hear about each other's writes through the
// `storage` event, which fires only once the new value is visible in that tab. (A
// BroadcastChannel message can arrive before localStorage has synced, so it is not used.)
// It does not enforce database.rules.json; tests/online covers the rules.
import { applyUpdates, getAt, resolveServerTime, type Tree } from './tree.ts';
import type { RoomBackend } from './types.ts';

const STORAGE_KEY = 'chess.e2e.db';
const UID_KEY = 'chess.e2e.uid';

export function connectLocal(): RoomBackend {
  let uid = sessionStorage.getItem(UID_KEY);
  if (!uid) {
    uid = `local-${crypto.randomUUID()}`;
    sessionStorage.setItem(UID_KEY, uid);
  }
  const read = (): Tree => JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Tree;
  const listeners = new Set<() => void>();
  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY) listeners.forEach((listener) => listener());
  });

  return {
    uid,
    serverNow: () => Date.now(),
    get: async (path) => getAt(read(), path),
    watch: (path, callback) => {
      let last = '';
      const check = () => {
        const value = getAt(read(), path);
        const json = JSON.stringify(value);
        if (json !== last) {
          last = json;
          callback(value);
        }
      };
      listeners.add(check);
      check();
      return () => listeners.delete(check);
    },
    update: async (updates) => {
      const next = applyUpdates(read(), resolveServerTime(updates, Date.now()) as Tree);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      // The storage event does not fire in the tab that wrote, so tell our own listeners.
      listeners.forEach((listener) => listener());
    },
    newestRooms: async (limit) => {
      const rooms = (getAt(read(), 'rooms') ?? {}) as Tree;
      const entries = Object.entries(rooms).sort(
        ([, a], [, b]) => Number(getAt(a, 'createdAt')) - Number(getAt(b, 'createdAt')),
      );
      return Object.fromEntries(entries.slice(-limit));
    },
  };
}
