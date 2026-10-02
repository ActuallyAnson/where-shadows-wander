import { describe, expect, it } from 'vitest';
import { convexHull } from './hull';

function hull(points: number[][]) {
  const xy = new Float32Array(points.flat());
  const out = new Float32Array((points.length + 1) * 2);
  const n = convexHull(xy, points.length, out, new Uint8Array(points.length));
  return Array.from({ length: n }, (_, i) => [out[i * 2], out[i * 2 + 1]]);
}

function signedArea(poly: number[][]): number {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i],
      [x2, y2] = poly[(i + 1) % poly.length];
    a += x1 * y2 - x2 * y1;
  }
  return a / 2;
}

describe('convex hull', () => {
  it('keeps the corners of a square and drops points inside, counter-clockwise', () => {
    const h = hull([
      [0, 0],
      [1, 0],
      [0.5, 0.5],
      [1, 1],
      [0.2, 0.7],
      [0, 1],
    ]);
    expect(h).toHaveLength(4);
    expect(signedArea(h)).toBeCloseTo(1);
  });

  it('drops collinear and duplicate points', () => {
    const h = hull([
      [0, 0],
      [0.5, 0],
      [1, 0],
      [1, 0],
      [1, 1],
      [0, 1],
      [0, 0.5],
    ]);
    expect(h).toHaveLength(4);
  });

  it('handles a set whose points are all on the hull', () => {
    // The chain briefly holds one point more than the hull here: the buffer needs room for it.
    const h = hull([
      [0.2, 0.4],
      [0.8, 0.8],
      [0.4, 0.2],
      [0.6, 1],
    ]);
    expect(h).toHaveLength(4);
    expect(signedArea(h)).toBeGreaterThan(0);
  });

  it('handles fewer than three points', () => {
    expect(hull([[1, 2]])).toEqual([[1, 2]]);
  });
});
