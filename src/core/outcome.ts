import type { Color } from './types.ts';

/** Draws that only happen when the player to move claims them (FIDE 9.2, 9.3). */
export type DrawClaimReason = 'threefold-repetition' | 'fifty-move-rule';

export type ResultReason =
  // Decisive
  | 'checkmate' // 5.1.1
  | 'resignation' // 5.1.2
  | 'timeout' // 6.9
  | 'illegal-move' // a stored move that is not legal (online data the rules could not block)
  // Automatic draws
  | 'stalemate' // 5.2.1
  | 'dead-position' // 5.2.2
  | 'fivefold-repetition' // 9.6.1
  | 'seventy-five-move-rule' // 9.6.2
  | 'timeout-vs-insufficient-material' // 6.9 exception
  // Draws by agreement or claim
  | 'agreement' // 5.2.3, 9.1
  | DrawClaimReason
  // Records read from PGN
  | 'imported'
  | 'unfinished';

export interface GameResult {
  /** null for a draw. */
  readonly winner: Color | null;
  readonly reason: ResultReason;
  /** Number of moves on the board when the game ended. */
  readonly ply: number;
}
