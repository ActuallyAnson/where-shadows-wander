import { describe, expect, it } from 'vitest';
import {
  CLAP_S,
  CYCLE_S,
  DOWN_S,
  GATHER_S,
  FAINT,
  HIGH_M,
  HINT_DELAY_S,
  LOW_M,
  SleepHint,
  STRONG,
  STRONG_BY_S,
  WORD_AT_S,
  WORD_EVERY_S,
} from './sleep-hint';

const DT = 1 / 60;
const run = (h: SleepHint, seconds: number, near = 0, covering = 0): number => {
  let words = 0;
  for (let t = 0; t < seconds - 1e-9; t += DT) {
    h.update(DT, true, near, covering);
    if (h.sayWord) words++;
  }
  return words;
};
/** The strongest the ghost gets over one whole cycle. */
const peak = (h: SleepHint, near = 0): number => {
  let most = 0;
  for (let t = 0; t < CYCLE_S; t += DT) {
    h.update(DT, true, near, 0);
    most = Math.max(most, h.ghost);
  }
  return most;
};

describe('SleepHint', () => {
  it('shows nothing until the wait has gone on a moment', () => {
    const h = new SleepHint();
    run(h, HINT_DELAY_S - 0.1);
    expect(h.ghost).toBe(0);
    expect(h.lift).toBe(HIGH_M);
  });

  it('brings the ghost down over the flame and lifts it again', () => {
    const h = new SleepHint();
    run(h, HINT_DELAY_S + DOWN_S + 0.1);
    expect(h.lift).toBeCloseTo(LOW_M);
    expect(h.ghost).toBeCloseTo(FAINT);
    run(h, CYCLE_S - DOWN_S - 0.2);
    expect(h.ghost).toBe(0); // resting between covers
  });

  it('claps down quick, the way she hushed the torch: the descent is far faster than the lift', () => {
    const h = new SleepHint();
    run(h, HINT_DELAY_S + GATHER_S);
    const poised = h.lift;
    run(h, CLAP_S);
    expect(h.lift).toBeCloseTo(LOW_M, 2);
    expect(poised - h.lift).toBeGreaterThan(0.05);
    expect(CLAP_S).toBeLessThan(0.4);
  });

  it('dips the room’s light while it has the flame covered, and not while it gathers or rests', () => {
    const h = new SleepHint();
    run(h, HINT_DELAY_S + GATHER_S * 0.5);
    expect(h.dip).toBe(0);
    run(h, GATHER_S * 0.5 + CLAP_S + 0.3);
    expect(h.dip).toBe(1);
    run(h, CYCLE_S - DOWN_S - 0.5);
    expect(h.dip).toBe(0);
  });

  it('grows stronger if the wait goes on', () => {
    const h = new SleepHint();
    expect(peak(h)).toBeCloseTo(FAINT, 2);
    run(h, STRONG_BY_S);
    expect(peak(h)).toBeCloseTo(STRONG, 2);
  });

  it('gives way while the player’s hand is at the flame, and comes back after', () => {
    const h = new SleepHint();
    run(h, HINT_DELAY_S);
    expect(peak(h, 0.8)).toBeLessThan(0.15);
    run(h, 3);
    expect(peak(h)).toBeGreaterThan(FAINT * 0.9);
  });

  it('writes the word once the wait is long, and again now and then', () => {
    const h = new SleepHint();
    expect(run(h, WORD_AT_S - 0.1)).toBe(0);
    expect(run(h, 0.2)).toBe(1);
    expect(run(h, WORD_EVERY_S)).toBe(1);
  });

  it('starts over when the wait ends', () => {
    const h = new SleepHint();
    run(h, WORD_AT_S + 1);
    h.update(DT, false, 0, 0);
    expect(h.ghost).toBe(0);
    expect(h.waited).toBe(0);
    expect(run(h, WORD_AT_S - 0.1)).toBe(0);
  });
});
