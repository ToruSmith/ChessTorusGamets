// Post-game review: replays a finished game, asks the engine about every position and
// judges every move. Starts only from a snapshot's `analysis` request (game over).
import {
  ANALYSIS_DEPTH,
  judgeMove,
  whiteCentipawns,
  whiteWinPercent,
  type MoveJudgement,
  type UciEngine,
} from '../ai/index.ts';
import {
  Game,
  checkFen,
  type Color,
  type GameResult,
  type Move,
  type PlacedPiece,
  type Square,
} from '../core/index.ts';
import type { AnalysisRequest } from './snapshot.ts';
import { WritableStore, type Store } from './store.ts';

export interface PositionView {
  readonly fen: string;
  readonly turn: Color;
  readonly pieces: readonly PlacedPiece[];
  readonly lastMove: Move | null;
  readonly checkSquare: Square | null;
}

export interface PositionEval {
  /** White's win chance, 0–100. */
  readonly win: number;
  /** From White's point of view, in centipawns (mates near ±10000). */
  readonly centipawns: number;
  /** Moves to mate from White's point of view (negative: Black mates), if any. */
  readonly mate: number | null;
  /** The engine's choice in this position (UCI), if the game goes on. */
  readonly best: string | null;
}

export type MistakeCounts = Record<'inaccuracy' | 'mistake' | 'blunder', number>;

export interface AnalysisSnapshot {
  readonly startFen: string;
  readonly result: GameResult;
  readonly moves: readonly Move[];
  /** Position after 0, 1, … n moves. */
  readonly positions: readonly PositionView[];
  readonly evals: readonly (PositionEval | null)[];
  /** Judgement of move i (the move leading to position i + 1). */
  readonly judgements: readonly (MoveJudgement | null)[];
  /** The position being shown. */
  readonly index: number;
  /** Positions analysed so far, 0–1. */
  readonly progress: number;
  readonly done: boolean;
  readonly summary: Record<Color, MistakeCounts>;
}

/** Validate a stored request (e.g. from localStorage). */
export function parseAnalysisRequest(value: unknown): AnalysisRequest | null {
  if (typeof value !== 'object' || value === null) return null;
  const r = value as Partial<AnalysisRequest>;
  if (typeof r.startFen !== 'string' || !checkFen(r.startFen).ok) return null;
  if (!Array.isArray(r.moves) || !r.moves.every((m) => typeof m === 'string')) return null;
  const result = r.result;
  if (typeof result !== 'object' || result === null || typeof result.reason !== 'string')
    return null;
  try {
    Game.fromUci(r.moves, r.startFen);
  } catch {
    return null;
  }
  return { startFen: r.startFen, moves: r.moves, result };
}

export class AnalysisSession {
  readonly #engine: UciEngine;
  readonly #store: WritableStore<AnalysisSnapshot>;
  #disposed = false;

  constructor(engine: UciEngine, request: AnalysisRequest) {
    this.#engine = engine;
    const game = new Game(request.startFen);
    const positions: PositionView[] = [view(game)];
    for (const uci of request.moves) {
      game.play(uci);
      positions.push(view(game));
    }
    this.#store = new WritableStore<AnalysisSnapshot>({
      startFen: game.startFen,
      result: request.result,
      moves: [...game.moves],
      positions,
      evals: positions.map(() => null),
      judgements: game.moves.map(() => null),
      index: positions.length - 1,
      progress: 0,
      done: false,
      summary: { w: emptyCounts(), b: emptyCounts() },
    });
  }

  get store(): Store<AnalysisSnapshot> {
    return this.#store;
  }

  get snapshot(): AnalysisSnapshot {
    return this.#store.get();
  }

  /** Analyse every position, first to last, updating the snapshot as results arrive. */
  async start(depth: number = ANALYSIS_DEPTH): Promise<void> {
    const { positions, startFen, moves } = this.snapshot;
    const game = new Game(startFen);
    for (let i = 0; i < positions.length; i += 1) {
      if (this.#disposed) return;
      if (i > 0) game.play(moves[i - 1]?.uci ?? '');
      const evaluation = await this.#evaluate(game, depth);
      if (this.#disposed) return;
      this.#setEval(i, evaluation);
    }
  }

  dispose(): void {
    this.#disposed = true;
  }

  goTo(index: number): void {
    const last = this.snapshot.positions.length - 1;
    this.#store.set({ ...this.snapshot, index: Math.max(0, Math.min(last, index)) });
  }

  async #evaluate(game: Game, depth: number): Promise<PositionEval> {
    const final = game.automaticResult();
    if (final) {
      const win = final.winner === 'w' ? 100 : final.winner === 'b' ? 0 : 50;
      const centipawns = final.winner === 'w' ? 10_000 : final.winner === 'b' ? -10_000 : 0;
      return { win, centipawns, mate: null, best: null };
    }
    const result = await this.#engine.search({ fen: game.fen(), depth });
    const turn = game.turn();
    const score = result.score ?? { type: 'cp' as const, value: 0 };
    const centipawns = whiteCentipawns(score, turn);
    const mate = score.type === 'mate' ? (turn === 'w' ? score.value : -score.value) : null;
    return { win: whiteWinPercent(centipawns), centipawns, mate, best: result.bestMove };
  }

  #setEval(index: number, evaluation: PositionEval): void {
    const snapshot = this.snapshot;
    const evals = [...snapshot.evals];
    evals[index] = evaluation;
    const judgements = snapshot.moves.map((move, i) => {
      const before = evals[i];
      const after = evals[i + 1];
      if (!before || !after) return null;
      return judgeMove(move.color, before.win, after.win, before.best === move.uci);
    });
    const summary = { w: emptyCounts(), b: emptyCounts() };
    judgements.forEach((judgement, i) => {
      const color = snapshot.moves[i]?.color;
      if (
        color &&
        (judgement === 'inaccuracy' || judgement === 'mistake' || judgement === 'blunder')
      ) {
        summary[color][judgement] += 1;
      }
    });
    const analysed = evals.filter(Boolean).length;
    this.#store.set({
      ...snapshot,
      evals,
      judgements,
      summary,
      progress: analysed / evals.length,
      done: analysed === evals.length,
    });
  }
}

function emptyCounts(): MistakeCounts {
  return { inaccuracy: 0, mistake: 0, blunder: 0 };
}

function view(game: Game): PositionView {
  const pieces = game.pieces();
  const turn = game.turn();
  return {
    fen: game.fen(),
    turn,
    pieces,
    lastMove: game.lastMove,
    checkSquare: game.inCheck()
      ? (pieces.find((p) => p.type === 'k' && p.color === turn)?.square ?? null)
      : null,
  };
}
