// Chess clock computed from move timestamps. Pure functions; times are milliseconds.
import { opposite, type Color } from './types.ts';

export interface TimeControl {
  /** Starting time for each player. */
  readonly initialMs: number;
  /** Added to the mover's clock after each move (Fischer increment). */
  readonly incrementMs: number;
}

export interface ClockState {
  /** Time left for each player at the moment `turnStartedAt`. */
  readonly remaining: Readonly<Record<Color, number>>;
  /** Whose clock is running. */
  readonly turn: Color;
  readonly turnStartedAt: number;
}

export function createClock(control: TimeControl, startedAt: number, turn: Color): ClockState {
  return {
    remaining: { w: control.initialMs, b: control.initialMs },
    turn,
    turnStartedAt: startedAt,
  };
}

/** The moment the running clock reaches zero. */
export function deadline(clock: ClockState): number {
  return clock.turnStartedAt + clock.remaining[clock.turn];
}

/** A player whose clock shows zero has run out of time: anything at or after the deadline is too late. */
export function isFlagged(clock: ClockState, now: number): boolean {
  return now >= deadline(clock);
}

/** Stop the mover's clock at `t` (which must be before the deadline), add the increment, start the other clock. */
export function pressClock(clock: ClockState, control: TimeControl, t: number): ClockState {
  const elapsed = Math.max(0, t - clock.turnStartedAt);
  const mover = clock.turn;
  return {
    remaining: {
      ...clock.remaining,
      [mover]: clock.remaining[mover] - elapsed + control.incrementMs,
    },
    turn: opposite(mover),
    turnStartedAt: Math.max(t, clock.turnStartedAt),
  };
}

/** Time left on both clocks at `now`, never below zero. */
export function remainingAt(clock: ClockState, now: number): Record<Color, number> {
  const running = Math.max(0, clock.remaining[clock.turn] - Math.max(0, now - clock.turnStartedAt));
  return { ...clock.remaining, [clock.turn]: running } as Record<Color, number>;
}
