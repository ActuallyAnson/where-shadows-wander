// Synthetic hands: builds a 25-joint HandFrame from a few numbers (curl and
// splay per finger, thumb placement, wrist orientation). Used by mock input
// (?mock=1) and by the classifier's unit tests, so shapes can be tested without
// a headset. Plain TypeScript: no IWSDK, no three.js.
//
// The hand is built as a right hand in a local frame, palm down:
//   +X across the knuckles (index toward pinky), +Y out of the back of the hand,
//   -Z along the fingers. The palm normal is -Y.
// A left hand is the mirror image (X negated), so presets work on either hand.
import { JOINT_COUNT, type HandFrame, type Vec3 } from './hand';
import type { Shape } from './shapes';

export const LONG_FINGERS = ['index', 'middle', 'ring', 'pinky'] as const;
export type LongFinger = (typeof LONG_FINGERS)[number];

export interface FingerPose {
  /** 0 = straight, 1 = fully curled (same scale as handFeatures' curl). */
  curl: number;
  /** Sideways angle at the knuckle, degrees. Positive turns toward the pinky side. */
  splayDeg: number;
}

export interface ThumbPose {
  /** 0 = straight, 1 = bent about 90° across the palm. */
  curl: number;
  /** Angle away from the index finger, in the palm plane, degrees. */
  abductDeg: number;
  /** Angle out of the palm plane toward the back of the hand, degrees. */
  liftDeg: number;
  /** 0..1: how far the thumb tip is pulled onto the `pinchTo` fingertip. */
  pinch: number;
  pinchTo: LongFinger;
}

export interface HandPose {
  /** Index, middle, ring, pinky. */
  fingers: [FingerPose, FingerPose, FingerPose, FingerPose];
  thumb: ThumbPose;
  /** Wrist orientation, applied as yaw · pitch · roll. Roll 180° turns the palm up. */
  rollDeg: number;
  pitchDeg: number;
  yawDeg: number;
}

export type PresetName = Shape | 'relaxed';

const f = (curl: number, splayDeg: number): FingerPose => ({ curl, splayDeg });
const thumb = (curl: number, abductDeg: number, liftDeg = 0, pinch = 0, pinchTo: LongFinger = 'index'): ThumbPose => ({
  curl,
  abductDeg,
  liftDeg,
  pinch,
  pinchTo,
});
const pose = (fingers: HandPose['fingers'], t: ThumbPose, rollDeg = 0): HandPose => ({
  fingers,
  thumb: t,
  rollDeg,
  pitchDeg: 0,
  yawDeg: 0,
});

/**
 * One pose per v1 shape (GDD, "Shape vocabulary"), plus a relaxed hand.
 * These are textbook versions for mock mode and tests, not tuned against real
 * hands; the classifier's ranges come from recordings.
 */
export const PRESETS: Readonly<Record<PresetName, Readonly<HandPose>>> = {
  relaxed: pose([f(0.2, -4), f(0.22, 0), f(0.25, 3), f(0.28, 6)], thumb(0.2, 30)),
  flat: pose([f(0.02, -2), f(0.02, 0), f(0.02, 2), f(0.02, 4)], thumb(0.05, 12)),
  fist: pose([f(0.95, 0), f(0.95, 0), f(0.95, 0), f(0.95, 0)], thumb(0.8, 20, -10)),
  cup: pose([f(0.4, -2), f(0.4, 0), f(0.4, 2), f(0.4, 4)], thumb(0.3, 25, 10), 180),
  spread: pose([f(0.03, -15), f(0.03, -3), f(0.03, 9), f(0.03, 22)], thumb(0.05, 60)),
  rabbit: pose([f(0.03, -8), f(0.03, 6), f(0.6, 2), f(0.6, -4)], thumb(0, 30, 0, 1, 'ring')),
  fox: pose([f(0.03, -2), f(0.03, 0), f(0.03, 2), f(0.03, 4)], thumb(0, 10, 75)),
};

export function clonePose(p: Readonly<HandPose>): HandPose {
  return {
    fingers: p.fingers.map((x) => ({ ...x })) as HandPose['fingers'],
    thumb: { ...p.thumb },
    rollDeg: p.rollDeg,
    pitchDeg: p.pitchDeg,
    yawDeg: p.yawDeg,
  };
}

/** Writes the pose between `a` (t = 0) and `b` (t = 1) into `out`. Allocates nothing. */
export function lerpPose(a: Readonly<HandPose>, b: Readonly<HandPose>, t: number, out: HandPose): HandPose {
  for (let i = 0; i < 4; i++) {
    out.fingers[i].curl = lerp(a.fingers[i].curl, b.fingers[i].curl, t);
    out.fingers[i].splayDeg = lerp(a.fingers[i].splayDeg, b.fingers[i].splayDeg, t);
  }
  out.thumb.curl = lerp(a.thumb.curl, b.thumb.curl, t);
  out.thumb.abductDeg = lerp(a.thumb.abductDeg, b.thumb.abductDeg, t);
  out.thumb.liftDeg = lerp(a.thumb.liftDeg, b.thumb.liftDeg, t);
  out.thumb.pinch = lerp(a.thumb.pinch, b.thumb.pinch, t);
  out.thumb.pinchTo = t < 0.5 ? a.thumb.pinchTo : b.thumb.pinchTo;
  out.rollDeg = lerp(a.rollDeg, b.rollDeg, t);
  out.pitchDeg = lerp(a.pitchDeg, b.pitchDeg, t);
  out.yawDeg = lerp(a.yawDeg, b.yawDeg, t);
  return out;
}

// Adult hand proportions in metres, right hand, local frame (see top of file).
// prettier-ignore
const METACARPAL: readonly number[] = [
  -0.012, 0, -0.025,   -0.002, 0, -0.027,   0.008, 0, -0.026,   0.016, 0, -0.024,
];
// prettier-ignore
const KNUCKLE: readonly number[] = [
  -0.024, 0, -0.088,   -0.004, 0, -0.092,   0.015, 0, -0.087,   0.031, 0, -0.078,
];
/** Proximal, intermediate, distal phalanx lengths per finger. */
// prettier-ignore
const PHALANX: readonly number[] = [
  0.040, 0.024, 0.020,   0.044, 0.028, 0.021,   0.041, 0.026, 0.020,   0.032, 0.019, 0.018,
];
/** Share of a finger's curl at each of its three joints. */
const CURL_SHARE = [0.4, 0.35, 0.25];
/** Full finger curl, matching FULL_CURL in hand-features.ts. */
const FULL_FINGER_CURL = (210 * Math.PI) / 180;
const FULL_THUMB_CURL = Math.PI / 2;
const THUMB_BASE = [-0.018, -0.008, -0.012];
/** Thumb metacarpal, proximal and distal bone lengths. */
const THUMB_BONES = [0.038, 0.032, 0.026];
/** Where the thumb's proximal, distal and tip joints sit along the pinch curve. */
const THUMB_PINCH_T = [0.42, 0.72, 1];
const RADIUS_TIP = 0.007;
const RADIUS_JOINT = 0.009;
const DEG = Math.PI / 180;

// Scratch buffers, reused so writing a pose allocates nothing.
const local = new Float64Array(JOINT_COUNT * 3);
const freeThumb = new Float64Array(12);
const rot = new Float64Array(9);
const v = new Float64Array(3);
const bend = new Float64Array(3);

/**
 * Writes `pose` into `out` as a fully tracked hand with its wrist at `wrist`
 * (scene space, metres). `scale` sizes the whole hand (1 = adult average).
 * Allocates nothing.
 */
export function writeHandPose(pose: Readonly<HandPose>, wrist: Readonly<Vec3>, out: HandFrame, scale = 1): HandFrame {
  local.fill(0);
  writeFingers(pose);
  writeThumb(pose.thumb);
  rotation(pose.rollDeg * DEG, pose.pitchDeg * DEG, pose.yawDeg * DEG);
  const mirror = out.handedness === 'left' ? -1 : 1;
  const p = out.positions;
  for (let j = 0; j < JOINT_COUNT; j++) {
    const x = local[j * 3] * scale,
      y = local[j * 3 + 1] * scale,
      z = local[j * 3 + 2] * scale;
    p[j * 3] = wrist[0] + mirror * (rot[0] * x + rot[1] * y + rot[2] * z);
    p[j * 3 + 1] = wrist[1] + rot[3] * x + rot[4] * y + rot[5] * z;
    p[j * 3 + 2] = wrist[2] + rot[6] * x + rot[7] * y + rot[8] * z;
    out.radii[j] = (isTip(j) ? RADIUS_TIP : RADIUS_JOINT) * scale;
  }
  out.tracked = true;
  out.validJoints = JOINT_COUNT;
  return out;
}

/** Adds noise of up to about `amountM` metres to every joint, from `random` (0..1). */
export function jitterHand(hand: HandFrame, amountM: number, random: () => number): void {
  if (!hand.tracked) return;
  // Sum of two uniforms: triangular noise centred on zero.
  for (let i = 0; i < hand.positions.length; i++) hand.positions[i] += (random() + random() - 1) * amountM;
}

/** Small seeded random generator (mulberry32), so jittered tests and replays repeat exactly. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function writeFingers(pose: Readonly<HandPose>): void {
  for (let fi = 0; fi < 4; fi++) {
    const base = (5 + fi * 5) * 3; // index-finger-metacarpal is joint 5
    for (let a = 0; a < 3; a++) {
      local[base + a] = METACARPAL[fi * 3 + a];
      local[base + 3 + a] = KNUCKLE[fi * 3 + a];
    }
    const { curl, splayDeg } = pose.fingers[fi];
    const yaw = splayDeg * DEG;
    let pitch = 0;
    let x = KNUCKLE[fi * 3],
      y = 0,
      z = KNUCKLE[fi * 3 + 2];
    for (let k = 0; k < 3; k++) {
      pitch += curl * FULL_FINGER_CURL * CURL_SHARE[k];
      const len = PHALANX[fi * 3 + k];
      // Curling bends toward the palm (-Y).
      x += Math.sin(yaw) * Math.cos(pitch) * len;
      y -= Math.sin(pitch) * len;
      z -= Math.cos(yaw) * Math.cos(pitch) * len;
      const j = base + (k + 2) * 3;
      local[j] = x;
      local[j + 1] = y;
      local[j + 2] = z;
    }
  }
}

function writeThumb(t: Readonly<ThumbPose>): void {
  // Free thumb: start direction from abduction (toward -X, the thumb side) and
  // lift (toward +Y), then bend across the palm at the proximal and distal joints.
  const ab = t.abductDeg * DEG,
    lift = t.liftDeg * DEG;
  v[0] = -Math.sin(ab) * Math.cos(lift);
  v[1] = Math.sin(lift);
  v[2] = -Math.cos(ab) * Math.cos(lift);
  let x = THUMB_BASE[0],
    y = THUMB_BASE[1],
    z = THUMB_BASE[2];
  freeThumb[0] = x;
  freeThumb[1] = y;
  freeThumb[2] = z;
  for (let k = 0; k < 3; k++) {
    if (k > 0) bendToward(v, 0.7071, -0.7071, 0, (t.curl * FULL_THUMB_CURL) / 2);
    x += v[0] * THUMB_BONES[k];
    y += v[1] * THUMB_BONES[k];
    z += v[2] * THUMB_BONES[k];
    freeThumb[(k + 1) * 3] = x;
    freeThumb[(k + 1) * 3 + 1] = y;
    freeThumb[(k + 1) * 3 + 2] = z;
  }

  // Pinched thumb: a curve from the thumb base to the target fingertip, bowed toward the palm.
  const tip = (5 + LONG_FINGERS.indexOf(t.pinchTo) * 5 + 4) * 3;
  const tx = local[tip] - 0.004,
    ty = local[tip + 1] - 0.006,
    tz = local[tip + 2];
  const cx = (THUMB_BASE[0] + tx) / 2 - 0.015,
    cy = (THUMB_BASE[1] + ty) / 2 - 0.02,
    cz = (THUMB_BASE[2] + tz) / 2;

  for (let k = 0; k < 4; k++) {
    const j = (1 + k) * 3; // thumb-metacarpal is joint 1
    if (k === 0) {
      local[j] = THUMB_BASE[0];
      local[j + 1] = THUMB_BASE[1];
      local[j + 2] = THUMB_BASE[2];
      continue;
    }
    const s = THUMB_PINCH_T[k - 1],
      u = 1 - s;
    const px = u * u * THUMB_BASE[0] + 2 * u * s * cx + s * s * tx;
    const py = u * u * THUMB_BASE[1] + 2 * u * s * cy + s * s * ty;
    const pz = u * u * THUMB_BASE[2] + 2 * u * s * cz + s * s * tz;
    local[j] = lerp(freeThumb[k * 3], px, t.pinch);
    local[j + 1] = lerp(freeThumb[k * 3 + 1], py, t.pinch);
    local[j + 2] = lerp(freeThumb[k * 3 + 2], pz, t.pinch);
  }
}

/** Rotates unit vector `d` by `angle` toward the direction (bx, by, bz). */
function bendToward(d: Float64Array, bx: number, by: number, bz: number, angle: number): void {
  const dot = d[0] * bx + d[1] * by + d[2] * bz;
  bend[0] = bx - dot * d[0];
  bend[1] = by - dot * d[1];
  bend[2] = bz - dot * d[2];
  const len = Math.hypot(bend[0], bend[1], bend[2]);
  if (len < 1e-9) return;
  const c = Math.cos(angle),
    s = Math.sin(angle) / len;
  for (let a = 0; a < 3; a++) d[a] = d[a] * c + bend[a] * s;
}

/** Fills `rot` (row-major 3x3) with Ry(yaw) · Rx(pitch) · Rz(roll). */
function rotation(roll: number, pitch: number, yaw: number): void {
  const cr = Math.cos(roll),
    sr = Math.sin(roll);
  const cp = Math.cos(pitch),
    sp = Math.sin(pitch);
  const cy = Math.cos(yaw),
    sy = Math.sin(yaw);
  rot[0] = cy * cr + sy * sp * sr;
  rot[1] = -cy * sr + sy * sp * cr;
  rot[2] = sy * cp;
  rot[3] = cp * sr;
  rot[4] = cp * cr;
  rot[5] = -sp;
  rot[6] = -sy * cr + cy * sp * sr;
  rot[7] = sy * sr + cy * sp * cr;
  rot[8] = cy * cp;
}

function isTip(j: number): boolean {
  return j === 4 || j === 9 || j === 14 || j === 19 || j === 24;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
