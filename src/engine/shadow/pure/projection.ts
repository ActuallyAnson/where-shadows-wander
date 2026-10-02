// Planar shadow projection from the lantern onto the stage, blended toward
// orthographic (GDD "Light geometry", spike section 5). Plain TypeScript.
//
// The light is the homogeneous point Lh = ((1-k)·L + k·n, 1-k). k = 0 is a
// perspective projection from the lantern L; k = 1 is orthographic along the
// stage normal n; in between, the light is dollied back by k/(1-k) metres, so
// it's still one 4x4 matrix:  M = (π·Lh)·I − Lh ⊗ π,  with π = (n, −n·origin).
// k ≈ 0.9 keeps a hand's shadow within ±10 % in size for walls 1–3 m away.
import type { StagePlane } from './stage-plane';

type V3 = Readonly<ArrayLike<number>>;

// Scratch for shadowMatrix, so building it every frame allocates nothing.
const L = new Float64Array(4);
const P = new Float64Array(4);

/** Writes the blended shadow matrix (column-major, like three.js Matrix4.elements) into `out`. */
export function shadowMatrix(stage: StagePlane, light: V3, k: number, out: Float64Array): Float64Array {
  const n = stage.normal,
    o = stage.origin;
  const d = -(n[0] * o[0] + n[1] * o[1] + n[2] * o[2]);
  const w = 1 - k;
  const l0 = w * light[0] + k * n[0],
    l1 = w * light[1] + k * n[1],
    l2 = w * light[2] + k * n[2],
    l3 = w;
  const dot = n[0] * l0 + n[1] * l1 + n[2] * l2 + d * l3;
  L[0] = l0;
  L[1] = l1;
  L[2] = l2;
  L[3] = l3;
  P[0] = n[0];
  P[1] = n[1];
  P[2] = n[2];
  P[3] = d;
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) out[c * 4 + r] = (r === c ? dot : 0) - L[r] * P[c];
  return out;
}

/**
 * Projects a scene point with `m` and writes its stage coordinates (along
 * `right` and `up` from the stage's centre) into out[0], out[1]. Returns the
 * homogeneous w, which must be > 0: a point at or behind the light's plane
 * has no shadow (it would mirror), and the caller should drop it.
 */
export function projectToStage(
  m: Float64Array,
  stage: StagePlane,
  x: number,
  y: number,
  z: number,
  out: Float64Array,
): number {
  const w = m[3] * x + m[7] * y + m[11] * z + m[15];
  if (!(w > 1e-9)) return w;
  const px = (m[0] * x + m[4] * y + m[8] * z + m[12]) / w - stage.origin[0];
  const py = (m[1] * x + m[5] * y + m[9] * z + m[13]) / w - stage.origin[1];
  const pz = (m[2] * x + m[6] * y + m[10] * z + m[14]) / w - stage.origin[2];
  const r = stage.right,
    u = stage.up;
  out[0] = px * r[0] + py * r[1] + pz * r[2];
  out[1] = px * u[0] + py * u[1] + pz * u[2];
  return w;
}

/**
 * How much a shadow is magnified at a point `h` metres in front of the stage,
 * with the lantern `lightD` metres in front of it: ((1-k)·D + k) / ((1-k)·(D-h) + k).
 * 1 for points on the stage or at k = 1.
 */
export function magnification(lightD: number, h: number, k: number): number {
  return ((1 - k) * lightD + k) / ((1 - k) * (lightD - h) + k);
}
