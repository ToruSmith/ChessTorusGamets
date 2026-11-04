// Turning engine scores into win chances and move judgements. Pure functions.
import type { Color } from '../core/index.ts';
import type { Score } from './uci.ts';

/** A score from White's point of view, in centipawns; mates are mapped to ±10000 minus distance. */
export function whiteCentipawns(score: Score, sideToMove: Color): number {
  const own =
    score.type === 'cp'
      ? score.value
      : Math.sign(score.value || -1) * (10_000 - Math.abs(score.value) * 10);
  return sideToMove === 'w' ? own : -own;
}

/**
 * White's chance of winning, 0–100, from a centipawn score. The logistic curve is the one
 * Lichess publishes for its accuracy model.
 */
export function whiteWinPercent(centipawns: number): number {
  const clamped = Math.max(-1000, Math.min(1000, centipawns));
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * clamped)) - 1);
}

export type MoveJudgement = 'best' | 'good' | 'inaccuracy' | 'mistake' | 'blunder';

/**
 * Judge a move by how much the mover's win chance dropped: 10 points is an inaccuracy,
 * 20 a mistake, 30 a blunder. Playing the engine's choice is "best".
 */
export function judgeMove(
  mover: Color,
  winBefore: number,
  winAfter: number,
  playedBest: boolean,
): MoveJudgement {
  if (playedBest) return 'best';
  const before = mover === 'w' ? winBefore : 100 - winBefore;
  const after = mover === 'w' ? winAfter : 100 - winAfter;
  const drop = before - after;
  if (drop >= 30) return 'blunder';
  if (drop >= 20) return 'mistake';
  if (drop >= 10) return 'inaccuracy';
  return 'good';
}
