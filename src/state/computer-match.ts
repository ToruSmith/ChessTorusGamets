// A game against Stockfish. The moves live in a LocalMatch (untimed), so results come
// from the same replay as every other mode; this class adds the engine's replies.
import { levelById, type UciEngine } from '../ai/index.ts';
import {
  STARTING_FEN,
  loadOpeningBook,
  type Color,
  type MoveInput,
  type OpeningBook,
  type Square,
} from '../core/index.ts';
import { LocalMatch, type LocalRecord } from './local-match.ts';
import type { MatchSnapshot } from './snapshot.ts';
import { WritableStore, type Store } from './store.ts';

export interface ComputerRecord {
  readonly version: 1;
  readonly humanColor: Color;
  readonly level: number;
  readonly game: LocalRecord;
}

export interface ComputerSnapshot extends MatchSnapshot {
  readonly humanColor: Color;
  readonly level: number;
  /** The engine is choosing its move. */
  readonly thinking: boolean;
  /** A suggested move for the human, after asking for a hint. */
  readonly hint: { readonly from: Square; readonly to: Square } | null;
}

export interface ComputerOptions {
  /** Minimum time before the computer moves, so its reply does not feel instant. */
  readonly minDelayMs?: number;
  /** Lichess opening book for varied openings and as a fallback; null disables it. */
  readonly book?: Promise<OpeningBook> | null;
  readonly random?: () => number;
}

/** The computer follows the opening book (when the game started normally) for this many plies. */
const BOOK_PLIES = 12;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class ComputerMatch {
  readonly #engine: UciEngine;
  readonly #local: LocalMatch;
  readonly #humanColor: Color;
  readonly #level: number;
  readonly #minDelayMs: number;
  readonly #book: Promise<OpeningBook> | null;
  readonly #random: () => number;
  readonly #store: WritableStore<ComputerSnapshot>;
  #thinking = false;
  #hint: ComputerSnapshot['hint'] = null;
  /** Bumped by undo/dispose so a stale engine reply is ignored. */
  #generation = 0;
  readonly #unsubscribe: () => void;

  private constructor(
    engine: UciEngine,
    local: LocalMatch,
    humanColor: Color,
    level: number,
    options: ComputerOptions,
  ) {
    this.#engine = engine;
    this.#local = local;
    this.#humanColor = humanColor;
    this.#level = levelById(level).id;
    this.#minDelayMs = options.minDelayMs ?? 300;
    this.#book = options.book === undefined ? loadOpeningBook() : options.book;
    this.#random = options.random ?? Math.random;
    this.#store = new WritableStore(this.#snapshot());
    this.#unsubscribe = local.store.subscribe(() => this.#emit());
  }

  static create(
    engine: UciEngine,
    settings: { humanColor: Color; level: number },
    options: ComputerOptions = {},
  ): ComputerMatch {
    void engine.newGame();
    return new ComputerMatch(
      engine,
      LocalMatch.create({ timeControl: null }),
      settings.humanColor,
      settings.level,
      options,
    );
  }

  static fromJSON(
    engine: UciEngine,
    value: unknown,
    options: ComputerOptions = {},
  ): ComputerMatch | null {
    if (typeof value !== 'object' || value === null) return null;
    const record = value as Partial<ComputerRecord>;
    if (record.version !== 1 || (record.humanColor !== 'w' && record.humanColor !== 'b'))
      return null;
    if (typeof record.level !== 'number') return null;
    const local = LocalMatch.fromJSON(record.game);
    if (!local || local.toJSON().timeControl !== null) return null;
    return new ComputerMatch(engine, local, record.humanColor, record.level, options);
  }

  toJSON(): ComputerRecord {
    return {
      version: 1,
      humanColor: this.#humanColor,
      level: this.#level,
      game: this.#local.toJSON(),
    };
  }

  get store(): Store<ComputerSnapshot> {
    return this.#store;
  }

  get snapshot(): ComputerSnapshot {
    return this.#store.get();
  }

  /** Let the computer move if it is its turn (e.g. it plays White, or after restoring). */
  start(): void {
    void this.#respond();
  }

  dispose(): void {
    this.#generation += 1;
    this.#unsubscribe();
  }

  play(move: MoveInput): boolean {
    if (!this.#humanToMove()) return false;
    if (!this.#local.play(move)) return false;
    this.#hint = null;
    this.#emit();
    void this.#respond();
    return true;
  }

  /** Take back to the human's previous turn (the computer's reply and the human's move). */
  undo(): boolean {
    const history = this.#local.snapshot.history;
    if (history.length === 0) return false;
    this.#generation += 1;
    if (this.#thinking) this.#engine.stop();
    this.#thinking = false;
    this.#hint = null;
    do {
      if (!this.#local.undo()) break;
    } while (
      this.#local.snapshot.turn !== this.#humanColor &&
      this.#local.snapshot.history.length > 0
    );
    this.#emit();
    void this.#respond();
    return true;
  }

  resign(): void {
    if (this.#local.snapshot.result) return;
    this.#generation += 1;
    if (this.#thinking) this.#engine.stop();
    this.#thinking = false;
    this.#local.resign(this.#humanColor);
  }

  claimDraw(): boolean {
    return this.#humanToMove() && this.#local.claimDraw();
  }

  async hint(): Promise<void> {
    if (!this.#humanToMove()) return;
    const generation = this.#generation;
    const fen = this.#local.snapshot.fen;
    const result = await this.#engine.search({ fen, depth: 12 });
    if (generation !== this.#generation || this.#local.snapshot.fen !== fen || !result.bestMove)
      return;
    this.#hint = {
      from: result.bestMove.slice(0, 2) as Square,
      to: result.bestMove.slice(2, 4) as Square,
    };
    this.#emit();
  }

  #humanToMove(): boolean {
    const snapshot = this.#local.snapshot;
    return !snapshot.result && !this.#thinking && snapshot.turn === this.#humanColor;
  }

  async #respond(): Promise<void> {
    const snapshot = this.#local.snapshot;
    if (snapshot.result || this.#thinking || snapshot.turn === this.#humanColor) return;
    const generation = this.#generation;
    this.#thinking = true;
    this.#emit();
    const level = levelById(this.#level);
    const history = snapshot.history.map((move) => move.uci);
    const bookMoves = await this.#bookMoves(history);
    let move: string | null = null;
    let claim = false;
    if (bookMoves.length > 0 && history.length < BOOK_PLIES) {
      // Lichess opening book: varied, sound openings.
      move = this.#pick(bookMoves);
      await sleep(this.#minDelayMs);
    } else {
      try {
        const [result] = await Promise.all([
          this.#engine.search({
            fen: snapshot.fen,
            depth: level.depth,
            movetime: level.movetime,
            skill: level.skill,
          }),
          sleep(this.#minDelayMs),
        ]);
        const own =
          result.score?.type === 'cp'
            ? result.score.value
            : result.score
              ? Math.sign(result.score.value) * 10_000
              : 0;
        // The computer claims an available draw (FIDE 9.2, 9.3) when it is not better.
        claim = Boolean(snapshot.drawClaim) && own <= 0;
        move = result.bestMove;
      } catch {
        // Engine unavailable: fall back to the book, then to any legal move.
        move =
          bookMoves.length > 0
            ? this.#pick(bookMoves)
            : this.#pick(snapshot.legalMoves.map((m) => m.uci));
      }
    }
    if (generation !== this.#generation) return;
    this.#thinking = false;
    if (claim) this.#local.claimDraw();
    else if (move) this.#local.play(move);
    this.#emit();
  }

  async #bookMoves(history: readonly string[]): Promise<string[]> {
    if (!this.#book || this.#local.toJSON().startFen !== STARTING_FEN) return [];
    try {
      return (await this.#book).continuations(history);
    } catch {
      return [];
    }
  }

  #pick(moves: readonly string[]): string | null {
    return moves[Math.floor(this.#random() * moves.length)] ?? null;
  }

  #emit(): void {
    this.#store.set(this.#snapshot());
  }

  #snapshot(): ComputerSnapshot {
    const base = this.#local.snapshot;
    const humanTurn = !base.result && !this.#thinking && base.turn === this.#humanColor;
    return {
      ...base,
      legalMoves: humanTurn ? base.legalMoves : [],
      drawClaim: humanTurn ? base.drawClaim : null,
      // Undo needs at least one human move to take back.
      canUndo: base.history.some((move) => move.color === this.#humanColor),
      humanColor: this.#humanColor,
      level: this.#level,
      thinking: this.#thinking,
      hint: humanTurn ? this.#hint : null,
    };
  }
}
