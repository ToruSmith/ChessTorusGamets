import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';
import {
  LEVELS,
  UciEngine,
  judgeMove,
  levelById,
  parseBestMove,
  parseInfo,
  whiteCentipawns,
  whiteWinPercent,
} from '../../src/ai/index.ts';
import { Game } from '../../src/core/index.ts';
import { nodeStockfish } from '../helpers/node-engine.ts';

describe('UCI parsing', () => {
  it('reads depth, score and principal variation', () => {
    assert.deepEqual(
      parseInfo(
        'info depth 10 seldepth 14 multipv 1 score cp -35 nodes 9000 nps 1 time 9 pv e7e5 g1f3',
      ),
      { depth: 10, multipv: 1, score: { type: 'cp', value: -35 }, pv: ['e7e5', 'g1f3'] },
    );
    assert.deepEqual(parseInfo('info depth 3 score mate -2 lowerbound pv a1a8')?.score, {
      type: 'mate',
      value: -2,
    });
    assert.equal(parseInfo('info string NNUE evaluation enabled'), null);
    assert.equal(parseInfo('readyok'), null);
  });

  it('reads the best move, including "(none)"', () => {
    assert.deepEqual(parseBestMove('bestmove e7e8q ponder a1a2'), { move: 'e7e8q' });
    assert.deepEqual(parseBestMove('bestmove (none)'), { move: null });
    assert.equal(parseBestMove('info depth 1'), null);
  });
});

describe('scores and judgements', () => {
  it('turns side-to-move scores into White centipawns', () => {
    assert.equal(whiteCentipawns({ type: 'cp', value: 50 }, 'b'), -50);
    assert.equal(whiteCentipawns({ type: 'mate', value: 2 }, 'w'), 9_980);
    assert.equal(whiteCentipawns({ type: 'mate', value: 0 }, 'w'), -10_000);
  });

  it('maps centipawns to a win percentage', () => {
    assert.equal(whiteWinPercent(0), 50);
    assert.ok(whiteWinPercent(300) > 70);
    assert.ok(whiteWinPercent(-10_000) < 3);
  });

  it('judges by the drop in the mover’s win chance', () => {
    assert.equal(judgeMove('w', 60, 60, true), 'best');
    assert.equal(judgeMove('w', 60, 55, false), 'good');
    assert.equal(judgeMove('w', 60, 48, false), 'inaccuracy');
    assert.equal(judgeMove('w', 60, 38, false), 'mistake');
    assert.equal(judgeMove('w', 60, 20, false), 'blunder');
    assert.equal(judgeMove('b', 40, 75, false), 'blunder');
  });

  it('has eight increasing levels', () => {
    assert.equal(LEVELS.length, 8);
    assert.ok(LEVELS.every((level, i) => i === 0 || level.skill > (LEVELS[i - 1]?.skill ?? 0)));
    assert.equal(levelById(99).id, 4);
  });
});

describe('Stockfish.js (real engine)', () => {
  const engine = new UciEngine(nodeStockfish());
  after(() => engine.dispose());

  it('finds a mate in one', async () => {
    const result = await engine.search({ fen: '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1', depth: 8 });
    assert.equal(result.bestMove, 'a1a8');
    assert.deepEqual(result.score, { type: 'mate', value: 1 });
  });

  it('plays only legal moves at the weakest level, many times in a row', async () => {
    const game = new Game();
    const weakest = levelById(1);
    for (let i = 0; i < 20 && !game.automaticResult(); i += 1) {
      const result = await engine.search({
        fen: game.fen(),
        depth: weakest.depth,
        skill: weakest.skill,
      });
      assert.ok(
        result.bestMove && game.isLegal(result.bestMove),
        `${result.bestMove} in ${game.fen()}`,
      );
      game.play(result.bestMove);
    }
  });

  it('reports no move when mated', async () => {
    const game = Game.fromUci(['f2f3', 'e7e5', 'g2g4', 'd8h4']);
    const result = await engine.search({ fen: game.fen(), depth: 5 });
    assert.equal(result.bestMove, null);
  });

  it('runs queued searches one at a time', async () => {
    const fens = ['6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1', new Game().fen()];
    const results = await Promise.all(fens.map((fen) => engine.search({ fen, depth: 6 })));
    assert.equal(results[0]?.bestMove, 'a1a8');
    assert.ok(results[1]?.bestMove);
    await engine.newGame();
  });
});
