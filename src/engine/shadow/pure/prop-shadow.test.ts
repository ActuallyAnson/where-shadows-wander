import { describe, expect, it } from 'vitest';
import { magnification, projectToStage, shadowMatrix } from './projection';
import { createSilhouette, MAX_SILHOUETTE_VERTS, projectProp, type Prop, type Silhouette } from './prop-shadow';
import { createStagePlane, type MutableStagePlane } from './stage-plane';

/** A wall facing +Z (toward the lantern), 2 m in front of the origin; x right, y up. */
function wall(): MutableStagePlane {
  const s = createStagePlane();
  s.origin.set([0, 0, -2]);
  s.width = s.height = 4;
  return s;
}
const FRAME = wall();
const LIGHT = [0, 0, 0];
const ID = [0, 0, 0, 1];
const S45 = Math.sin(Math.PI / 4);
const S225 = Math.sin(Math.PI / 8);
const C225 = Math.cos(Math.PI / 8);

function prop(shape: Prop['shape'], pos: number[], size: number[], rotation = ID): Prop {
  return { shape, position: pos, size, rotation };
}

function bounds(s: Silhouette) {
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;
  for (let i = 0; i < s.count; i++) {
    minX = Math.min(minX, s.points[i * 2]);
    maxX = Math.max(maxX, s.points[i * 2]);
    minY = Math.min(minY, s.points[i * 2 + 1]);
    maxY = Math.max(maxY, s.points[i * 2 + 1]);
  }
  return { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY };
}

function run(p: Prop, k: number, light = LIGHT) {
  const out = createSilhouette();
  const n = projectProp(p, light, FRAME, k, out);
  expect(out.count).toBe(n);
  for (let i = 0; i < n * 2; i++) expect(Number.isFinite(out.points[i])).toBe(true);
  return out;
}

describe('box', () => {
  const cube = prop('box', [0, 0, -1], [0.2, 0.2, 0.2]);

  it('is its own outline when projected orthographically', () => {
    const b = bounds(run(cube, 1));
    expect(run(cube, 1).count).toBeGreaterThanOrEqual(4); // near-duplicate corners may survive the hull
    expect(b.minX).toBeCloseTo(-0.1, 5);
    expect(b.maxX).toBeCloseTo(0.1, 5);
    expect(b.maxY).toBeCloseTo(0.1, 5);
  });

  it('is magnified by the nearer face from a point light', () => {
    // The face at z = -0.9 is 0.9 m from the light, the wall 2 m: 0.1 · 2 / 0.9.
    const b = bounds(run(cube, 0));
    expect(b.maxX).toBeCloseTo((0.1 * 2) / 0.9, 5);
    expect(b.minY).toBeCloseTo((-0.1 * 2) / 0.9, 5);
  });

  it('follows the rotation', () => {
    const turned = prop('box', [0, 0, -1], [0.2, 0.2, 0.2], [0, S225, 0, C225]); // 45° about Y
    const b = bounds(run(turned, 1));
    expect(b.maxX).toBeCloseTo(0.1 * Math.SQRT2, 5);
    expect(b.maxY).toBeCloseTo(0.1, 5);
  });

  it('is counter-clockwise and convex', () => {
    const o = run(prop('box', [0.3, 0.1, -1], [0.3, 0.2, 0.1], [0.2, 0.3, 0.1, 0.9273618]), 0.65);
    let area2 = 0;
    for (let i = 0; i < o.count; i++) {
      const j = (i + 1) % o.count;
      area2 += o.points[i * 2] * o.points[j * 2 + 1] - o.points[j * 2] * o.points[i * 2 + 1];
    }
    expect(area2).toBeGreaterThan(0);
  });
});

describe('sphere', () => {
  it('is a circle at the projected centre with the magnified radius', () => {
    const o = run(prop('sphere', [0.1, 0, -1], [0.1]), 0);
    expect(o.count).toBe(MAX_SILHOUETTE_VERTS);
    const m = magnification(2, 1, 0);
    expect(m).toBeCloseTo(2, 9);
    for (let i = 0; i < o.count; i++) {
      expect(Math.hypot(o.points[i * 2] - 0.2, o.points[i * 2 + 1])).toBeCloseTo(0.1 * m, 5);
    }
  });

  it('puts its centre where the existing projection does', () => {
    const matrix = shadowMatrix(FRAME, [0.1, 0.2, 0.3], 0.65, new Float64Array(16));
    const xy = new Float64Array(2);
    projectToStage(matrix, FRAME, 0.3, 0.2, -1, xy);
    const b = bounds(run(prop('sphere', [0.3, 0.2, -1], [0.05]), 0.65, [0.1, 0.2, 0.3]));
    expect((b.minX + b.maxX) / 2).toBeCloseTo(xy[0], 4);
    expect((b.minY + b.maxY) / 2).toBeCloseTo(xy[1], 4);
  });
});

describe('cylinder', () => {
  it('seen from the side is a rectangle, orthographically', () => {
    const o = run(prop('cylinder', [0, 0, -1], [0.1, 0.4]), 1);
    const b = bounds(o);
    expect(o.count).toBeGreaterThanOrEqual(4);
    expect(b.width).toBeCloseTo(0.2, 5);
    expect(b.height).toBeCloseTo(0.4, 5);
  });

  it('seen end-on is a circle', () => {
    const o = run(prop('cylinder', [0, 0, -1], [0.1, 0.4], [S45, 0, 0, S45]), 1); // axis turned to Z
    const b = bounds(o);
    expect(o.count).toBeGreaterThanOrEqual(12);
    expect(o.count).toBeLessThanOrEqual(MAX_SILHOUETTE_VERTS);
    expect(b.width).toBeCloseTo(0.2, 5);
    expect(b.height).toBeCloseTo(0.2, 2);
  });

  it('never exceeds the maximum vertex count', () => {
    const o = run(prop('cylinder', [0.2, 0.1, -1], [0.15, 0.3], [0.3, 0.1, 0.2, 0.9273618]), 0);
    expect(o.count).toBeLessThanOrEqual(MAX_SILHOUETTE_VERTS);
    expect(o.count).toBeGreaterThan(3);
  });
});

describe('light distance', () => {
  const shapes = [
    prop('box', [0, 0, -1], [0.2, 0.2, 0.2]),
    prop('sphere', [0, 0, -1], [0.1]),
    prop('cylinder', [0, 0, -1], [0.1, 0.2]),
  ];
  for (const p of shapes) {
    it(`${p.shape}: a nearer light casts a bigger shadow, a further one a smaller one (perspective)`, () => {
      const near = bounds(run(p, 0, [0, 0, -0.4])).width;
      const mid = bounds(run(p, 0, [0, 0, 0])).width;
      const far = bounds(run(p, 0, [0, 0, 2])).width;
      expect(near).toBeGreaterThan(mid);
      expect(mid).toBeGreaterThan(far);
    });

    it(`${p.shape}: orthographic ignores the light distance`, () => {
      const a = bounds(run(p, 1, [0, 0, -0.4])).width;
      const b = bounds(run(p, 1, [0, 0, 2])).width;
      expect(a).toBeCloseTo(b, 5);
    });
  }
});

describe('no shadow (empty, never NaN)', () => {
  const shapes: [string, Prop][] = [
    ['box', prop('box', [0, 0, -1], [0.2, 0.2, 0.2])],
    ['sphere', prop('sphere', [0, 0, -1], [0.1])],
    ['cylinder', prop('cylinder', [0, 0, -1], [0.1, 0.2])],
  ];
  const at = (p: Prop, pos: number[]): Prop => ({ ...p, position: pos });
  for (const [name, p] of shapes) {
    describe(name, () => {
      it('light inside the prop', () => {
        expect(run(p, 0.65, [0, 0, -1]).count).toBe(0);
        expect(run(p, 0, [0.01, 0.01, -1.01]).count).toBe(0);
      });
      it('light level with the prop (its plane crosses the prop)', () => {
        expect(run(p, 0.65, [1, 0, -1]).count).toBe(0);
      });
      it('prop behind the light', () => {
        expect(run(at(p, [0, 0, 1]), 0.65).count).toBe(0);
        expect(run(at(p, [0, 0, 3]), 0.65).count).toBe(0);
      });
      it('prop on or behind the wall', () => {
        expect(run(at(p, [0, 0, -2]), 0.65).count).toBe(0);
        expect(run(at(p, [0, 0, -2.5]), 0.65).count).toBe(0);
      });
      it('light on or behind the wall', () => {
        expect(run(p, 0.65, [0, 0, -2]).count).toBe(0);
        expect(run(p, 0.65, [0, 0, -3]).count).toBe(0);
      });
      it('non-finite or non-positive input', () => {
        expect(run(at(p, [NaN, 0, -1]), 0.65).count).toBe(0);
        expect(run(p, 0.65, [0, Infinity, 0]).count).toBe(0);
        expect(run(p, NaN).count).toBe(0);
        expect(run({ ...p, size: [0, 0.2, 0.2] }, 0.65).count).toBe(0);
        expect(run({ ...p, size: [-0.1, 0.2, 0.2] }, 0.65).count).toBe(0);
      });
    });
  }

  it('clears a previous silhouette', () => {
    const out = createSilhouette();
    expect(projectProp(shapes[0][1], LIGHT, FRAME, 0.65, out)).toBeGreaterThan(0);
    expect(projectProp(shapes[0][1], [0, 0, -1], FRAME, 0.65, out)).toBe(0);
    expect(out.count).toBe(0);
  });
});
