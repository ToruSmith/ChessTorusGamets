// The immutable view of a match that the UI renders. Built from a replayed MatchState.
import type {
  ClockState,
  Color,
  DrawClaimReason,
  GameResult,
  MatchState,
  Move,
  PlacedPiece,
  Square,
  TimeControl,
} from '../core/index.ts';

export interface ClockView extends ClockState {
  /** False before the first move and after the game ends. */
  readonly running: boolean;
}

export interface MatchSnapshot {
  readonly fen: string;
  readonly turn: Color;
  readonly pieces: readonly PlacedPiece[];
  /** Legal moves for the side to move; empty once the game is over. */
  readonly legalMoves: readonly Move[];
  readonly history: readonly Move[];
  readonly lastMove: Move | null;
  /** The king in check, if any. */
  readonly checkSquare: Square | null;
  readonly result: GameResult | null;
  /** The side with a standing draw offer. */
  readonly drawOffer: Color | null;
  /** A draw the side to move may claim now (FIDE 9.2, 9.3). */
  readonly drawClaim: DrawClaimReason | null;
  readonly timeControl: TimeControl | null;
  readonly clock: ClockView | null;
  readonly canUndo: boolean;
}

export function buildSnapshot(
  state: MatchState,
  timeControl: TimeControl | null,
  options: { clockStarted: boolean; canUndo: boolean },
): MatchSnapshot {
  const { game, result } = state;
  const pieces = game.pieces();
  const turn = game.turn();
  const checkSquare = game.inCheck()
    ? (pieces.find((piece) => piece.type === 'k' && piece.color === turn)?.square ?? null)
    : null;
  return {
    fen: game.fen(),
    turn,
    pieces,
    legalMoves: result ? [] : game.legalMoves(),
    history: [...game.moves],
    lastMove: game.lastMove,
    checkSquare,
    result,
    drawOffer: state.drawOffer,
    drawClaim: result ? null : game.drawClaimReason(),
    timeControl,
    clock: state.clock ? { ...state.clock, running: options.clockStarted && !result } : null,
    canUndo: options.canUndo,
  };
}
