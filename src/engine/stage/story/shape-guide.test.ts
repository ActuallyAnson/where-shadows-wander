import { describe, expect, it } from 'vitest';
import { closenessOf, GUIDE_REACH, LEAN_M, ShapeGuide } from './shape-guide';

const run = (
  g: ShapeGuide,
  s: number,
  ...a: Parameters<ShapeGuide['update']> extends [number, ...infer R] ? R : never
) => {
  for (let t = 0; t < s; t += 1 / 60) g.update(1 / 60, ...a);
};

describe('closenessOf', () => {
  it('is 1 at a match, 0 far off or with no hand, and in between on the way', () => {
    expect(closenessOf(0)).toBe(1);
    expect(closenessOf(2)).toBe(1);
    expect(closenessOf(-GUIDE_REACH / 2)).toBeCloseTo(0.5);
    expect(closenessOf(-GUIDE_REACH * 2)).toBe(0);
    expect(closenessOf(-Infinity)).toBe(0);
    expect(closenessOf(NaN)).toBe(0);
  });
});

describe('ShapeGuide', () => {
  it('eases closeness up as the hand nears the shape, and calms and brightens the candle with it', () => {
    const g = new ShapeGuide();
    run(g, 2, true, -GUIDE_REACH, 0, 0.1, 0, -0.3, 0.2);
    expect(g.closeness).toBeLessThan(0.01);
    run(g, 2, true, 0, 0, 0.1, 0, -0.3, 0.2);
    expect(g.closeness).toBeGreaterThan(0.99);
    expect(g.steady).toBeGreaterThan(0.8);
    expect(g.boost).toBeGreaterThan(0.09);
  });

  it('shows the ghost on the player’s shadow while she waits and a hand is seen, and lets it go after', () => {
    const g = new ShapeGuide();
    run(g, 1, true, -1, 0, 0.1, 0.05, -0.3, 0.2);
    expect(g.presence).toBe(1);
    expect(g.x).toBeCloseTo(0.1);
    expect(g.y).toBeCloseTo(0.05);
    run(g, 1, true, -1, 0, NaN, NaN, -0.3, 0.2);
    expect(g.presence).toBe(0);
    expect(g.x).toBeCloseTo(0.1); // it stays where it was as it goes
  });

  it('leans her hand toward the player’s while the shape is held, and back after', () => {
    const g = new ShapeGuide();
    run(g, 2, true, 0, 1, 0.3, 0.2, -0.3, 0.2);
    expect(g.leanX).toBeCloseTo(LEAN_M, 3);
    expect(Math.abs(g.leanY)).toBeLessThan(1e-6);
    run(g, 3, false, 0, 1, 0.3, 0.2, -0.3, 0.2);
    expect(Math.abs(g.leanX)).toBeLessThan(0.001);
    expect(g.closeness).toBeLessThan(0.01);
  });

  it('holds still at dt 0', () => {
    const g = new ShapeGuide();
    g.update(0, true, 0, 1, 0, 0, 1, 1);
    expect(g.presence).toBe(0);
  });
});
