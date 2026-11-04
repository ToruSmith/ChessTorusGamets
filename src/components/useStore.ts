import { useSyncExternalStore } from 'react';
import type { Store } from '../state/index.ts';

/** Subscribe a component to a state-layer store. */
export function useStore<T>(store: Store<T>): T {
  return useSyncExternalStore(
    (listener) => store.subscribe(listener),
    () => store.get(),
  );
}
