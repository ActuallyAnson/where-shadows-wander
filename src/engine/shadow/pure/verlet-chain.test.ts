import { describe, expect, it } from 'vitest';
import { VerletChain } from './verlet-chain';

/** A rope across 1.445 m with 1.4676 m of length: the bunting's strand (it sags about 11 cm). */
const make = () => new VerletChain(19, -1.73, 2.22, -0.28, 2.22, 1.4676);
const run = (c: VerletChain, seconds: number, wind = 0) => {
  for (let t = 0; t < seconds; t += 1 / 60) c.advance(1 / 60, 9.8, wind);
};

describe('VerletChain', () => {
  it('keeps both ends pinned whatever happens', () => {
    const c = make();
    c.impulse(-1, 2.2, 1, 5);
    run(c, 3, 8);
    expect(c.x[0]).toBe(Math.fround(-1.73));
    expect(c.y[0]).toBe(Math.fround(2.22));
    expect(c.x[18]).toBe(Math.fround(-0.28));
    expect(c.y[18]).toBe(Math.fround(2.22));
  });

  it('sags under gravity to roughly the depth its slack allows, and settles', () => {
    const c = make();
    run(c, 12);
    const mid = c.y[9];
    expect(2.22 - mid).toBeGreaterThan(0.06);
    expect(2.22 - mid).toBeLessThan(0.2);
    expect(c.motion).toBeLessThan(0.02);
  });

  it('holds its length: no link is more than a few percent out, even blown about', () => {
    const c = make();
    run(c, 6, 30);
    expect(c.stretch).toBeLessThan(0.05);
  });

  it('is blown sideways by wind, and swings when given an impulse, which then dies away', () => {
    const calm = make();
    const windy = make();
    run(calm, 6, 0);
    run(windy, 6, 40);
    expect(Math.abs(windy.x[9] - calm.x[9])).toBeGreaterThan(0.005);
    const c = make();
    run(c, 10);
    const rest = c.y[9];
    c.impulse(-1.0, rest, 0.8, 3);
    run(c, 0.3);
    expect(Math.abs(c.y[9] - rest) + Math.abs(c.x[9] - windy.x[9])).toBeGreaterThan(0);
    const movedAt = c.motion;
    run(c, 25);
    expect(c.motion).toBeLessThan(movedAt);
    expect(c.motion).toBeLessThan(0.05);
  });

  it('copes with a long frame, a negative or not-a-number time, and keeps every point finite', () => {
    const c = make();
    c.advance(5, 9.8, 3); // a huge frame is cut to a few small steps
    c.advance(-1, 9.8, 3);
    c.advance(NaN, 9.8, 3);
    for (let i = 0; i < c.n; i++) {
      expect(Number.isFinite(c.x[i])).toBe(true);
      expect(Number.isFinite(c.y[i])).toBe(true);
    }
    expect(() => new VerletChain(2, 0, 0, 1, 0, 1)).toThrow();
  });

  it('takes an impulse as a speed: a point next to the push moves a little in one step, not a metre', () => {
    const c = make();
    const y0 = c.y[9];
    const x0 = c.x[9];
    c.impulse(c.x[9], c.y[9] + 0.02, 0.6, 3); // 3 m/s, just above a point
    c.advance(1 / 120, 0, 0);
    expect(Math.hypot(c.x[9] - x0, c.y[9] - y0)).toBeLessThan(0.05);
    run(c, 0.5);
    expect(c.stretch).toBeLessThan(0.1); // and the links still hold
  });
});
