import { describe, expect, it } from 'vitest';
import { createSilhouette, type Silhouette } from './prop-shadow';
import {
  addPropTerrain,
  DEFAULT_EDGE_RADIUS_M,
  DEFAULT_MAX_EDGES,
  edgeCount,
  silhouetteArea,
  silhouetteToTerrain,
  type CapsuleSink,
  type PropDef,
} from './prop-terrain';
import { createStagePlane } from './stage-plane';

interface Cap {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  r: number;
  tag: number;
}

function sink(capacity = 64): CapsuleSink & { caps: Cap[] } {
  const caps: Cap[] = [];
  return {
    caps,
    add(ax, ay, bx, by, r, tag = 0) {
      if (caps.length === capacity) return -1;
      caps.push({ ax, ay, bx, by, r, tag });
      return caps.length - 1;
    },
  };
}

/** A regular n-gon of the given radius, counter-clockwise, as a Silhouette. */
function ngon(n: number, radius: number): Silhouette {
  const s = createSilhouette();
  for (let i = 0; i < n; i++) {
    const a = (2 * Math.PI * i) / n;
    s.points[i * 2] = radius * Math.cos(a);
    s.points[i * 2 + 1] = radius * Math.sin(a);
  }
  s.count = n;
  return s;
}

describe('silhouetteArea', () => {
  it('is the polygon area', () => {
    const sq = createSilhouette();
    sq.points.set([0, 0, 0.2, 0, 0.2, 0.1, 0, 0.1]);
    sq.count = 4;
    expect(silhouetteArea(sq)).toBeCloseTo(0.02, 6);
  });

  it('is 0 for fewer than three points', () => {
    const s = createSilhouette();
    s.count = 2;
    expect(silhouetteArea(s)).toBe(0);
  });
});

describe('edgeCount', () => {
  it('is the number of edges after simplifying, and 0 for no polygon', () => {
    expect(edgeCount(24)).toBe(DEFAULT_MAX_EDGES);
    expect(edgeCount(5)).toBe(5);
    expect(edgeCount(24, 1)).toBe(3);
    expect(edgeCount(2)).toBe(0);
  });
});

describe('silhouetteToTerrain', () => {
  it('makes one capsule per edge of a small polygon, closing the loop', () => {
    const s = sink();
    const sq = createSilhouette();
    sq.points.set([0, 0, 0.2, 0, 0.2, 0.1, 0, 0.1]);
    sq.count = 4;
    expect(silhouetteToTerrain(sq, s, 3)).toBe(4);
    expect(s.caps).toHaveLength(4);
    // Float32 storage in the solver is not the issue here, but the polygon's own points are Float32.
    expect(s.caps[3].ax).toBeCloseTo(0, 6);
    expect(s.caps[3].ay).toBeCloseTo(0.1, 6);
    expect(s.caps[3].bx).toBeCloseTo(0, 6);
    expect(s.caps[3].by).toBeCloseTo(0, 6);
    expect(s.caps.every((c) => c.tag === 3 && c.r === DEFAULT_EDGE_RADIUS_M)).toBe(true);
  });

  it('simplifies a 24-gon to the edge limit and keeps real vertices', () => {
    const s = sink();
    const circle = ngon(24, 0.1);
    expect(silhouetteToTerrain(circle, s)).toBe(DEFAULT_MAX_EDGES);
    for (const c of s.caps) {
      expect(Math.sqrt(c.ax * c.ax + c.ay * c.ay)).toBeCloseTo(0.1, 5);
      expect(Math.sqrt(c.bx * c.bx + c.by * c.by)).toBeCloseTo(0.1, 5);
    }
  });

  it.each([
    [6, 0.75],
    [8, 0.85],
  ])('keeps the simplified shape convex and most of its area (%i edges)', (edges, minShare) => {
    const s = sink();
    silhouetteToTerrain(ngon(24, 0.1), s, 0, { maxEdges: edges });
    expect(s.caps).toHaveLength(edges);
    const poly = createSilhouette();
    s.caps.forEach((c, i) => {
      poly.points[i * 2] = c.ax;
      poly.points[i * 2 + 1] = c.ay;
    });
    poly.count = edges;
    expect(silhouetteArea(poly) / silhouetteArea(ngon(24, 0.1))).toBeGreaterThan(minShare);
    for (let i = 0; i < edges; i++) {
      const a = s.caps[i],
        b = s.caps[(i + 1) % edges];
      expect((a.bx - a.ax) * (b.by - b.ay) - (a.by - a.ay) * (b.bx - b.ax)).toBeGreaterThan(0);
    }
  });

  it('adds nothing for a shadow under the minimum area', () => {
    const s = sink();
    expect(silhouetteToTerrain(ngon(24, 0.01), s)).toBe(0);
    expect(s.caps).toHaveLength(0);
  });

  it('adds nothing for an empty or two-point silhouette', () => {
    const s = sink();
    expect(silhouetteToTerrain(createSilhouette(), s)).toBe(0);
  });

  it('stops when the pool is full and says how many it added', () => {
    const s = sink(5);
    expect(silhouetteToTerrain(ngon(24, 0.1), s)).toBe(5);
    expect(s.caps).toHaveLength(5);
  });

  it('honours the radius and the edge limit options', () => {
    const s = sink();
    silhouetteToTerrain(ngon(24, 0.1), s, 0, { maxEdges: 4, radius: 0.02 });
    expect(s.caps).toHaveLength(4);
    expect(s.caps.every((c) => c.r === 0.02)).toBe(true);
  });
});

describe('addPropTerrain', () => {
  const frame = createStagePlane();
  const light = [0, 0, 0.6];
  const box: PropDef = {
    shape: 'box',
    position: [0, 0, 0.3],
    size: [0.1, 0.1, 0.1],
    rotation: [0, 0, 0, 1],
    solid: true,
    tag: 7,
  };

  it('turns a solid prop into ground with its tag', () => {
    const s = sink();
    const n = addPropTerrain(box, light, frame, 0.9, s, createSilhouette());
    expect(n).toBeGreaterThanOrEqual(3);
    expect(n).toBeLessThanOrEqual(DEFAULT_MAX_EDGES);
    expect(s.caps.every((c) => c.tag === 7)).toBe(true);
  });

  it('puts the ground where the shadow is', () => {
    const s = sink();
    addPropTerrain(box, light, frame, 0.9, s, createSilhouette());
    const xs = s.caps.flatMap((c) => [c.ax, c.bx]);
    expect(Math.min(...xs)).toBeLessThan(0);
    expect(Math.max(...xs)).toBeGreaterThan(0);
    expect(Math.abs(Math.min(...xs) + Math.max(...xs))).toBeLessThan(1e-4);
  });

  it('adds nothing for a prop that is not solid', () => {
    const s = sink();
    expect(addPropTerrain({ ...box, solid: false }, light, frame, 0.9, s, createSilhouette())).toBe(0);
  });

  it('adds nothing when the prop casts no shadow', () => {
    const s = sink();
    const behindWall = { ...box, position: [0, 0, -0.3] };
    expect(addPropTerrain(behindWall, light, frame, 0.9, s, createSilhouette())).toBe(0);
  });
});
