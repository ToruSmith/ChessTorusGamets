import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createClock, deadline, isFlagged, pressClock, remainingAt } from '../../src/core/index.ts';

const BLITZ = { initialMs: 180_000, incrementMs: 2_000 };

describe('clock', () => {
  it('starts both clocks at the initial time', () => {
    const clock = createClock(BLITZ, 1_000, 'w');
    assert.deepEqual(clock.remaining, { w: 180_000, b: 180_000 });
    assert.equal(deadline(clock), 181_000);
  });

  it('subtracts the time used, adds the increment and switches sides', () => {
    let clock = createClock(BLITZ, 0, 'w');
    clock = pressClock(clock, BLITZ, 10_000);
    assert.deepEqual(clock.remaining, { w: 172_000, b: 180_000 });
    assert.equal(clock.turn, 'b');
    assert.equal(clock.turnStartedAt, 10_000);
    clock = pressClock(clock, BLITZ, 15_000);
    assert.deepEqual(clock.remaining, { w: 172_000, b: 177_000 });
  });

  it('shows the running clock counting down, never below zero', () => {
    const clock = createClock(BLITZ, 0, 'w');
    assert.deepEqual(remainingAt(clock, 30_000), { w: 150_000, b: 180_000 });
    assert.deepEqual(remainingAt(clock, 999_999), { w: 0, b: 180_000 });
  });

  it('flags exactly when the time is used up', () => {
    const clock = createClock(BLITZ, 0, 'w');
    assert.equal(isFlagged(clock, 179_999), false);
    assert.equal(isFlagged(clock, 180_000), true);
  });
});
