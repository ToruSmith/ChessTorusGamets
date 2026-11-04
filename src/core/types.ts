// Project-owned chess types. Nothing outside src/core sees chess.js types.

export type Color = 'w' | 'b';
export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
export type PromotionPiece = 'q' | 'r' | 'b' | 'n';

export interface Piece {
  readonly color: Color;
  readonly type: PieceType;
}

export const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
export const RANKS = ['1', '2', '3', '4', '5', '6', '7', '8'] as const;
export type File = (typeof FILES)[number];
export type Rank = (typeof RANKS)[number];
export type Square = `${File}${Rank}`;

/** A move as requested by a player or read from storage. */
export interface MoveInput {
  readonly from: Square;
  readonly to: Square;
  readonly promotion?: PromotionPiece;
}

/** A legal move, with everything the UI and records need. */
export interface Move extends MoveInput {
  readonly color: Color;
  readonly piece: PieceType;
  readonly captured?: PieceType;
  /** Standard Algebraic Notation, e.g. `Nf3`, `exd6`, `O-O`, `e8=Q#`. */
  readonly san: string;
  /** UCI long algebraic notation, e.g. `g1f3`, `e7e8q`. Used for storage and engines. */
  readonly uci: string;
  readonly isCapture: boolean;
  readonly isEnPassant: boolean;
  readonly castle: 'kingside' | 'queenside' | null;
  readonly isCheck: boolean;
  readonly isCheckmate: boolean;
}

export const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export function opposite(color: Color): Color {
  return color === 'w' ? 'b' : 'w';
}
