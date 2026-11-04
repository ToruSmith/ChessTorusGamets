// The only thing room logic knows about storage. Firebase, the e2e local backend and the
// rules simulator used in tests all implement it.

/** Placeholder replaced by the server's clock when written. Same shape as Firebase's serverTimestamp(). */
export const SERVER_TIME = Object.freeze({ '.sv': 'timestamp' });

export function isServerTime(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as Record<string, unknown>)['.sv'] === 'timestamp'
  );
}

export type Unsubscribe = () => void;

export interface RoomBackend {
  /** Anonymous user id of this client. */
  readonly uid: string;
  /** Best estimate of the server clock, in milliseconds. */
  serverNow(): number;
  get(path: string): Promise<unknown>;
  /** Calls `onValue` now and whenever the value at `path` changes. */
  watch(path: string, onValue: (value: unknown) => void): Unsubscribe;
  /** Atomic multi-path update. Rejects when the database rules refuse it. */
  update(updates: Record<string, unknown>): Promise<void>;
  /** The newest rooms by creation time (for the lobby). */
  newestRooms(limit: number): Promise<Record<string, unknown>>;
}

export interface FirebaseWebConfig {
  readonly apiKey: string;
  readonly authDomain: string;
  readonly databaseURL: string;
  readonly projectId: string;
  readonly appId: string;
}

export type OnlineConfig =
  | { readonly kind: 'firebase'; readonly firebase: FirebaseWebConfig }
  /** Same-browser backend for end-to-end tests (localStorage + storage events). */
  | { readonly kind: 'local' };
