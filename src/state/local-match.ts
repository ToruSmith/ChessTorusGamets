// Two players on one device. The record (moves with local timestamps + events) is the
// whole truth; every change replays it with core's replayMatch, the same judge online
// play uses.
import {
  STARTING_FEN,
  checkFen,
  isFlagged,
  opposite,
  replayMatch,
  type MatchEvent,
  type MatchEventType,
  type MatchState,
  type MoveInput,
  type TimeControl,
  type TimedMove,
} from '../core/index.ts';
import { buildSnapshot, type MatchSnapshot } from './snapshot.ts';
import { WritableStore, type Store } from './store.ts';

export interface LocalRecord {
  readonly version: 1;
  readonly startFen: string;
  readonly timeControl: TimeControl | null;
  readonly moves: readonly TimedMove[];
  readonly events: readonly MatchEvent[];
}

export interface LocalMatchOptions {
  readonly timeControl: TimeControl | null;
  readonly startFen?: string;
}

export type Clock = () => number;

export class LocalMatch {
  readonly #store: WritableStore<MatchSnapshot>;
  readonly #now: Clock;
  #record: LocalRecord;
  #state: MatchState;

  private constructor(record: LocalRecord, now: Clock) {
    this.#record = record;
    this.#now = now;
    this.#state = this.#replay();
    this.#store = new WritableStore(this.#snapshot());
  }

  static create(options: LocalMatchOptions, now: Clock = Date.now): LocalMatch {
    return new LocalMatch(
      {
        version: 1,
        startFen: options.startFen ?? STARTING_FEN,
        timeControl: options.timeControl,
        moves: [],
        events: [],
      },
      now,
    );
  }

  /** Restore a saved record; returns null when it is not a valid record. */
  static fromJSON(value: unknown, now: Clock = Date.now): LocalMatch | null {
    return isLocalRecord(value) ? new LocalMatch(value, now) : null;
  }

  toJSON(): LocalRecord {
    return this.#record;
  }

  get store(): Store<MatchSnapshot> {
    return this.#store;
  }

  get snapshot(): MatchSnapshot {
    return this.#store.get();
  }

  /** Play a move for the side to move. Returns false when it is not legal or the game is over. */
  play(input: MoveInput | string): boolean {
    this.tick();
    if (this.#state.result) return false;
    const move = this.#state.game.findLegal(input);
    if (!move) return false;
    this.#update({ moves: [...this.#record.moves, { uci: move.uci, t: this.#time() }] });
    return true;
  }

  /** Take back the last move (untimed games only), with any events written after it. */
  undo(): boolean {
    if (!this.snapshot.canUndo) return false;
    const moves = this.#record.moves.slice(0, -1);
    const events = this.#record.events.filter((event) => event.ply <= moves.length);
    this.#update({ moves, events });
    return true;
  }

  /** The side to move resigns. */
  resign(): void {
    this.#event('resign', this.#state.game.turn());
  }

  /** The side to move offers a draw. */
  offerDraw(): void {
    if (this.#state.drawOffer === null) this.#event('draw-offer', this.#state.game.turn());
  }

  /** The opponent of the offering side accepts the standing offer. */
  acceptDraw(): void {
    const offer = this.#state.drawOffer;
    if (offer !== null) this.#event('draw-accept', opposite(offer));
  }

  /** The side to move claims a draw (threefold repetition or the 50-move rule). */
  claimDraw(): boolean {
    if (!this.snapshot.drawClaim) return false;
    this.#event('draw-claim', this.#state.game.turn());
    return this.#state.result !== null;
  }

  /** Check the running clock; call it regularly while a timed game is on. */
  tick(): void {
    const { clock, result } = this.#state;
    if (!result && clock && this.#clockStarted() && isFlagged(clock, this.#now())) this.#refresh();
  }

  #event(type: MatchEventType, by: MatchEvent['by']): void {
    this.tick();
    if (this.#state.result) return;
    const event: MatchEvent = { type, by, ply: this.#record.moves.length, t: this.#time() };
    this.#update({ events: [...this.#record.events, event] });
  }

  #update(change: Partial<Pick<LocalRecord, 'moves' | 'events'>>): void {
    this.#record = { ...this.#record, ...change };
    this.#refresh();
  }

  #refresh(): void {
    this.#state = this.#replay();
    this.#store.set(this.#snapshot());
  }

  /** The clock starts with White's first move, so nobody loses time before the game begins. */
  #clockStarted(): boolean {
    return this.#record.moves.length > 0;
  }

  /** Never earlier than the last recorded time, so the record stays in order. */
  #time(): number {
    const last = Math.max(
      0,
      ...this.#record.moves.map((m) => m.t),
      ...this.#record.events.map((e) => e.t),
    );
    return Math.max(this.#now(), last);
  }

  #replay(): MatchState {
    const { startFen, timeControl, moves, events } = this.#record;
    const startedAt = moves[0]?.t ?? this.#now();
    const record = { startFen, timeControl, startedAt, moves, events };
    return this.#clockStarted() ? replayMatch(record, this.#now()) : replayMatch(record);
  }

  #snapshot(): MatchSnapshot {
    return buildSnapshot(this.#state, this.#record.timeControl, {
      clockStarted: this.#clockStarted(),
      canUndo: this.#record.timeControl === null && this.#record.moves.length > 0,
    });
  }
}

const EVENT_TYPES: readonly string[] = ['resign', 'draw-offer', 'draw-accept', 'draw-claim'];

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isLocalRecord(value: unknown): value is LocalRecord {
  if (!isObject(value) || value['version'] !== 1) return false;
  const { startFen, timeControl, moves, events } = value;
  if (typeof startFen !== 'string' || !checkFen(startFen).ok) return false;
  if (
    timeControl !== null &&
    !(
      isObject(timeControl) &&
      typeof timeControl['initialMs'] === 'number' &&
      typeof timeControl['incrementMs'] === 'number'
    )
  ) {
    return false;
  }
  if (!Array.isArray(moves) || !Array.isArray(events)) return false;
  const validMove = (m: unknown) =>
    isObject(m) && typeof m['uci'] === 'string' && typeof m['t'] === 'number';
  const validEvent = (e: unknown) =>
    isObject(e) &&
    typeof e['type'] === 'string' &&
    EVENT_TYPES.includes(e['type']) &&
    (e['by'] === 'w' || e['by'] === 'b') &&
    typeof e['ply'] === 'number' &&
    typeof e['t'] === 'number';
  return moves.every(validMove) && events.every(validEvent);
}
