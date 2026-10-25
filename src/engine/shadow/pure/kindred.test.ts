import { describe, expect, it } from 'vitest';
import { createStagePlane } from './stage-plane';
import { Kindred, SCARE_RADIUS_M, shadowSpot } from './kindred';

const HW = 0.4;
const HH = 0.3;

function run(k: Kindred, seconds: number, focus: [number, number] | null = null, onStep?: () => void): void {
  for (let i = 0; i < seconds * 60; i++) {
    k.update(1 / 60, HW, HH, focus?.[0] ?? 0, focus?.[1] ?? 0, focus !== null);
    onStep?.();
  }
}

describe('Kindred', () => {
  it('wanders and stays on the stage', () => {
    const k = new Kindred();
    let far = 0;
    run(k, 90, null, () => {
      far = Math.max(far, Math.abs(k.x) / HW, Math.abs(k.y) / HH);
    });
    expect(far).toBeLessThan(0.9);
    expect(far).toBeGreaterThan(0.2); // it does move about
  });

  it('keeps near the point it is told to circle', () => {
    const k = new Kindred();
    let sum = 0;
    let n = 0;
    run(k, 40, [0.25, 0.1]);
    run(k, 40, [0.25, 0.1], () => {
      sum += Math.sqrt((k.x - 0.25) ** 2 + (k.y - 0.1) ** 2);
      n++;
    });
    expect(sum / n).toBeLessThan(0.15);
  });

  it('lands on a spot, folds to a slow flap, and takes off again on release', () => {
    const k = new Kindred();
    k.perchAt(-0.2, -0.1);
    run(k, 6);
    expect(Math.abs(k.x + 0.2)).toBeLessThan(0.01);
    expect(Math.abs(k.y + 0.1)).toBeLessThan(0.01);
    const before = k.flap;
    run(k, 0.5);
    expect((k.flap - before + 1) % 1).toBeLessThan(0.35); // a slow flap while it sits
    k.release();
    run(k, 5);
    expect(Math.abs(k.x + 0.2) + Math.abs(k.y + 0.1)).toBeGreaterThan(0.02);
  });

  it('is pushed away by a scare', () => {
    const k = new Kindred();
    k.perchAt(0, 0);
    run(k, 4);
    k.scare(-0.1, 0);
    run(k, 0.4);
    expect(k.x).toBeGreaterThan(0.02);
    expect(k.isPerched).toBe(false);
  });

  it('flies the same way for the same steps', () => {
    const a = new Kindred(3);
    const b = new Kindred(3);
    run(a, 10);
    run(b, 10);
    expect([a.x, a.y, a.flap]).toEqual([b.x, b.y, b.flap]);
  });

  it('cycles through the three wing drawings and faces the way it flies', () => {
    const k = new Kindred();
    const seen = new Set<number>();
    run(k, 3, null, () => seen.add(k.frame));
    expect(seen.size).toBe(3);
    expect([1, -1]).toContain(k.facing);
  });

  it('survives a zero, negative or huge step', () => {
    const k = new Kindred();
    k.update(0, HW, HH, 0, 0, false);
    k.update(-1, HW, HH, 0, 0, false);
    k.update(1e6, HW, HH, 0, 0, false);
    expect(Number.isFinite(k.x + k.y + k.vx + k.vy + k.flap)).toBe(true);
    expect(Math.abs(k.x)).toBeLessThanOrEqual(HW);
  });
});

describe('shadowSpot', () => {
  const stage = createStagePlane(); // at the origin, facing +z
  const out = new Float64Array(2);

  it('casts a hand point onto the wall, bigger the nearer the light', () => {
    // light 1 m out, hand halfway: the shadow is twice as far from the middle
    expect(shadowSpot(stage, 0, 0, 1, 0.1, 0.05, 0.5, out)).toBe(true);
    expect(out[0]).toBeCloseTo(0.2);
    expect(out[1]).toBeCloseTo(0.1);
  });

  it('gives no shadow for a point behind the light or the wall', () => {
    expect(shadowSpot(stage, 0, 0, 1, 0, 0, 1.5, out)).toBe(false);
    expect(shadowSpot(stage, 0, 0, 1, 0, 0, -0.5, out)).toBe(false);
    expect(SCARE_RADIUS_M).toBeGreaterThan(0);
  });
});
