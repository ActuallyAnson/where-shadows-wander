// Invisible props as a level authors them (GDD "The landscape: shadows of invisible props"): simple
// shapes standing in front of the wall whose shadows are the ground the traveller walks on. Plain
// TypeScript; everything here runs on puzzle load, never per step.
//
// Props are authored in stage space, the way a level is designed (backwards, from the shadow it
// needs): x and y are the prop's centre as seen on the wall, `depth` is how far it stands in front
// of the wall toward the lantern, and `tilt` turns it in the wall's plane. A prop close to the wall
// casts a shadow about its own size, so authors place props at a small depth (DEFAULT_DEPTH_M).
//
// Turning a prop into ground takes the lantern and the shadow projection, which live with the app.
// So the level loader calls a PropCaster: the app's caster converts the prop to scene space with
// `propToScene` and projects it with the same light and blend as the hands (Anson's
// addPropTerrain in src/engine/shadow/pure/prop-terrain.ts). Headless play and the tests use
// `orthoCaster`, the fully orthographic shadow, which is exactly the prop's outline on the wall.

export type PropShape = 'box' | 'sphere' | 'cylinder';

export interface LevelProp {
  /** A name for problems and the debug view ("bed", "books-left"). */
  readonly id: string;
  readonly shape: PropShape;
  /** Centre on the stage, metres. */
  readonly x: number;
  readonly y: number;
  /** Distance in front of the wall toward the lantern, metres (default DEFAULT_DEPTH_M). */
  readonly depth?: number;
  /**
   * Box: full width, height and depth. Sphere: radius in [0]. Cylinder: radius in [0], full height
   * in [1] (its axis runs up the wall before `tilt`). Metres.
   */
  readonly size: readonly number[];
  /** Turn in the wall's plane, radians, counter-clockwise as seen from the lantern (default 0). */
  readonly tilt?: number;
  /** False for a shadow that is only drawn, never walked on (default true). */
  readonly solid?: boolean;
}

/** A prop in scene space: the record Anson's projectProp takes (`Prop` in prop-shadow.ts). */
export interface SceneProp {
  shape: PropShape;
  position: Float64Array;
  size: Float64Array;
  /** Unit quaternion x, y, z, w. */
  rotation: Float64Array;
}

/** The part of the stage frame a prop is placed against (StageFrame and StagePlane both fit). */
export interface PropStage {
  readonly origin: ArrayLike<number>;
  readonly right: ArrayLike<number>;
  readonly up: ArrayLike<number>;
  readonly normal: ArrayLike<number>;
}

/** Where terrain capsules go (the solver's Terrain fits). */
export interface TerrainSink {
  add(ax: number, ay: number, bx: number, by: number, radius: number, tag?: number, enabled?: boolean): number;
}

/** Turns one prop's shadow into ground: adds capsules to `sink` with `tag`, returns how many. */
export interface PropCaster {
  cast(prop: LevelProp, tag: number, sink: TerrainSink): number;
}

export const DEFAULT_DEPTH_M = 0.05;
/** Thickness of a prop's ground line, metres (the same as Anson's DEFAULT_EDGE_RADIUS_M). */
export const PROP_EDGE_RADIUS_M = 0.01;
/** Props' terrain tags are PROP_TAG_BASE + the prop's index in its puzzle, so gameplay can tell them apart. */
export const PROP_TAG_BASE = 16;
/** The most props one puzzle may have (tags must fit in a byte). */
export const MAX_PROPS = 32;
/** Points on a sphere's outline in the orthographic stand-in. */
const SPHERE_EDGES = 8;

export function createSceneProp(): SceneProp {
  return { shape: 'box', position: new Float64Array(3), size: new Float64Array(3), rotation: new Float64Array(4) };
}

/** Places a stage-space prop in scene space against `stage`, into `out`. @returns `out`. */
export function propToScene(p: LevelProp, stage: PropStage, out: SceneProp): SceneProp {
  const { origin: o, right: r, up: u, normal: n } = stage;
  const d = p.depth ?? DEFAULT_DEPTH_M;
  out.shape = p.shape;
  for (let i = 0; i < 3; i++) {
    out.position[i] = o[i] + r[i] * p.x + u[i] * p.y + n[i] * d;
    out.size[i] = p.size[i] ?? 0;
  }
  // Local x, y, z run along the wall's right, up and normal, turned by `tilt` about the normal.
  const t = p.tilt ?? 0;
  const c = Math.cos(t),
    s = Math.sin(t);
  const m00 = r[0] * c + u[0] * s,
    m10 = r[1] * c + u[1] * s,
    m20 = r[2] * c + u[2] * s;
  const m01 = -r[0] * s + u[0] * c,
    m11 = -r[1] * s + u[1] * c,
    m21 = -r[2] * s + u[2] * c;
  const m02 = n[0],
    m12 = n[1],
    m22 = n[2];
  quatFromBasis(m00, m01, m02, m10, m11, m12, m20, m21, m22, out.rotation);
  return out;
}

/**
 * The fully orthographic shadow (blend 1): a prop's outline as seen along the wall's normal, which
 * is what a prop standing close to the wall casts. One capsule per edge. For headless play and tests.
 */
export const orthoCaster: PropCaster = {
  cast(p, tag, sink) {
    const t = p.tilt ?? 0;
    const c = Math.cos(t),
      s = Math.sin(t);
    if (p.shape === 'sphere') {
      const radius = p.size[0];
      if (!(radius > 0)) return 0;
      let added = 0;
      for (let i = 0; i < SPHERE_EDGES; i++) {
        const a0 = (2 * Math.PI * i) / SPHERE_EDGES,
          a1 = (2 * Math.PI * (i + 1)) / SPHERE_EDGES;
        const ok = sink.add(
          p.x + radius * Math.cos(a0),
          p.y + radius * Math.sin(a0),
          p.x + radius * Math.cos(a1),
          p.y + radius * Math.sin(a1),
          PROP_EDGE_RADIUS_M,
          tag,
        );
        if (ok < 0) break;
        added++;
      }
      return added;
    }
    // A box shows its width and height; a cylinder standing up shows its diameter and height.
    const hw = p.shape === 'box' ? p.size[0] / 2 : p.size[0];
    const hh = p.size[1] / 2;
    if (!(hw > 0 && hh > 0)) return 0;
    let added = 0;
    // Corners counter-clockwise from the bottom left, turned by the tilt.
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      const ax = i === 0 || i === 3 ? -hw : hw,
        ay = i < 2 ? -hh : hh;
      const bx = j === 0 || j === 3 ? -hw : hw,
        by = j < 2 ? -hh : hh;
      const ok = sink.add(
        p.x + ax * c - ay * s,
        p.y + ax * s + ay * c,
        p.x + bx * c - by * s,
        p.y + bx * s + by * c,
        PROP_EDGE_RADIUS_M,
        tag,
      );
      if (ok < 0) break;
      added++;
    }
    return added;
  },
};

/** Writes the unit quaternion (x, y, z, w) of the rotation matrix with rows m0*, m1*, m2* into `out`. */
function quatFromBasis(
  m00: number,
  m01: number,
  m02: number,
  m10: number,
  m11: number,
  m12: number,
  m20: number,
  m21: number,
  m22: number,
  out: Float64Array,
): void {
  const trace = m00 + m11 + m22;
  if (trace > 0) {
    const k = 0.5 / Math.sqrt(trace + 1);
    out[3] = 0.25 / k;
    out[0] = (m21 - m12) * k;
    out[1] = (m02 - m20) * k;
    out[2] = (m10 - m01) * k;
  } else if (m00 > m11 && m00 > m22) {
    const k = 2 * Math.sqrt(1 + m00 - m11 - m22);
    out[3] = (m21 - m12) / k;
    out[0] = 0.25 * k;
    out[1] = (m01 + m10) / k;
    out[2] = (m02 + m20) / k;
  } else if (m11 > m22) {
    const k = 2 * Math.sqrt(1 + m11 - m00 - m22);
    out[3] = (m02 - m20) / k;
    out[0] = (m01 + m10) / k;
    out[1] = 0.25 * k;
    out[2] = (m12 + m21) / k;
  } else {
    const k = 2 * Math.sqrt(1 + m22 - m00 - m11);
    out[3] = (m10 - m01) / k;
    out[0] = (m02 + m20) / k;
    out[1] = (m12 + m21) / k;
    out[2] = 0.25 * k;
  }
}
