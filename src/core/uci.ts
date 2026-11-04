import { isSquare } from './square.ts';
import type { MoveInput, PromotionPiece } from './types.ts';

const PROMOTIONS: readonly string[] = ['q', 'r', 'b', 'n'];

/** Parse UCI long algebraic notation (`e2e4`, `e7e8q`). Returns null when malformed. */
export function parseUci(text: string): MoveInput | null {
  const match = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/.exec(text);
  if (!match) return null;
  const [, from, to, promotion] = match;
  if (!isSquare(from) || !isSquare(to) || from === to) return null;
  if (promotion === undefined) return { from, to };
  return PROMOTIONS.includes(promotion)
    ? { from, to, promotion: promotion as PromotionPiece }
    : null;
}

export function toUci(move: MoveInput): string {
  return `${move.from}${move.to}${move.promotion ?? ''}`;
}
