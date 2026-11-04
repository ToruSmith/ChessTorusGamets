// A minimal observable value. The UI reads it with useSyncExternalStore (components/useStore.ts).

export interface Store<T> {
  get(): T;
  subscribe(listener: () => void): () => void;
}

export class WritableStore<T> implements Store<T> {
  #value: T;
  readonly #listeners = new Set<() => void>();

  constructor(value: T) {
    this.#value = value;
  }

  get(): T {
    return this.#value;
  }

  set(value: T): void {
    if (Object.is(value, this.#value)) return;
    this.#value = value;
    for (const listener of [...this.#listeners]) listener();
  }

  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }
}
