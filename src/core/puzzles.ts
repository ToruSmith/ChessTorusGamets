// Checkmate puzzles. Each one is proven by tests/core/puzzles.test.ts: a forced mate in
// exactly `mateIn` moves. Moves are judged by search, so every correct answer counts.
import type { Game } from './game.ts';
import type { Move, MoveInput } from './types.ts';

export interface Puzzle {
  readonly id: string;
  readonly fen: string;
  readonly mateIn: 1 | 2;
}

export const PUZZLES: readonly Puzzle[] = [
  { id: 'back-rank', fen: '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1', mateIn: 1 },
  { id: 'open-file', fen: 'r5k1/5ppp/8/8/8/8/Q4PPP/4R1K1 w - - 0 1', mateIn: 1 },
  { id: 'smothered', fen: '6rk/6pp/8/6N1/8/8/8/7K w - - 0 1', mateIn: 1 },
  {
    id: 'scholar',
    fen: 'r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 0 1',
    mateIn: 1,
  },
  {
    id: 'fool',
    fen: 'rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 1',
    mateIn: 1,
  },
  { id: 'ladder', fen: 'k7/7R/6R1/8/8/8/8/6K1 w - - 0 1', mateIn: 1 },
  { id: 'queen-king', fen: '7k/8/5K2/8/8/8/8/6Q1 w - - 0 1', mateIn: 1 },
  { id: 'arabian', fen: '7k/1R6/5N2/8/8/8/8/6K1 w - - 0 1', mateIn: 1 },
  { id: 'epaulette', fen: '3rkr2/8/7Q/8/8/8/8/4K3 w - - 0 1', mateIn: 1 },
  { id: 'bishop-support', fen: '6k1/8/8/8/8/5b1q/5P1P/6K1 b - - 0 1', mateIn: 1 },
  { id: 'edge', fen: 'k7/8/1K6/8/8/8/8/7R w - - 0 1', mateIn: 1 },
  { id: 'promotion', fen: '7k/5P2/6K1/8/8/8/8/8 w - - 0 1', mateIn: 1 },
  { id: 'philidor', fen: '5r1k/6pp/7N/8/8/1Q6/8/6K1 w - - 0 1', mateIn: 2 },
  { id: 'philidor-black', fen: '6k1/8/1q6/8/8/7n/6PP/5R1K b - - 0 1', mateIn: 2 },
  { id: 'rook-ladder', fen: '7k/8/8/8/8/8/R7/1R4K1 w - - 0 1', mateIn: 2 },
  { id: 'king-rook', fen: 'k7/8/2K5/8/8/8/8/7R w - - 0 1', mateIn: 2 },
  { id: 'king-queen', fen: '7k/8/5K2/8/8/8/8/Q7 w - - 0 1', mateIn: 2 },
  { id: 'dark-squares', fen: '5rk1/5p1p/5Bp1/8/8/8/3Q1PPP/6K1 w - - 0 1', mateIn: 2 },
  {
    id: 'queen-sacrifice',
    fen: 'r1b2k1r/ppppq3/5N1p/4P2Q/4PP2/1B6/PP5P/n2K2R1 w - - 0 1',
    mateIn: 2,
  },
];

const isCheckmate = (game: Game): boolean => game.automaticResult()?.reason === 'checkmate';

/** The side to move has just been left with no way out of mate within `moves` moves. */
function defenceFails(game: Game, moves: number): boolean {
  const replies = game.legalMoves();
  if (replies.length === 0) return false;
  return replies.every((reply) => {
    game.play(reply);
    const mated = canMate(game, moves);
    game.undo();
    return mated;
  });
}

/** Whether the side to move can force checkmate within `moves` of its own moves. */
export function canMate(game: Game, moves: number): boolean {
  if (moves < 1) return false;
  return game.legalMoves().some((move) => solves(game, move, moves));
}

/** Whether `input` keeps a forced mate within `moves` moves (this one included). */
export function solves(game: Game, input: MoveInput, moves: number): boolean {
  if (!game.isLegal(input)) return false;
  game.play(input);
  const good = isCheckmate(game) || (moves > 1 && defenceFails(game, moves - 1));
  game.undo();
  return good;
}

/** The defender's reply on the board after a correct move. */
export function pickDefence(game: Game): Move | null {
  return game.legalMoves()[0] ?? null;
}
