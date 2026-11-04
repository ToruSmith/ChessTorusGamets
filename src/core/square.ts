import { FILES, RANKS, type Square } from './types.ts';

/** All squares from a8 to h1, row by row: the order a board is drawn from White's side. */
export const SQUARES: readonly Square[] = [...RANKS]
  .reverse()
  .flatMap((rank) => FILES.map((file): Square => `${file}${rank}`));

export function isSquare(value: unknown): value is Square {
  return typeof value === 'string' && /^[a-h][1-8]$/.test(value);
}

/** 0 for the a-file … 7 for the h-file. */
export function fileIndex(square: Square): number {
  return square.charCodeAt(0) - 97;
}

/** 0 for the first rank … 7 for the eighth rank. */
export function rankIndex(square: Square): number {
  return square.charCodeAt(1) - 49;
}

export function squareAt(file: number, rank: number): Square | null {
  const f = FILES[file];
  const r = RANKS[rank];
  return f !== undefined && r !== undefined ? `${f}${r}` : null;
}

export function isLightSquare(square: Square): boolean {
  return (fileIndex(square) + rankIndex(square)) % 2 === 1;
}
