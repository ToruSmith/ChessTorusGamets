// The only module that talks to chess.js. Everything it returns uses the types in ./types.ts.
import { Chess, validateFen, type Move as ChessJsMove } from 'chess.js';
import { canCheckmate, isDeadByMaterial, type PlacedPiece } from './material.ts';
import type { DrawClaimReason, GameResult } from './outcome.ts';
import { SQUARES } from './square.ts';
import {
  STARTING_FEN,
  opposite,
  type Color,
  type Move,
  type MoveInput,
  type Piece,
  type PromotionPiece,
  type Square,
} from './types.ts';
import { parseUci, toUci } from './uci.ts';

export class InvalidFenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidFenError';
  }
}

export class IllegalMoveError extends Error {
  readonly move: string;
  constructor(move: string, message = `Illegal move: ${move}`) {
    super(message);
    this.name = 'IllegalMoveError';
    this.move = move;
  }
}

export type FenCheck = { ok: true } | { ok: false; error: string };

const CASTLING_HOME: Record<string, { king: Square; rook: Square; color: Color }> = {
  K: { king: 'e1', rook: 'h1', color: 'w' },
  Q: { king: 'e1', rook: 'a1', color: 'w' },
  k: { king: 'e8', rook: 'h8', color: 'b' },
  q: { king: 'e8', rook: 'a8', color: 'b' },
};

/**
 * Validate a FEN for play: well-formed, one king each, castling rights that match the
 * king and rook squares, no pawns on the first or last rank, and the side that just
 * moved is not in check.
 */
export function checkFen(fen: string): FenCheck {
  const basic = validateFen(fen);
  if (!basic.ok) return { ok: false, error: basic.error ?? 'Invalid FEN' };
  const chess = new Chess(fen);
  const castling = fen.split(' ')[2] ?? '-';
  for (const flag of castling === '-' ? [] : castling.split('')) {
    const home = CASTLING_HOME[flag];
    const king = home && chess.get(home.king);
    const rook = home && chess.get(home.rook);
    if (
      !home ||
      king?.type !== 'k' ||
      king.color !== home.color ||
      rook?.type !== 'r' ||
      rook.color !== home.color
    ) {
      return { ok: false, error: `Invalid FEN: castling right ${flag} without king and rook` };
    }
  }
  for (const square of SQUARES) {
    if (chess.get(square)?.type === 'p' && (square[1] === '1' || square[1] === '8')) {
      return { ok: false, error: 'Invalid FEN: pawn on the first or last rank' };
    }
  }
  const waiting = opposite(chess.turn());
  const [waitingKing] = chess.findPiece({ type: 'k', color: waiting });
  if (waitingKing && chess.isAttacked(waitingKing, chess.turn())) {
    return { ok: false, error: 'Invalid FEN: the side not to move is in check' };
  }
  return { ok: true };
}

function toMove(move: ChessJsMove): Move {
  const castle = move.isKingsideCastle()
    ? 'kingside'
    : move.isQueensideCastle()
      ? 'queenside'
      : null;
  return {
    color: move.color,
    piece: move.piece,
    from: move.from,
    to: move.to,
    ...(move.promotion ? { promotion: move.promotion as PromotionPiece } : {}),
    ...(move.captured ? { captured: move.captured } : {}),
    san: move.san,
    uci: move.lan,
    // chess.js isCapture() is false for en passant, so look at the captured piece instead.
    isCapture: move.captured !== undefined,
    isEnPassant: move.isEnPassant(),
    castle,
    isCheck: move.san.endsWith('+') || move.san.endsWith('#'),
    isCheckmate: move.san.endsWith('#'),
  };
}

/**
 * A game: a starting position plus the moves played from it. Mutable; `clone()` copies.
 *
 * Results that end the game by themselves (checkmate, stalemate, dead position,
 * fivefold repetition, 75-move rule) come from `automaticResult()`. Draws that need a
 * claim (threefold repetition, 50-move rule) come from `drawClaimReason()`.
 */
export class Game {
  readonly startFen: string;
  readonly #chess: Chess;
  readonly #moves: Move[] = [];
  /** Position key after each ply; index 0 is the starting position. */
  readonly #keys: string[] = [];
  readonly #counts = new Map<string, number>();

  constructor(startFen: string = STARTING_FEN) {
    const check = checkFen(startFen);
    if (!check.ok) throw new InvalidFenError(check.error);
    this.#chess = new Chess(startFen);
    this.startFen = this.#chess.fen();
    this.#pushKey();
  }

  /** Replay UCI moves from a start position. Throws IllegalMoveError at the first bad move. */
  static fromUci(moves: readonly string[], startFen: string = STARTING_FEN): Game {
    const game = new Game(startFen);
    for (const move of moves) game.play(move);
    return game;
  }

  clone(): Game {
    return Game.fromUci(
      this.#moves.map((move) => move.uci),
      this.startFen,
    );
  }

  get moves(): readonly Move[] {
    return this.#moves;
  }

  get ply(): number {
    return this.#moves.length;
  }

  get lastMove(): Move | null {
    return this.#moves.at(-1) ?? null;
  }

  fen(): string {
    return this.#chess.fen();
  }

  turn(): Color {
    return this.#chess.turn();
  }

  pieceAt(square: Square): Piece | null {
    const piece = this.#chess.get(square);
    return piece ? { color: piece.color, type: piece.type } : null;
  }

  /** Every piece on the board, in `SQUARES` order (a8 … h1). */
  pieces(): PlacedPiece[] {
    const pieces: PlacedPiece[] = [];
    for (const square of SQUARES) {
      const piece = this.#chess.get(square);
      if (piece) pieces.push({ square, color: piece.color, type: piece.type });
    }
    return pieces;
  }

  inCheck(): boolean {
    return this.#chess.inCheck();
  }

  /** Legal moves for the side to move, optionally only those starting on `from`. */
  legalMoves(from?: Square): Move[] {
    const moves = from
      ? this.#chess.moves({ verbose: true, square: from })
      : this.#chess.moves({ verbose: true });
    return moves.map(toMove);
  }

  /** The legal move matching `input` exactly (including the promotion piece), or null. */
  findLegal(input: MoveInput | string): Move | null {
    const parsed = typeof input === 'string' ? parseUci(input) : input;
    if (!parsed) return null;
    const uci = toUci(parsed);
    return this.legalMoves(parsed.from).find((move) => move.uci === uci) ?? null;
  }

  isLegal(input: MoveInput | string): boolean {
    return this.findLegal(input) !== null;
  }

  /** Play a move given as UCI text or `{ from, to, promotion }`. A promotion must name its piece. */
  play(input: MoveInput | string): Move {
    const legal = this.findLegal(input);
    if (!legal) throw new IllegalMoveError(typeof input === 'string' ? input : toUci(input));
    return this.#apply(legal);
  }

  /** Play a move given in SAN, e.g. `Nf3`. Mainly for tests and imported records. */
  playSan(san: string): Move {
    const legal = this.legalMoves().find(
      (move) => move.san === san || stripSuffix(move.san) === stripSuffix(san),
    );
    if (!legal) throw new IllegalMoveError(san);
    return this.#apply(legal);
  }

  undo(): Move | null {
    const move = this.#moves.pop();
    if (!move) return null;
    this.#chess.undo();
    const key = this.#keys.pop();
    if (key !== undefined) {
      const count = (this.#counts.get(key) ?? 1) - 1;
      if (count === 0) this.#counts.delete(key);
      else this.#counts.set(key, count);
    }
    return move;
  }

  /**
   * Identity of the position for repetition (FIDE 9.2.2): piece placement, side to move,
   * castling rights and the en passant square only when an en passant capture is legal.
   */
  positionKey(): string {
    return this.#chess.fen().split(' ').slice(0, 4).join(' ');
  }

  /** How many times the current position has occurred in this game, including now. */
  repetitionCount(): number {
    return this.#counts.get(this.positionKey()) ?? 0;
  }

  /** Half-moves since the last capture or pawn move (includes the count in the start FEN). */
  halfmoveClock(): number {
    return Number(this.#chess.fen().split(' ')[4] ?? 0);
  }

  /** The automatic result of the current position, or null while the game goes on. */
  automaticResult(): GameResult | null {
    const ply = this.ply;
    if (this.#chess.isCheckmate())
      return { winner: opposite(this.turn()), reason: 'checkmate', ply };
    if (this.#chess.isStalemate()) return { winner: null, reason: 'stalemate', ply };
    if (isDeadByMaterial(this.pieces())) return { winner: null, reason: 'dead-position', ply };
    if (this.repetitionCount() >= 5) return { winner: null, reason: 'fivefold-repetition', ply };
    if (this.halfmoveClock() >= 150) return { winner: null, reason: 'seventy-five-move-rule', ply };
    return null;
  }

  /**
   * Why a draw could be claimed in the current position, or null. Who may claim is
   * up to the caller: the player to move (9.2.1.2, 9.3.2), or the player who just made
   * the move together with the claim (9.2.1.1, 9.3.1).
   */
  drawClaimReason(): DrawClaimReason | null {
    if (this.repetitionCount() >= 3) return 'threefold-repetition';
    if (this.halfmoveClock() >= 100) return 'fifty-move-rule';
    return null;
  }

  /** The claim the side to move could make together with `input` (9.2.1.1, 9.3.1), or null. */
  drawClaimReasonAfter(input: MoveInput | string): DrawClaimReason | null {
    const legal = this.findLegal(input);
    if (!legal) return null;
    this.#apply(legal);
    const reason = this.automaticResult() ? null : this.drawClaimReason();
    this.undo();
    return reason;
  }

  /**
   * Result when `flagged` runs out of time (6.9): the opponent wins, unless the opponent
   * cannot checkmate by any series of legal moves, which is a draw.
   */
  timeoutResult(flagged: Color): GameResult {
    const opponent = opposite(flagged);
    return canCheckmate(this.pieces(), opponent)
      ? { winner: opponent, reason: 'timeout', ply: this.ply }
      : { winner: null, reason: 'timeout-vs-insufficient-material', ply: this.ply };
  }

  #apply(legal: Move): Move {
    const played = this.#chess.move({
      from: legal.from,
      to: legal.to,
      ...(legal.promotion ? { promotion: legal.promotion } : {}),
    });
    const move = toMove(played);
    this.#moves.push(move);
    this.#pushKey();
    return move;
  }

  #pushKey(): void {
    const key = this.positionKey();
    this.#keys.push(key);
    this.#counts.set(key, (this.#counts.get(key) ?? 0) + 1);
  }
}

function stripSuffix(san: string): string {
  return san.replace(/[+#!?]+$/, '');
}
