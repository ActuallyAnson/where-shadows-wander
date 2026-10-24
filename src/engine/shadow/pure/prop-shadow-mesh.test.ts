import { describe, expect, it } from 'vitest';
import { createSilhouette, type Silhouette } from './prop-shadow';
import {
  appendFeathered,
  createPropShadowMesh,
  INDICES_PER_SHADOW,
  MAX_PROP_SHADOWS,
  resetPropShadowMesh,
  VERTS_PER_SHADOW,
} from './prop-shadow-mesh';

function square(half = 0.1): Silhouette {
  const s = createSilhouette();
  s.points.set([-half, -half, half, -half, half, half, -half, half]);
  s.count = 4;
  return s;
}

function ngon(n: number, radius: number): Silhouette {
  const s = createSilhouette();
  for (let i = 0; i < n; i++) {
    s.points[i * 2] = radius * Math.cos((2 * Math.PI * i) / n);
    s.points[i * 2 + 1] = radius * Math.sin((2 * Math.PI * i) / n);
  }
  s.count = n;
  return s;
}

describe('appendFeathered', () => {
  it('writes the polygon ring then an outer ring, and a fan plus a rim of triangles', () => {
    const m = createPropShadowMesh();
    expect(appendFeathered(m, square(), 0.01)).toBe(true);
    expect(m.vertexCount).toBe(8);
    expect(m.indexCount).toBe((4 - 2) * 3 + 4 * 6);
    expect(m.shadows).toBe(1);
  });

  it('is opaque on the polygon and transparent on the outer ring, in black', () => {
    const m = createPropShadowMesh();
    appendFeathered(m, square(), 0.01);
    for (let v = 0; v < 8; v++) {
      expect([m.colors[v * 4], m.colors[v * 4 + 1], m.colors[v * 4 + 2]]).toEqual([0, 0, 0]);
      expect(m.colors[v * 4 + 3]).toBe(v < 4 ? 1 : 0);
    }
  });

  it('keeps the polygon where it is and puts the rim blur away from it', () => {
    const m = createPropShadowMesh();
    appendFeathered(m, square(0.1), 0.01);
    // Inner ring is the silhouette; the outer ring is on the same side, the corner pushed out along the diagonal by blur * sqrt(2).
    expect(m.positions[0]).toBeCloseTo(-0.1, 6);
    expect(m.positions[1]).toBeCloseTo(-0.1, 6);
    const ox = m.positions[4 * 3],
      oy = m.positions[4 * 3 + 1];
    expect(ox).toBeCloseTo(-0.1 - 0.01, 5);
    expect(oy).toBeCloseTo(-0.1 - 0.01, 5);
    for (let v = 0; v < 8; v++) expect(m.positions[v * 3 + 2]).toBe(0);
  });

  it('puts every outer vertex outside the polygon', () => {
    const m = createPropShadowMesh();
    appendFeathered(m, ngon(24, 0.1), 0.01);
    for (let i = 0; i < 24; i++) {
      const inner = Math.hypot(m.positions[i * 3], m.positions[i * 3 + 1]);
      const outer = Math.hypot(m.positions[(24 + i) * 3], m.positions[(24 + i) * 3 + 1]);
      expect(outer).toBeGreaterThan(inner);
      expect(outer - inner).toBeLessThan(0.0125);
    }
  });

  it('caps a very sharp corner so the rim cannot spike', () => {
    const m = createPropShadowMesh();
    const needle = createSilhouette();
    needle.points.set([0, 0, 0.5, 0.001, 0, 0.002]);
    needle.count = 3;
    appendFeathered(m, needle, 0.01);
    for (let i = 0; i < 3; i++) {
      const dx = m.positions[(3 + i) * 3] - m.positions[i * 3],
        dy = m.positions[(3 + i) * 3 + 1] - m.positions[i * 3 + 1];
      expect(Math.sqrt(dx * dx + dy * dy)).toBeLessThanOrEqual(0.02 + 1e-6);
    }
  });

  it('indexes only vertices that exist', () => {
    const m = createPropShadowMesh();
    appendFeathered(m, square(), 0.01);
    appendFeathered(m, ngon(24, 0.1), 0.01);
    for (let i = 0; i < m.indexCount; i++) expect(m.indices[i]).toBeLessThan(m.vertexCount);
  });

  it('adds several shadows one after another', () => {
    const m = createPropShadowMesh();
    appendFeathered(m, square(), 0.01);
    appendFeathered(m, ngon(24, 0.1), 0.01);
    expect(m.shadows).toBe(2);
    expect(m.vertexCount).toBe(8 + 48);
  });

  it('refuses a silhouette under three points', () => {
    const m = createPropShadowMesh();
    const s = createSilhouette();
    s.count = 2;
    expect(appendFeathered(m, s, 0.01)).toBe(false);
    expect(m.shadows).toBe(0);
  });

  it('stops when full, and reset starts over', () => {
    const m = createPropShadowMesh();
    for (let i = 0; i < MAX_PROP_SHADOWS; i++) expect(appendFeathered(m, ngon(24, 0.1), 0.01)).toBe(true);
    expect(appendFeathered(m, square(), 0.01)).toBe(false);
    expect(m.vertexCount).toBe(MAX_PROP_SHADOWS * VERTS_PER_SHADOW);
    expect(m.indexCount).toBeLessThanOrEqual(MAX_PROP_SHADOWS * INDICES_PER_SHADOW);
    resetPropShadowMesh(m);
    expect(m.shadows).toBe(0);
    expect(appendFeathered(m, square(), 0.01)).toBe(true);
  });
});
