// A UCI engine behind a line-based transport (a Web Worker in the browser, the npm
// package in Node tests). Requests run one at a time.
import { parseBestMove, parseInfo, type InfoLine, type Score } from './uci.ts';

export interface UciTransport {
  send(line: string): void;
  /** Register the single output handler. */
  onLine(handler: (line: string) => void): void;
  terminate(): void;
}

export interface SearchRequest {
  readonly fen: string;
  readonly depth?: number;
  readonly movetime?: number;
  /** UCI "Skill Level", 0–20. Omitted means full strength. */
  readonly skill?: number;
}

export interface SearchResult {
  /** UCI move, or null when the side to move has no legal moves. */
  readonly bestMove: string | null;
  /** From the side to move's point of view; null if the engine reported none. */
  readonly score: Score | null;
  readonly depth: number;
  readonly pv: readonly string[];
}

export class UciEngine {
  readonly #transport: UciTransport;
  #handler: ((line: string) => void) | null = null;
  #queue: Promise<unknown> = Promise.resolve();
  #ready: Promise<void> | null = null;
  #skill: number | null = null;
  #disposed = false;

  constructor(transport: UciTransport) {
    this.#transport = transport;
    transport.onLine((line) => this.#handler?.(line));
  }

  /** Initialise once. Re-sends `isready` until answered, because some builds drop input while loading. */
  ready(): Promise<void> {
    this.#ready ??= new Promise<void>((resolve, reject) => {
      let attempts = 0;
      let timer: ReturnType<typeof setTimeout> | undefined;
      this.#handler = (line) => {
        if (line === 'readyok') {
          clearTimeout(timer);
          this.#handler = null;
          resolve();
        }
      };
      const poke = () => {
        if (this.#disposed) return reject(new Error('Engine disposed'));
        attempts += 1;
        if (attempts > 100) return reject(new Error('Engine did not start'));
        this.#transport.send('uci');
        this.#transport.send('isready');
        timer = setTimeout(poke, 250);
      };
      poke();
    });
    return this.#ready;
  }

  /** Search a position. Calls `onInfo` with progress lines. */
  search(request: SearchRequest, onInfo?: (info: InfoLine) => void): Promise<SearchResult> {
    return this.#enqueue(async () => {
      await this.ready();
      const skill = request.skill ?? 20;
      if (skill !== this.#skill) {
        this.#transport.send(`setoption name Skill Level value ${skill}`);
        this.#skill = skill;
      }
      return new Promise<SearchResult>((resolve) => {
        let last: InfoLine | null = null;
        this.#handler = (line) => {
          const info = parseInfo(line);
          if (info && info.multipv === 1) {
            last = info;
            onInfo?.(info);
            return;
          }
          const best = parseBestMove(line);
          if (best) {
            this.#handler = null;
            resolve({
              bestMove: best.move,
              score: last?.score ?? null,
              depth: last?.depth ?? 0,
              pv: last?.pv ?? [],
            });
          }
        };
        this.#transport.send(`position fen ${request.fen}`);
        const limits = [
          request.depth !== undefined ? `depth ${request.depth}` : '',
          request.movetime !== undefined ? `movetime ${request.movetime}` : '',
        ].filter(Boolean);
        this.#transport.send(`go ${limits.join(' ') || 'depth 12'}`);
      });
    });
  }

  /** Ask the current search to finish now; its promise resolves with the best move so far. */
  stop(): void {
    this.#transport.send('stop');
  }

  /** Forget hash tables and history between games. */
  newGame(): Promise<void> {
    return this.#enqueue(async () => {
      await this.ready();
      await new Promise<void>((resolve) => {
        this.#handler = (line) => {
          if (line === 'readyok') {
            this.#handler = null;
            resolve();
          }
        };
        this.#transport.send('ucinewgame');
        this.#transport.send('isready');
      });
    });
  }

  dispose(): void {
    this.#disposed = true;
    this.#transport.terminate();
  }

  #enqueue<T>(task: () => Promise<T>): Promise<T> {
    const next = this.#queue.then(task, task);
    this.#queue = next.catch(() => undefined);
    return next;
  }
}
