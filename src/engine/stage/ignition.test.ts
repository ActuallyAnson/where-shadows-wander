import { describe, expect, it } from 'vitest';
import { DRAIN_GRACE_S, IgnitionHold, LIGHT_HOLD_S, LIGHT_REACH_M, NEAR_REACH_M } from './ignition';

const run = (h: IgnitionHold, seconds: number, distance: number, dt = 1 / 60): boolean => {
  let lit = false;
  for (let t = 0; t < seconds - 1e-9; t += dt) lit = h.update(dt, distance) || lit;
  return lit;
};

describe('IgnitionHold', () => {
  it('lights after the match is held at the wick for the hold time, once', () => {
    const h = new IgnitionHold();
    expect(run(h, LIGHT_HOLD_S - 0.1, 0.05)).toBe(false);
    expect(run(h, 0.2, 0.05)).toBe(true);
    expect(h.update(1 / 60, 0.05)).toBe(false);
  });

  it('says how near the match is from further out than it lights', () => {
    const h = new IgnitionHold();
    h.update(0, Infinity);
    expect(h.near).toBe(0);
    h.update(0, NEAR_REACH_M + 0.01);
    expect(h.near).toBe(0);
    h.update(0, (NEAR_REACH_M + LIGHT_REACH_M) / 2);
    expect(h.near).toBeCloseTo(0.5);
    h.update(0, LIGHT_REACH_M);
    expect(h.near).toBe(1);
    expect(h.progress).toBe(0); // near is not lighting
  });

  it('keeps its progress for a moment when the match drifts off, then loses it slowly', () => {
    const h = new IgnitionHold();
    run(h, 1.5, 0.05);
    const held = h.progress;
    run(h, DRAIN_GRACE_S - 0.05, 0.3);
    expect(h.progress).toBeCloseTo(held);
    run(h, 1, 0.3);
    expect(h.progress).toBeLessThan(held);
    // Slow: a second away costs well under half what a second held gains.
    expect(held - h.progress).toBeLessThan(0.5 / LIGHT_HOLD_S);
  });

  it('a shaky hand that keeps coming back still lights it', () => {
    const h = new IgnitionHold();
    let lit = false;
    for (let i = 0; i < 10 && !lit; i++) {
      lit = run(h, 0.5, 0.05);
      lit = run(h, 0.5, 0.25) || lit;
    }
    expect(lit).toBe(true);
  });
});
