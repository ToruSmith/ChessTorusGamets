// Move generation counts from the standard perft suite (chessprogramming.org/Perft_Results),
// run through the project's own Game API.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Game } from '../../src/core/index.ts';

function perft(game: Game, depth: number): number {
  const moves = game.legalMoves();
  if (depth === 1) return moves.length;
  let nodes = 0;
  for (const move of moves) {
    game.play(move);
    nodes += perft(game, depth - 1);
    game.undo();
  }
  return nodes;
}

const CASES: { name: string; fen?: string; depth: number; nodes: number }[] = [
  { name: 'initial position', depth: 3, nodes: 8_902 },
  {
    name: 'Kiwipete (castling, en passant, promotions)',
    fen: 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1',
    depth: 2,
    nodes: 2_039,
  },
  {
    name: 'position 3 (en passant pins)',
    fen: '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1',
    depth: 4,
    nodes: 43_238,
  },
  {
    name: 'position 4 (promotions, castling through check)',
    fen: 'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1',
    depth: 3,
    nodes: 9_467,
  },
  {
    name: 'position 5',
    fen: 'rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8',
    depth: 2,
    nodes: 1_486,
  },
];

describe('perft', () => {
  for (const { name, fen, depth, nodes } of CASES) {
    it(`${name}, depth ${depth}`, () => {
      assert.equal(perft(new Game(fen), depth), nodes);
    });
  }
});
