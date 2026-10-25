import { describe, expect, it } from 'vitest';
import { Follower, nearMissLevel, NEAR_RANGE, SolveBloom, SOLVE_TOTAL_S } from './glow';

describe('SolveBloom', () => {
  it('is dark until triggered, swells, holds, drains and ends', () => {
    const b = new SolveBloom();
    expect(b.value).toBe(0);
    b.trigger();
    expect(b.active).toBe(true);
    b.update(0.0625);
    b.update(0.0625);
    expect(b.value).toBeCloseTo(0.5);
    b.update(0.1);
    b.update(0.1);
    b.update(0.1);
    expect(b.value).toBe(1);
    for (let i = 0; i < 20; i++) b.update(0.1);
    expect(b.active).toBe(false);
    expect(b.value).toBe(0);
    expect(SOLVE_TOTAL_S).toBeGreaterThan(1.8);
    expect(SOLVE_TOTAL_S).toBeLessThan(2.4);
  });

  it('ignores bad steps and can be triggered again', () => {
    const b = new SolveBloom();
    b.update(-1);
    b.update(NaN);
    expect(b.active).toBe(false);
    b.trigger();
    b.update(1);
    b.trigger();
    expect(b.time).toBe(0);
  });
});

describe('nearMissLevel', () => {
  it('is 1 inside the shape, rises toward its edge and is 0 far off', () => {
    expect(nearMissLevel(0.3)).toBe(1);
    expect(nearMissLevel(0)).toBe(1);
    expect(nearMissLevel(-NEAR_RANGE / 2)).toBeCloseTo(0.5);
    expect(nearMissLevel(-NEAR_RANGE)).toBe(0);
    expect(nearMissLevel(-5)).toBe(0);
    expect(nearMissLevel(-Infinity)).toBe(0);
    expect(nearMissLevel(NaN)).toBe(0);
  });
});

describe('Follower', () => {
  it('rises faster than it falls', () => {
    const up = new Follower();
    up.update(1, 0.12);
    const down = new Follower();
    down.value = 1;
    down.update(0, 0.12);
    expect(up.value).toBeGreaterThan(1 - down.value);
  });
});
