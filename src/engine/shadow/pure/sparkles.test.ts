import { describe, expect, it } from 'vitest';
import { createSparkleOut, Sparkles, SPARKLE_MAX } from './sparkles';

function run(s: Sparkles, seconds: number, rate: number, onStep?: () => void): void {
  for (let i = 0; i < seconds * 60; i++) {
    s.update(1 / 60, 0.1, 0.05, rate);
    onStep?.();
  }
}

describe('Sparkles', () => {
  it('is born at about the rate asked for, and dies after its short life', () => {
    const s = new Sparkles(2);
    run(s, 1, 20);
    expect(s.alive).toBeGreaterThan(12);
    expect(s.alive).toBeLessThanOrEqual(21);
    run(s, 3, 0);
    expect(s.alive).toBe(0);
  });

  it('never holds more than its pool, however fast it is told to emit', () => {
    const s = new Sparkles();
    let most = 0;
    run(s, 3, 5000, () => (most = Math.max(most, s.alive)));
    expect(most).toBeLessThanOrEqual(SPARKLE_MAX);
  });

  it('fills the output: empty slots are nothing, live ones are within bounds', () => {
    const s = new Sparkles(3);
    const out = createSparkleOut();
    expect(s.fill(out)).toBe(0);
    expect(Math.max(...out.alpha)).toBe(0);
    run(s, 1, 30);
    const n = s.fill(out);
    expect(n).toBeGreaterThan(0);
    for (let i = 0; i < SPARKLE_MAX; i++) {
      expect(out.alpha[i]).toBeGreaterThanOrEqual(0);
      expect(out.alpha[i]).toBeLessThanOrEqual(1);
      expect(out.size[i]).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(out.x[i] + out.y[i])).toBe(true);
    }
  });

  it('starts near the point it is born at and sinks slowly', () => {
    const s = new Sparkles(4);
    const out = createSparkleOut();
    run(s, 0.1, 40);
    s.fill(out);
    for (let i = 0; i < SPARKLE_MAX; i++)
      if (out.alpha[i] > 0) {
        expect(Math.abs(out.x[i] - 0.1)).toBeLessThan(0.05);
        expect(Math.abs(out.y[i] - 0.05)).toBeLessThan(0.05);
      }
  });

  it('is the same every time for the same seed', () => {
    const a = new Sparkles(9);
    const b = new Sparkles(9);
    const oa = createSparkleOut();
    const ob = createSparkleOut();
    run(a, 2, 25);
    run(b, 2, 25);
    a.fill(oa);
    b.fill(ob);
    expect(Array.from(oa.x)).toEqual(Array.from(ob.x));
    expect(Array.from(oa.alpha)).toEqual(Array.from(ob.alpha));
  });

  it('survives zero, negative and huge steps, and clears', () => {
    const s = new Sparkles();
    s.update(0, 0, 0, 10);
    s.update(-1, 0, 0, 10);
    s.update(1e6, 0, 0, 10);
    const out = createSparkleOut();
    s.fill(out);
    expect(out.x.every(Number.isFinite)).toBe(true);
    s.clear();
    expect(s.alive).toBe(0);
  });
});
