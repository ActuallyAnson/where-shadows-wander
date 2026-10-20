// Projects an invisible prop (box, sphere or cylinder) onto the stage as a silhouette, from the same lantern
// and with the same blended projection as the hands (GDD "The landscape: shadows of invisible props").
// The output is a plain convex polygon in stage metres; turning it into terrain is the solver's side.
// Plain TypeScript; allocates nothing per call.
import { convexHull } from './hull';
import { magnification, projectToStage, shadowMatrix } from './projection';
import { distanceToPlane, type StagePlane } from './stage-plane';

type V3 = Readonly<ArrayLike<number>>;

export type PropShape = 'box' | 'sphere' | 'cylinder';

export interface Prop {
  shape: PropShape;
  /** The prop's centre, scene space, metres. */
  position: V3;
  /**
   * Box: full extents x, y, z. Sphere: radius in [0]. Cylinder: radius in [0], full height in [1]
   * (its axis is the prop's local Y).
   */
  size: V3;
  /** Unit quaternion x, y, z, w, scene space. Ignored for a sphere. */
  rotation: V3;
}

/** Points on a cylinder's cap circle, and on a sphere's outline. */
const CAP_POINTS = 12;
const SPHERE_POINTS = 24;
/**
 * The most vertices a silhouette can have: a cylinder's 24 samples (two caps of 12) are the largest hull
 * input, and a sphere's outline is also 24. That is within convexHull's design limit of about 25 points,
 * and a 24-gon is within 1 % of a true circle. A box's hull never has more than 8.
 */
export const MAX_SILHOUETTE_VERTS = 24;

export interface Silhouette {
  /** Convex polygon, counter-clockwise, x then y in stage metres; the first `count` points are valid. */
  readonly points: Float32Array;
  /** 0 when the prop casts no usable shadow (see projectProp). */
  count: number;
}

export function createSilhouette(): Silhouette {
  return { points: new Float32Array(MAX_SILHOUETTE_VERTS * 2), count: 0 };
}

const EPS = 1e-9;
/** How far the lantern is in front of the wall, metres, for the projectProp call in progress. */
const LIGHT_D = new Float64Array(1); // a typed array: a module-level `let` double is boxed on every write

// Scratch, so projecting a prop every frame allocates nothing.
const M = new Float64Array(16);
const XY = new Float64Array(2);
const SAMPLES = new Float64Array(CAP_POINTS * 2 * 2);
const ORDER = new Uint8Array(CAP_POINTS * 2);
const HULL = new Float32Array((CAP_POINTS * 2 + 1) * 2);
const COS = new Float64Array(SPHERE_POINTS);
const SIN = new Float64Array(SPHERE_POINTS);
for (let i = 0; i < SPHERE_POINTS; i++) {
  COS[i] = Math.cos((2 * Math.PI * i) / SPHERE_POINTS);
  SIN[i] = Math.sin((2 * Math.PI * i) / SPHERE_POINTS);
}

// A double passed to a function that isn't inlined is boxed, which allocates. So the helpers below read
// their numbers from these typed arrays instead of taking them as arguments.
/** The prop's rotation as a row-major 3x3 matrix (local to scene). */
const RM = new Float64Array(9);
/** The prop-local point being projected. */
const LOCAL = new Float64Array(3);

/** Fills RM from the unit quaternion q. */
function rotationMatrix(q: V3): void {
  const x = q[0],
    y = q[1],
    z = q[2],
    w = q[3];
  RM[0] = 1 - 2 * (y * y + z * z);
  RM[1] = 2 * (x * y - z * w);
  RM[2] = 2 * (x * z + y * w);
  RM[3] = 2 * (x * y + z * w);
  RM[4] = 1 - 2 * (x * x + z * z);
  RM[5] = 2 * (y * z - x * w);
  RM[6] = 2 * (x * z - y * w);
  RM[7] = 2 * (y * z + x * w);
  RM[8] = 1 - 2 * (x * x + y * y);
}

/** Whether the light is inside (or on) the prop. Needs RM. */
function lightInside(prop: Prop, light: V3): boolean {
  const p = prop.position,
    s = prop.size;
  const dx = light[0] - p[0],
    dy = light[1] - p[1],
    dz = light[2] - p[2];
  // Scene to local is the transpose of RM.
  const lx = RM[0] * dx + RM[3] * dy + RM[6] * dz,
    ly = RM[1] * dx + RM[4] * dy + RM[7] * dz,
    lz = RM[2] * dx + RM[5] * dy + RM[8] * dz;
  if (prop.shape === 'box') return Math.abs(lx) <= s[0] / 2 && Math.abs(ly) <= s[1] / 2 && Math.abs(lz) <= s[2] / 2;
  if (prop.shape === 'sphere') return lx * lx + ly * ly + lz * lz <= s[0] * s[0];
  return Math.abs(ly) <= s[1] / 2 && lx * lx + lz * lz <= s[0] * s[0];
}

/** Projects the prop-local point in LOCAL into SAMPLES[slot]. Returns false if it has no shadow. Needs RM. */
function sample(prop: Prop, slot: number, frame: StagePlane): boolean {
  const p = prop.position;
  const px = p[0] + RM[0] * LOCAL[0] + RM[1] * LOCAL[1] + RM[2] * LOCAL[2],
    py = p[1] + RM[3] * LOCAL[0] + RM[4] * LOCAL[1] + RM[5] * LOCAL[2],
    pz = p[2] + RM[6] * LOCAL[0] + RM[7] * LOCAL[1] + RM[8] * LOCAL[2];
  // With blend > 0 the homogeneous w stays positive past the lantern (the light is dollied back), so the
  // lantern's own plane has to be checked here: a point at or beyond it would mirror.
  const o = frame.origin,
    n = frame.normal;
  if (!((px - o[0]) * n[0] + (py - o[1]) * n[1] + (pz - o[2]) * n[2] < LIGHT_D[0] - 1e-6)) return false;
  const w = projectToStage(M, frame, px, py, pz, XY);
  if (!(w > EPS) || !Number.isFinite(XY[0]) || !Number.isFinite(XY[1])) return false;
  SAMPLES[slot * 2] = XY[0];
  SAMPLES[slot * 2 + 1] = XY[1];
  return true;
}

/**
 * Writes the silhouette of `prop` lit from `light` onto `frame` into `out`, using the same blend toward
 * orthographic (`blend`, 0 to 1) as the hands so the two shadows match. Returns the vertex count, also
 * stored in `out.count`.
 *
 * The count is 0, never NaN, when there is no usable shadow: the light is inside the prop, the prop reaches
 * the light's plane or lies behind it (its shadow would be unbounded or mirrored), the prop's centre is on
 * or behind the wall, or an input is non-finite or the size is not positive.
 */
export function projectProp(prop: Prop, light: V3, frame: StagePlane, blend: number, out: Silhouette): number {
  out.count = 0;
  const p = prop.position,
    s = prop.size;
  const lightD = distanceToPlane(frame, light[0], light[1], light[2]);
  const h = distanceToPlane(frame, p[0], p[1], p[2]);
  if (!(h > 1e-6) || !(lightD > 0) || !(blend >= 0 && blend <= 1) || !Number.isFinite(lightD + h)) return 0;

  const shape = prop.shape;
  if (shape === 'box' ? !(s[0] > 0 && s[1] > 0 && s[2] > 0) : !(s[0] > 0 && (shape === 'sphere' || s[1] > 0))) return 0;
  rotationMatrix(prop.rotation);
  if (lightInside(prop, light)) return 0;
  LIGHT_D[0] = lightD;
  shadowMatrix(frame, light, blend, M);

  if (shape === 'sphere') {
    const r = s[0];
    if (!(h + r < lightD)) return 0; // the sphere reaches the light's plane
    if (!(projectToStage(M, frame, p[0], p[1], p[2], XY) > EPS)) return 0;
    const rs = r * magnification(lightD, h, blend);
    if (!Number.isFinite(rs + XY[0] + XY[1])) return 0;
    for (let i = 0; i < SPHERE_POINTS; i++) {
      out.points[i * 2] = XY[0] + rs * COS[i];
      out.points[i * 2 + 1] = XY[1] + rs * SIN[i];
    }
    return (out.count = SPHERE_POINTS);
  }

  let n = 0;
  if (shape === 'box') {
    const hx = s[0] / 2,
      hy = s[1] / 2,
      hz = s[2] / 2;
    for (let i = 0; i < 8; i++) {
      LOCAL[0] = i & 1 ? hx : -hx;
      LOCAL[1] = i & 2 ? hy : -hy;
      LOCAL[2] = i & 4 ? hz : -hz;
      if (!sample(prop, n, frame)) return 0;
      n++;
    }
  } else {
    const r = s[0],
      hy = s[1] / 2;
    for (let cap = 0; cap < 2; cap++)
      for (let i = 0; i < CAP_POINTS; i++) {
        // CAP_POINTS divides SPHERE_POINTS, so the sphere's table serves the caps too.
        const k = i * (SPHERE_POINTS / CAP_POINTS);
        LOCAL[0] = r * COS[k];
        LOCAL[1] = cap ? hy : -hy;
        LOCAL[2] = r * SIN[k];
        if (!sample(prop, n, frame)) return 0;
        n++;
      }
  }
  const count = convexHull(SAMPLES, n, HULL, ORDER);
  for (let i = 0; i < count * 2; i++) out.points[i] = HULL[i];
  return (out.count = count);
}
