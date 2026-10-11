import { describe, expect, it } from 'vitest';
import { Rng } from './rng';

describe('Rng', () => {
  it('repeats the same sequence for the same seed', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    for (let i = 0; i < 1000; i++) expect(a.next()).toBe(b.next());
  });

  it('gives different sequences for different seeds', () => {
    expect(new Rng(1).next()).not.toBe(new Rng(2).next());
  });

  it('stays in [0, 1) and is roughly uniform', () => {
    const rng = new Rng(7);
    const bins = new Int32Array(10);
    let min = 1;
    let max = 0;
    for (let i = 0; i < 100_000; i++) {
      const v = rng.next();
      min = Math.min(min, v);
      max = Math.max(max, v);
      bins[Math.floor(v * 10)]++;
    }
    expect(min).toBeGreaterThanOrEqual(0);
    expect(max).toBeLessThan(1);
    for (const n of bins) expect(Math.abs(n - 10_000)).toBeLessThan(500);
  });

  it('resumes exactly from a saved state', () => {
    const rng = new Rng(9);
    for (let i = 0; i < 17; i++) rng.next();
    const saved = rng.state;
    const expected = [rng.next(), rng.next(), rng.next()];
    rng.state = saved;
    expect([rng.next(), rng.next(), rng.next()]).toEqual(expected);
  });

  it('range and int stay in bounds', () => {
    const rng = new Rng(3);
    for (let i = 0; i < 1000; i++) {
      const r = rng.range(-2, 5);
      expect(r >= -2 && r < 5).toBe(true);
      const n = rng.int(6);
      expect(Number.isInteger(n) && n >= 0 && n < 6).toBe(true);
    }
  });
});
