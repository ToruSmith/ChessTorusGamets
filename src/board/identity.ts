// Gives each piece a stable id across positions so the board can animate it sliding
// instead of re-creating it. Pure; no React.
import { fileIndex, rankIndex, type MoveInput, type PlacedPiece } from '../core/index.ts';

export interface TrackedPiece extends PlacedPiece {
  readonly id: string;
}

const distance = (a: PlacedPiece, b: PlacedPiece) =>
  Math.abs(fileIndex(a.square) - fileIndex(b.square)) +
  Math.abs(rankIndex(a.square) - rankIndex(b.square));

/**
 * Match `next` pieces to `previous` ones:
 * 1. same piece on the same square keeps its id;
 * 2. the piece on the last move's target takes the id of the piece that left its
 *    origin (covers promotion, where the type changes);
 * 3. remaining pieces of the same colour and type pair up by nearest distance
 *    (the rook in castling, any move after an undo or jump);
 * 4. anything left gets a new id.
 */
export function trackIdentity(
  previous: readonly TrackedPiece[],
  next: readonly PlacedPiece[],
  lastMove: Pick<MoveInput, 'from' | 'to'> | null,
  newId: () => string,
): TrackedPiece[] {
  const free = new Set(previous);
  const ids: (string | undefined)[] = next.map(() => undefined);
  const take = (index: number, piece: TrackedPiece) => {
    ids[index] = piece.id;
    free.delete(piece);
  };

  next.forEach((piece, index) => {
    const same = [...free].find(
      (p) => p.square === piece.square && p.color === piece.color && p.type === piece.type,
    );
    if (same) take(index, same);
  });

  if (lastMove) {
    const index = next.findIndex(
      (piece, i) => ids[i] === undefined && piece.square === lastMove.to,
    );
    const mover = [...free].find((p) => p.square === lastMove.from);
    if (index >= 0 && mover && mover.color === next[index]?.color) take(index, mover);
  }

  const pairs: { index: number; piece: TrackedPiece; d: number }[] = [];
  next.forEach((piece, index) => {
    if (ids[index] !== undefined) return;
    for (const candidate of free) {
      if (candidate.color === piece.color && candidate.type === piece.type) {
        pairs.push({ index, piece: candidate, d: distance(piece, candidate) });
      }
    }
  });
  pairs.sort((a, b) => a.d - b.d);
  for (const { index, piece } of pairs) {
    if (ids[index] === undefined && free.has(piece)) take(index, piece);
  }

  return next.map((piece, index) => ({ ...piece, id: ids[index] ?? newId() }));
}
