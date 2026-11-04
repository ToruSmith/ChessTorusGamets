import { fileIndex, rankIndex, squareAt, type Color, type Square } from '../core/index.ts';

/** Board drawn in a 800×800 viewBox: 100 units per square. */
export const SQUARE_SIZE = 100;
export const BOARD_SIZE = SQUARE_SIZE * 8;

/** Column and row (0–7, top-left origin) of a square as seen from `orientation`. */
export function toCell(square: Square, orientation: Color): { col: number; row: number } {
  const file = fileIndex(square);
  const rank = rankIndex(square);
  return orientation === 'w' ? { col: file, row: 7 - rank } : { col: 7 - file, row: rank };
}

export function fromCell(col: number, row: number, orientation: Color): Square | null {
  if (col < 0 || col > 7 || row < 0 || row > 7) return null;
  return orientation === 'w' ? squareAt(col, 7 - row) : squareAt(7 - col, row);
}

/** The square under a point in board units, or null when outside the board. */
export function squareFromPoint(x: number, y: number, orientation: Color): Square | null {
  return fromCell(Math.floor(x / SQUARE_SIZE), Math.floor(y / SQUARE_SIZE), orientation);
}
