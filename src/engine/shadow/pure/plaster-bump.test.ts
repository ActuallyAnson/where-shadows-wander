import { describe, expect, it } from 'vitest';
import { plasterHeight, plasterNormals } from './plaster-bump';

describe('plasterHeight', () => {
  it('is in 0..1, not flat, and the same for the same seed', () => {
    const h = plasterHeight(64, 3);
    let lo = 1,
      hi = 0;
    for (const v of h) {
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    }
    expect(lo).toBeGreaterThanOrEqual(0);
    expect(hi).toBeLessThanOrEqual(1);
    expect(hi - lo).toBeGreaterThan(0.2);
    expect(plasterHeight(64, 3)).toEqual(h);
    expect(plasterHeight(64, 4)).not.toEqual(h);
  });

  it('tiles: across each edge it steps no more than it does inside', () => {
    const n = 64;
    const h = plasterHeight(n, 2);
    let inside = 0,
      seam = 0;
    for (let y = 0; y < n; y++) {
      for (let x = 1; x < n; x++) inside = Math.max(inside, Math.abs(h[y * n + x] - h[y * n + x - 1]));
      seam = Math.max(seam, Math.abs(h[y * n] - h[y * n + n - 1]));
    }
    for (let x = 0; x < n; x++) seam = Math.max(seam, Math.abs(h[x] - h[(n - 1) * n + x]));
    expect(seam).toBeLessThanOrEqual(inside * 1.01);
  });
});

describe('plasterNormals', () => {
  it('are unit normals facing out of the wall, leaning a little, on average straight out', () => {
    const n = 64;
    const px = plasterNormals(n, 1, 2);
    expect(px).toHaveLength(n * n * 4);
    let sx = 0,
      sy = 0,
      minZ = 1;
    for (let i = 0; i < n * n; i++) {
      const x = px[i * 4] / 127.5 - 1,
        y = px[i * 4 + 1] / 127.5 - 1,
        z = px[i * 4 + 2] / 127.5 - 1;
      expect(Math.hypot(x, y, z)).toBeCloseTo(1, 1);
      expect(px[i * 4 + 3]).toBe(255);
      sx += x;
      sy += y;
      minZ = Math.min(minZ, z);
    }
    expect(Math.abs(sx / (n * n))).toBeLessThan(0.02);
    expect(Math.abs(sy / (n * n))).toBeLessThan(0.02);
    expect(minZ).toBeGreaterThan(0.7); // plaster, not rock
    expect(minZ).toBeLessThan(0.995); // but not flat
  });
});
