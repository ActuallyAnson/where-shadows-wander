// Turns an invisible prop's shadow into ground the traveller can walk on (GDD "The landscape: shadows of invisible
// props"). projectProp gives the shadow as a convex polygon; the solver's terrain is a fixed pool of capsules (a thick
// line segment each, default pool of 64), so the polygon is simplified to a few edges and each edge becomes one
// capsule. The same polygon is what gets drawn, so the ground and the shadow agree up to the simplification.
// Plain TypeScript; allocates nothing per call (it is meant for puzzle load, but it costs nothing to keep it flat).
import type { StagePlane } from './stage-plane';
import { projectProp, type Prop, type Silhouette } from './prop-shadow';

type V3 = Readonly<ArrayLike<number>>;

/** The part of the solver's Terrain this writes to (`Terrain` in src/engine/sim/solver.ts has this shape). */
export interface CapsuleSink {
  /** Adds a capsule from (ax, ay) to (bx, by) with `radius`. Returns its index, or -1 when the pool is full. */
  add(ax: number, ay: number, bx: number, by: number, radius: number, tag?: number, enabled?: boolean): number;
}

/** A prop as a level defines it: the shape to cast, and whether it is also ground. */
export interface PropDef extends Prop {
  /** True if the shadow is ground; false for a shadow that is only drawn. */
  solid: boolean;
  /** The terrain tag the capsules get (gameplay's label for what the traveller stands on). */
  tag: number;
}

export interface TerrainOptions {
  /** The most capsules one prop may use; the polygon is simplified to this many edges. At least 3. */
  maxEdges?: number;
  /** Capsule radius, metres: the thickness of the ground line. */
  radius?: number;
  /** Shadows smaller than this, square metres, add no ground. */
  minAreaM2?: number;
}

export const DEFAULT_MAX_EDGES = 8;
export const DEFAULT_EDGE_RADIUS_M = 0.01;
export const DEFAULT_MIN_AREA_M2 = 0.0004; // 4 cm²
const MAX_VERTS = 24;

// Scratch for the polygon being simplified (x, y per vertex).
const W = new Float64Array(MAX_VERTS * 2);

/** Area of the polygon's first `count` points (shoelace), square metres; 0 for fewer than 3 points. */
export function silhouetteArea(sil: Silhouette): number {
  const p = sil.points,
    n = sil.count;
  if (n < 3) return 0;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const j = i + 1 === n ? 0 : i + 1;
    sum += p[i * 2] * p[j * 2 + 1] - p[j * 2] * p[i * 2 + 1];
  }
  return Math.abs(sum) / 2;
}

/** How many capsules `silhouetteToTerrain` will use for a polygon of `count` points. */
export function edgeCount(count: number, maxEdges: number = DEFAULT_MAX_EDGES): number {
  if (count < 3) return 0;
  return Math.min(count, Math.max(3, maxEdges));
}

/**
 * Adds one capsule per edge of the silhouette to `sink`, after simplifying it to at most `maxEdges` edges by
 * dropping the vertex that changes the shape least, one at a time. The polygon stays convex, and every kept
 * vertex is a real vertex of the shadow, so the ground sits just inside the drawn shadow (the capsule radius
 * makes up part of the difference).
 *
 * Returns how many capsules were added. That is fewer than `edgeCount` when the sink fills up, and 0 for a
 * shadow with no area or one under `minAreaM2`.
 */
export function silhouetteToTerrain(sil: Silhouette, sink: CapsuleSink, tag = 0, options?: TerrainOptions): number {
  const maxEdges = Math.max(3, options?.maxEdges ?? DEFAULT_MAX_EDGES);
  const radius = options?.radius ?? DEFAULT_EDGE_RADIUS_M;
  const minArea = options?.minAreaM2 ?? DEFAULT_MIN_AREA_M2;
  let n = Math.min(sil.count, MAX_VERTS);
  if (n < 3 || !(silhouetteArea(sil) >= minArea)) return 0;
  for (let i = 0; i < n * 2; i++) W[i] = sil.points[i];

  while (n > maxEdges) {
    let best = 0,
      bestArea = Infinity;
    for (let i = 0; i < n; i++) {
      const a = (i + n - 1) % n,
        c = (i + 1) % n;
      const area = Math.abs(
        (W[i * 2] - W[a * 2]) * (W[c * 2 + 1] - W[a * 2 + 1]) - (W[c * 2] - W[a * 2]) * (W[i * 2 + 1] - W[a * 2 + 1]),
      );
      if (area < bestArea) {
        bestArea = area;
        best = i;
      }
    }
    for (let i = best; i < n - 1; i++) {
      W[i * 2] = W[(i + 1) * 2];
      W[i * 2 + 1] = W[(i + 1) * 2 + 1];
    }
    n--;
  }

  let added = 0;
  for (let i = 0; i < n; i++) {
    const j = i + 1 === n ? 0 : i + 1;
    if (sink.add(W[i * 2], W[i * 2 + 1], W[j * 2], W[j * 2 + 1], radius, tag) < 0) break;
    added++;
  }
  return added;
}

/**
 * The whole step for one prop: its shadow from `light` on `frame` (with the same `blend` as the hands), then its
 * ground in `sink`. `scratch` is a Silhouette from createSilhouette, reused between props. A prop that is not
 * `solid`, or has no usable shadow, adds nothing. Returns how many capsules were added.
 */
export function addPropTerrain(
  def: PropDef,
  light: V3,
  frame: StagePlane,
  blend: number,
  sink: CapsuleSink,
  scratch: Silhouette,
  options?: TerrainOptions,
): number {
  if (!def.solid) return 0;
  if (projectProp(def, light, frame, blend, scratch) === 0) return 0;
  return silhouetteToTerrain(scratch, sink, def.tag, options);
}
