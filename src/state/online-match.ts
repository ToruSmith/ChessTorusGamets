// One online room as seen by this client. The room data is the whole truth: every change
// is parsed and replayed with core's replayMatch, the same judge as local play.
import {
  isFlagged,
  replayMatch,
  type Color,
  type DrawClaimReason,
  type MatchEventType,
  type MatchState,
  type MoveInput,
} from '../core/index.ts';
import {
  appendEvent,
  appendMove,
  createRematch,
  joinRoom,
  parseRoom,
  readRoom,
  roomRecord,
  seatOf,
  timeControlOf,
  voteRematch,
  type Room,
  type RoomBackend,
} from '../online/index.ts';
import { buildSnapshot, type MatchSnapshot } from './snapshot.ts';
import { WritableStore, type Store } from './store.ts';

export type OnlinePhase = 'loading' | 'missing' | 'waiting' | 'playing' | 'over';

export interface OnlineSnapshot {
  readonly phase: OnlinePhase;
  readonly code: string;
  readonly room: Room | null;
  /** This client's seat, or null for a spectator. */
  readonly seat: Color | null;
  /** The board state once the game has started. */
  readonly match: MatchSnapshot | null;
  /** A visitor may take the free seat. */
  readonly canJoin: boolean;
  readonly rematch: Readonly<Partial<Record<Color, true>>>;
  readonly next: string | null;
  /**
   * Engine analysis and hints are allowed only after the game is over. Every feature that
   * uses an engine (M4) must check this.
   */
  readonly analysisAllowed: boolean;
  /** The last write the server refused, if any. */
  readonly error: string | null;
}

export class OnlineMatch {
  readonly #backend: RoomBackend;
  readonly #code: string;
  readonly #store: WritableStore<OnlineSnapshot>;
  #room: Room | null = null;
  #loaded = false;
  #state: MatchState | null = null;
  #error: string | null = null;
  #unsubscribe: (() => void) | null = null;
  #rematchStarted = false;
  #autoJoinChecked = false;

  constructor(backend: RoomBackend, code: string) {
    this.#backend = backend;
    this.#code = code;
    this.#store = new WritableStore(this.#snapshot());
  }

  get store(): Store<OnlineSnapshot> {
    return this.#store;
  }

  get snapshot(): OnlineSnapshot {
    return this.#store.get();
  }

  start(): void {
    this.#unsubscribe ??= this.#backend.watch(`rooms/${this.#code}`, (value) => {
      this.#loaded = true;
      this.#room = parseRoom(this.#code, value);
      this.#refresh();
      void this.#afterUpdate();
    });
  }

  dispose(): void {
    this.#unsubscribe?.();
    this.#unsubscribe = null;
  }

  async join(): Promise<boolean> {
    return this.#write(async () => (await joinRoom(this.#backend, this.#code)) !== null);
  }

  /** Would this move let the mover claim a draw together with it (FIDE 9.2.1.1, 9.3.1)? */
  claimAfter(move: MoveInput): DrawClaimReason | null {
    return this.#myTurn() ? (this.#state?.game.drawClaimReasonAfter(move) ?? null) : null;
  }

  async play(move: MoveInput, options: { claimDraw?: boolean } = {}): Promise<boolean> {
    const seat = this.snapshot.seat;
    const room = this.#room;
    const legal = this.#myTurn() ? this.#state?.game.findLegal(move) : null;
    if (!seat || !room || !legal) return false;
    return this.#write(async () => {
      await appendMove(
        this.#backend,
        this.#code,
        room.n,
        legal.uci,
        options.claimDraw ? seat : undefined,
      );
      return true;
    });
  }

  resign(): Promise<boolean> {
    return this.#event('resign');
  }

  offerDraw(): Promise<boolean> {
    return this.#event('draw-offer');
  }

  acceptDraw(): Promise<boolean> {
    return this.#event('draw-accept');
  }

  claimDraw(): Promise<boolean> {
    return this.#event('draw-claim');
  }

  async voteRematch(): Promise<boolean> {
    const seat = this.snapshot.seat;
    if (!seat || this.snapshot.phase !== 'over' || this.#room?.rematch[seat]) return false;
    return this.#write(async () => {
      await voteRematch(this.#backend, this.#code, seat);
      return true;
    });
  }

  /** Re-judge with the current server time; call regularly while a timed game is on. */
  tick(): void {
    const clock = this.#state?.clock;
    if (
      this.#state &&
      !this.#state.result &&
      clock &&
      isFlagged(clock, this.#backend.serverNow())
    ) {
      this.#refresh();
    }
  }

  #myTurn(): boolean {
    const { seat, phase } = this.snapshot;
    return phase === 'playing' && seat !== null && this.#state?.game.turn() === seat;
  }

  async #event(type: MatchEventType): Promise<boolean> {
    const seat = this.snapshot.seat;
    if (!seat || this.snapshot.phase !== 'playing') return false;
    // The rules require ply === n; if a move lands in between, retry once with the new n.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const room = attempt === 0 ? this.#room : await readRoom(this.#backend, this.#code);
      if (!room) return false;
      try {
        await appendEvent(this.#backend, this.#code, type, seat, room.n);
        this.#setError(null);
        return true;
      } catch (error) {
        if (attempt === 1) this.#setError(String(error));
      }
    }
    return false;
  }

  async #write(action: () => Promise<boolean>): Promise<boolean> {
    try {
      const ok = await action();
      this.#setError(null);
      return ok;
    } catch (error) {
      this.#setError(String(error));
      return false;
    }
  }

  /** Follow-ups that happen on their own: rematch room creation and joining it. */
  async #afterUpdate(): Promise<void> {
    const room = this.#room;
    const seat = this.snapshot.seat;
    if (!room) return;
    // The previous game's White creates the rematch room, so it is created exactly once.
    if (seat === 'w' && room.rematch.w && room.rematch.b && !room.next && !this.#rematchStarted) {
      this.#rematchStarted = true;
      try {
        await createRematch(this.#backend, room);
      } catch {
        // Allow another attempt on the next update (e.g. a temporary network error).
        this.#rematchStarted = false;
      }
    }
    if (!seat && room.prev && room.startedAt === null && !this.#autoJoinChecked) {
      this.#autoJoinChecked = true;
      const previous = await readRoom(this.#backend, room.prev);
      if (previous && seatOf(previous, this.#backend.uid) && previous.next === room.code) {
        await this.join();
      }
    }
  }

  #setError(error: string | null): void {
    if (error === this.#error) return;
    this.#error = error;
    this.#store.set(this.#snapshot());
  }

  #refresh(): void {
    const room = this.#room;
    this.#state =
      room && room.startedAt !== null
        ? replayMatch(roomRecord(room), this.#backend.serverNow())
        : null;
    this.#store.set(this.#snapshot());
  }

  #snapshot(): OnlineSnapshot {
    const room = this.#room;
    const state = this.#state;
    const seat = room ? seatOf(room, this.#backend.uid) : null;
    const phase: OnlinePhase = !this.#loaded
      ? 'loading'
      : !room
        ? 'missing'
        : room.startedAt === null
          ? 'waiting'
          : state?.result
            ? 'over'
            : 'playing';

    let match: MatchSnapshot | null = null;
    if (room && state) {
      const full = buildSnapshot(state, timeControlOf(room.config), {
        clockStarted: true,
        canUndo: false,
      });
      const myTurn = seat !== null && full.turn === seat;
      match = {
        ...full,
        legalMoves: myTurn ? full.legalMoves : [],
        drawClaim: myTurn ? full.drawClaim : null,
      };
    }

    return {
      phase,
      code: this.#code,
      room,
      seat,
      match,
      canJoin:
        phase === 'waiting' &&
        seat === null &&
        room !== null &&
        Object.keys(room.players).length === 1,
      rematch: room?.rematch ?? {},
      next: room?.next ?? null,
      analysisAllowed: phase === 'over',
      error: this.#error,
    };
  }
}
