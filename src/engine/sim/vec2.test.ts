import { describe, expect, it } from 'vitest';
import {
  circleVsCapsule,
  clamp,
  closestPointOnSegment,
  cross,
  distance,
  distanceSq,
  dot,
  length,
  lengthSq,
  lerp,
  normalize,
  type Vec2,
} from './vec2';

const out = (): Vec2 => ({ x: 99, y: 99 });

describe('scalar helpers', () => {
  it('dot, cross, lengths and distances', () => {
    expect(dot(1, 2, 3, 4)).toBe(11);
    expect(cross(1, 0, 0, 1)).toBe(1);
    expect(cross(0, 1, 1, 0)).toBe(-1);
    expect(lengthSq(3, 4)).toBe(25);
    expect(length(3, 4)).toBe(5);
    expect(distanceSq(1, 1, 4, 5)).toBe(25);
    expect(distance(1, 1, 4, 5)).toBe(5);
  });

  it('clamp and lerp', () => {
    expect(clamp(5, 0, 1)).toBe(1);
    expect(clamp(-5, 0, 1)).toBe(0);
    expect(clamp(0.3, 0, 1)).toBe(0.3);
    expect(lerp(2, 6, 0)).toBe(2);
    expect(lerp(2, 6, 1)).toBe(6);
    expect(lerp(2, 6, 0.25)).toBe(3);
  });
});

describe('normalize', () => {
  it('writes the unit vector and returns the length', () => {
    const o = out();
    expect(normalize(3, 4, o)).toBe(5);
    expect(o.x).toBeCloseTo(0.6, 12);
    expect(o.y).toBeCloseTo(0.8, 12);
  });

  it('gives (0, 0) and length 0 for a zero or tiny vector, never NaN', () => {
    for (const [x, y] of [
      [0, 0],
      [1e-9, -1e-9],
    ]) {
      const o = out();
      expect(normalize(x, y, o)).toBe(0);
      expect([o.x, o.y]).toEqual([0, 0]);
    }
  });
});

describe('closestPointOnSegment', () => {
  it('projects onto the interior', () => {
    const o = out();
    expect(closestPointOnSegment(2, 3, 0, 0, 4, 0, o)).toBe(0.5);
    expect([o.x, o.y]).toEqual([2, 0]);
  });

  it('clamps to either end', () => {
    const o = out();
    expect(closestPointOnSegment(-5, 1, 0, 0, 4, 0, o)).toBe(0);
    expect([o.x, o.y]).toEqual([0, 0]);
    expect(closestPointOnSegment(9, 1, 0, 0, 4, 0, o)).toBe(1);
    expect([o.x, o.y]).toEqual([4, 0]);
  });

  it('treats a zero-length segment as a point', () => {
    const o = out();
    expect(closestPointOnSegment(5, 5, 1, 2, 1, 2, o)).toBe(0);
    expect([o.x, o.y]).toEqual([1, 2]);
  });
});

describe('circleVsCapsule', () => {
  // A horizontal capsule from (0, 0) to (4, 0), radius 0.5.
  const hit = (cx: number, cy: number, r: number, n: Vec2) => circleVsCapsule(cx, cy, r, 0, 0, 4, 0, 0.5, n);

  it('returns 0 and leaves nothing to resolve when apart or just touching', () => {
    const n = out();
    expect(hit(2, 2, 0.5, n)).toBe(0);
    expect(hit(2, 1, 0.5, n)).toBe(0);
  });

  it('pushes a circle above the capsule upward by the overlap', () => {
    const n = out();
    expect(hit(2, 0.8, 0.5, n)).toBeCloseTo(0.2, 12);
    expect([n.x, n.y]).toEqual([0, 1]);
  });

  it('pushes a circle below the capsule downward', () => {
    const n = out();
    expect(hit(1, -0.8, 0.5, n)).toBeCloseTo(0.2, 12);
    expect([n.x, n.y]).toEqual([0, -1]);
  });

  it('uses the rounded end cap, pushing along the line from the end point', () => {
    const n = out();
    const depth = hit(4.6, 0.6, 0.5, n);
    const d = Math.sqrt(0.6 * 0.6 + 0.6 * 0.6);
    expect(depth).toBeCloseTo(1 - d, 12);
    expect(n.x).toBeCloseTo(0.6 / d, 12);
    expect(n.y).toBeCloseTo(0.6 / d, 12);
  });

  it('moving the circle depth along the normal separates it exactly', () => {
    const n = out();
    const depth = hit(3.7, 0.3, 0.4, n);
    const p = out();
    closestPointOnSegment(3.7 + n.x * depth, 0.3 + n.y * depth, 0, 0, 4, 0, p);
    expect(distance(3.7 + n.x * depth, 0.3 + n.y * depth, p.x, p.y)).toBeCloseTo(0.9, 12);
  });

  it('is defined and repeatable when the centre lies on the segment', () => {
    const a = out();
    const b = out();
    expect(hit(2, 0, 0.5, a)).toBe(1);
    expect(hit(2, 0, 0.5, b)).toBe(1);
    expect([a.x, a.y]).toEqual([0, 1]);
    expect(b).toEqual(a);
  });

  it('uses up for a point capsule with the centre exactly on it', () => {
    const n = out();
    expect(circleVsCapsule(1, 1, 0.5, 1, 1, 1, 1, 0.25, n)).toBe(0.75);
    expect([n.x, n.y]).toEqual([0, 1]);
  });
});
