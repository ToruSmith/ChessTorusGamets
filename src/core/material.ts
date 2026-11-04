// Material tests for dead positions (FIDE 5.2.2) and the flag-fall exception (6.9).
import { isLightSquare } from './square.ts';
import type { Color, Piece, Square } from './types.ts';

export interface PlacedPiece extends Piece {
  readonly square: Square;
}

/**
 * True when neither side can checkmate by any series of legal moves, for the
 * material-only cases: K v K, K+minor v K, and any number of bishops (either side)
 * that all stand on squares of one colour. Other dead positions (e.g. fully locked
 * pawns) are not detected; the 75-move rule or fivefold repetition ends those games.
 */
export function isDeadByMaterial(pieces: readonly PlacedPiece[]): boolean {
  const others = pieces.filter((piece) => piece.type !== 'k');
  if (others.length === 0) return true;
  if (others.length === 1) return others[0]?.type === 'n' || others[0]?.type === 'b';
  if (others.every((piece) => piece.type === 'b')) {
    const light = others.map((piece) => isLightSquare(piece.square));
    return light.every((value) => value === light[0]);
  }
  return false;
}

/**
 * Whether `color` could still checkmate the opponent by some series of legal moves,
 * including helpmates. Conservative: answers false only when that is certain, so a
 * flag fall is ruled a draw (6.9) only when the opponent truly cannot win.
 */
export function canCheckmate(pieces: readonly PlacedPiece[], color: Color): boolean {
  const own = pieces.filter((piece) => piece.color === color && piece.type !== 'k');
  if (own.length === 0) return false;
  return !isDeadByMaterial(pieces);
}
