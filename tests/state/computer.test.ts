import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';
import { UciEngine } from '../../src/ai/index.ts';
import {
  AnalysisSession,
  ComputerMatch,
  LocalMatch,
  parseAnalysisRequest,
} from '../../src/state/index.ts';
import { nodeStockfish } from '../helpers/node-engine.ts';

const engine = new UciEngine(nodeStockfish());
after(() => engine.dispose());

/** Wait until the computer has replied. */
async function settle(match: ComputerMatch) {
  for (let i = 0; i < 200; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 10));
    if (!match.snapshot.thinking) return;
  }
  throw new Error('computer did not move');
}

const fast = { minDelayMs: 0 };

describe('ComputerMatch', () => {
  it('replies to the human move with a legal move', async () => {
    const match = ComputerMatch.create(engine, { humanColor: 'w', level: 1 }, fast);
    assert.equal(match.play({ from: 'e2', to: 'e4' }), true);
    assert.equal(match.snapshot.thinking, true);
    assert.deepEqual(match.snapshot.legalMoves, [], 'no moves while the computer thinks');
    await settle(match);
    assert.equal(match.snapshot.history.length, 2);
    assert.equal(match.snapshot.turn, 'w');
    assert.ok(match.snapshot.legalMoves.length > 0);
  });

  it('moves first when the human plays Black', async () => {
    const match = ComputerMatch.create(engine, { humanColor: 'b', level: 3 }, fast);
    match.start();
    await settle(match);
    assert.equal(match.snapshot.history.length, 1);
    assert.equal(match.play({ from: 'e2', to: 'e4' }), false, 'not your piece');
  });

  it('undo takes back the computer reply and your move', async () => {
    const match = ComputerMatch.create(engine, { humanColor: 'w', level: 1 }, fast);
    match.play({ from: 'd2', to: 'd4' });
    await settle(match);
    assert.equal(match.undo(), true);
    assert.equal(match.snapshot.history.length, 0);
    assert.equal(match.snapshot.turn, 'w');
  });

  it('gives a legal hint on your turn, and none while the computer thinks', async () => {
    const match = ComputerMatch.create(engine, { humanColor: 'w', level: 1 }, fast);
    await match.hint();
    const hint = match.snapshot.hint;
    assert.ok(hint, 'a hint is shown');
    assert.ok(match.snapshot.legalMoves.some((m) => m.from === hint.from && m.to === hint.to));
    match.play({ from: 'e2', to: 'e4' });
    assert.equal(match.snapshot.hint, null);
    await settle(match);
  });

  it('the human resigns even while the computer thinks', async () => {
    const match = ComputerMatch.create(engine, { humanColor: 'w', level: 8 }, fast);
    match.play({ from: 'e2', to: 'e4' });
    match.resign();
    await settle(match);
    assert.deepEqual(match.snapshot.result, { winner: 'b', reason: 'resignation', ply: 1 });
    assert.equal(match.snapshot.history.length, 1);
  });

  it('saves and restores', async () => {
    const match = ComputerMatch.create(engine, { humanColor: 'w', level: 2 }, fast);
    match.play({ from: 'e2', to: 'e4' });
    await settle(match);
    const copy = ComputerMatch.fromJSON(engine, JSON.parse(JSON.stringify(match.toJSON())), fast);
    assert.ok(copy);
    assert.equal(copy.snapshot.fen, match.snapshot.fen);
    assert.equal(copy.snapshot.level, 2);
    assert.equal(ComputerMatch.fromJSON(engine, { version: 1 }), null);
  });
});

describe('analysis', () => {
  it('is only offered once a game is over', () => {
    const local = LocalMatch.create({ timeControl: null });
    local.play('f2f3');
    const during = local.snapshot.analysis;
    assert.equal(during, null, 'no analysis while the game is on');
    for (const move of ['e7e5', 'g2g4', 'd8h4']) local.play(move);
    const finished = local.snapshot;
    assert.deepEqual(finished.analysis?.moves, ['f2f3', 'e7e5', 'g2g4', 'd8h4']);
  });

  it('evaluates every position and finds the blunder', async () => {
    const local = LocalMatch.create({ timeControl: null });
    for (const move of ['f2f3', 'e7e5', 'g2g4', 'd8h4']) local.play(move);
    const request = parseAnalysisRequest(JSON.parse(JSON.stringify(local.snapshot.analysis)));
    assert.ok(request);
    const session = new AnalysisSession(engine, request);
    assert.equal(session.snapshot.positions.length, 5);
    assert.equal(session.snapshot.index, 4);
    await session.start(8);
    const { evals, judgements, done, summary } = session.snapshot;
    assert.equal(done, true);
    assert.equal(evals[4]?.win, 0, 'Black has mated');
    assert.equal(judgements[2], 'blunder', 'g4 allows mate in one');
    assert.equal(judgements[3], 'best', 'Qh4# is the best move');
    assert.ok(summary.w.blunder >= 1);
    session.goTo(-5);
    assert.equal(session.snapshot.index, 0);
  });

  it('rejects broken stored requests', () => {
    assert.equal(parseAnalysisRequest(null), null);
    assert.equal(
      parseAnalysisRequest({ startFen: 'x', moves: [], result: { reason: 'checkmate' } }),
      null,
    );
    assert.equal(
      parseAnalysisRequest({
        startFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        moves: ['e2e5'],
        result: { reason: 'checkmate' },
      }),
      null,
    );
  });
});
