// The only module that uses the Firebase SDK. Loaded on demand when entering online play.
import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import {
  get,
  getDatabase,
  limitToLast,
  onValue,
  orderByChild,
  query,
  ref,
  serverTimestamp,
  update,
} from 'firebase/database';
import { isServerTime, type FirebaseWebConfig, type RoomBackend } from '../types.ts';

let app: FirebaseApp | null = null;

/** Replace our SERVER_TIME placeholders with Firebase's own sentinel. */
function withServerTime(value: unknown): unknown {
  if (isServerTime(value)) return serverTimestamp();
  if (typeof value !== 'object' || value === null) return value;
  return Object.fromEntries(Object.entries(value).map(([key, v]) => [key, withServerTime(v)]));
}

export async function connectFirebase(config: FirebaseWebConfig): Promise<RoomBackend> {
  app ??= initializeApp(config);
  const auth = getAuth(app);
  const credential = auth.currentUser ? null : await signInAnonymously(auth);
  const uid = auth.currentUser?.uid ?? credential?.user.uid;
  if (!uid) throw new Error('Anonymous sign-in failed');
  const db = getDatabase(app);

  let offset = 0;
  onValue(ref(db, '.info/serverTimeOffset'), (snapshot) => {
    offset = Number(snapshot.val()) || 0;
  });

  return {
    uid,
    serverNow: () => Date.now() + offset,
    get: async (path) => (await get(ref(db, path))).val() ?? null,
    watch: (path, callback) =>
      onValue(ref(db, path), (snapshot) => callback(snapshot.val() ?? null)),
    update: async (updates) => {
      await update(ref(db), withServerTime(updates) as Record<string, unknown>);
    },
    newestRooms: async (limit) =>
      ((await get(query(ref(db, 'rooms'), orderByChild('createdAt'), limitToLast(limit)))).val() ??
        {}) as Record<string, unknown>,
  };
}
