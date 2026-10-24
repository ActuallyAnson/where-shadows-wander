import { describe, expect, it } from 'vitest';
import { createTrailVerts, Trail, TRAIL_SAMPLES, TRAIL_STEP_S, TRAIL_VERTS } from './trail';

const STEP = TRAIL_STEP_S;

/** Moves along +x at 1 m/s for n steps, so the head's x is the time. */
function fly(t: Trail, steps: number, x0 = 0): number {
  let x = x0;
  for (let i = 0; i < steps; i++) {
    x += STEP;
    t.update(STEP, x, 0);
  }
  return x;
}

describe('Trail', () => {
  it('draws nothing until a point is recorded', () => {
    expect(new Trail().build(0, 0, 0.1, createTrailVerts())).toBe(0);
  });

  it('grows by one point a step up to its limit and never past it', () => {
    const t = new Trail();
    const out = createTrailVerts();
    fly(t, 3);
    expect(t.build(0.15, 0, 0.1, out)).toBe(8);
    fly(t, TRAIL_SAMPLES * 3);
    expect(t.build(0, 0, 0.1, out)).toBe(TRAIL_VERTS);
  });

  it('goes back along the path from the head, in order, after the buffer has wrapped', () => {
    const t = new Trail();
    const out = createTrailVerts();
    const x = fly(t, TRAIL_SAMPLES + 7);
    t.build(x + STEP / 2, 0, 0.1, out); // the head is a little ahead of the newest recorded point
    for (let i = 1; i < TRAIL_SAMPLES; i++) {
      const centre = (out.x[i * 2] + out.x[i * 2 + 1]) / 2;
      const before = (out.x[(i - 1) * 2] + out.x[(i - 1) * 2 + 1]) / 2;
      expect(centre).toBeLessThan(before);
    }
  });

  it('is widest and most solid at the head and tapers to nothing at the tail', () => {
    const t = new Trail();
    const out = createTrailVerts();
    const x = fly(t, TRAIL_SAMPLES);
    const n = t.build(x, 0, 0.1, out);
    const width = (i: number) => Math.abs(out.y[i * 2] - out.y[i * 2 + 1]);
    expect(width(0)).toBeCloseTo(0.1, 5);
    expect(width(n / 2 - 1)).toBeCloseTo(0, 5);
    expect(out.a[0]).toBe(1);
    expect(out.a[n - 1]).toBeCloseTo(0, 5);
    for (let i = 1; i < n / 2; i++) expect(out.a[i * 2]).toBeLessThanOrEqual(out.a[(i - 1) * 2]);
  });

  it('stays finite when the thing stands still, and on odd steps', () => {
    const t = new Trail();
    const out = createTrailVerts();
    for (let i = 0; i < 80; i++) t.update(STEP, 0.2, 0.1);
    t.update(0, 0, 0);
    t.update(-1, 0, 0);
    t.update(1e6, 0.2, 0.1);
    const n = t.build(0.2, 0.1, 0.1, out);
    for (let i = 0; i < n; i++) expect(Number.isFinite(out.x[i] + out.y[i] + out.a[i])).toBe(true);
  });

  it('forgets the path on clear', () => {
    const t = new Trail();
    fly(t, 10);
    t.clear();
    expect(t.build(0, 0, 0.1, createTrailVerts())).toBe(0);
  });
});
