// Shape features computed from a HandFrame: the inputs the pose classifier
// (GDD, "Pose classifier") uses. Plain TypeScript: no IWSDK, no three.js.
// computeHandFeatures fills a struct the caller owns, so it allocates nothing
// per frame. Distances that depend on hand size are divided by the hand's
// length, so children, adults and webcam scale errors read alike.
import { createPalm, derivePalm, JOINT, type HandFrame, type Palm, type Vec3 } from './hand';

export const FINGER_NAMES = ['thumb', 'index', 'middle', 'ring', 'pinky'] as const;
export type FingerName = (typeof FINGER_NAMES)[number];

/** Up in scene space: the stage normal for the tabletop theatre. */
export const WORLD_UP: Readonly<Vec3> = [0, 1, 0];

/** Joint chains from the base of each finger to its tip. */
const CHAINS: Readonly<Record<FingerName, readonly number[]>> = {
  thumb: [1, 2, 3, 4],
  index: [5, 6, 7, 8, 9],
  middle: [10, 11, 12, 13, 14],
  ring: [15, 16, 17, 18, 19],
  pinky: [20, 21, 22, 23, 24],
};
const TIPS = [
  JOINT['index-finger-tip'],
  JOINT['middle-finger-tip'],
  JOINT['ring-finger-tip'],
  JOINT['pinky-finger-tip'],
];
/** Proximal phalanx (knuckle to middle joint) of index, middle, ring, pinky: the direction each finger points. */
const PROXIMAL = [6, 11, 16, 21];

/** Total bend (radians) treated as fully curled: about 210° for fingers, 90° for the thumb. */
const FULL_CURL = { finger: (210 * Math.PI) / 180, thumb: Math.PI / 2 };
/** Below this length (metres) a finger direction projected onto the palm is too short to give an angle. */
const MIN_PROJECTED_M = 0.005;
const DEG = 180 / Math.PI;

export interface HandFeatures {
  /** 0 = straight, 1 = fully curled, per finger (thumb included). */
  curl: Record<FingerName, number>;
  /** Mean, smallest and largest curl of the four fingers (thumb excluded). */
  meanCurl: number;
  minCurl: number;
  maxCurl: number;
  /** Wrist to middle knuckle, metres: the hand's length, used to normalise gaps. Real for every source. */
  handSizeM: number;
  /** Thumb tip to index tip, millimetres. */
  pinchGapMm: number;
  /** Thumb tip to the index, middle, ring and pinky tips, divided by handSizeM. */
  readonly tipGap: Float32Array;
  /** Angle between the index and pinky directions in the palm plane, degrees. Small = fingers together. */
  spreadDeg: number;
  /** Angles between neighbouring fingers in the palm plane: index-middle, middle-ring, ring-pinky. */
  readonly pairSpreadDeg: Float32Array;
  readonly palm: Palm;
  /** Palm normal · stage normal: -1 = palm faces down onto a table, +1 = palm up. */
  palmStage: number;
  /** Palm normal · world up. */
  palmUp: number;
  /** Angle between the thumb (proximal joint to tip) and the palm's forward direction, degrees: about 15 flat, 75 fox. */
  thumbFwdDeg: number;
  /** How far the thumb rises out of the palm toward the back of the hand: unit thumb direction · -palm normal. */
  thumbElev: number;
}

export function createHandFeatures(): HandFeatures {
  return {
    curl: { thumb: 0, index: 0, middle: 0, ring: 0, pinky: 0 },
    meanCurl: 0,
    minCurl: 0,
    maxCurl: 0,
    handSizeM: 0,
    pinchGapMm: 0,
    tipGap: new Float32Array(4),
    spreadDeg: 0,
    pairSpreadDeg: new Float32Array(3),
    palm: createPalm(),
    palmStage: 0,
    palmUp: 0,
    thumbFwdDeg: 0,
    thumbElev: 0,
  };
}

// Scratch vectors, reused so computing features allocates nothing.
const a = new Float64Array(3);
const b = new Float64Array(3);
/** Each finger's direction projected onto the palm plane, and whether it was long enough to use. */
const projected = [new Float64Array(3), new Float64Array(3), new Float64Array(3), new Float64Array(3)];
const projectedOk = [false, false, false, false];

/**
 * Fills `out` from a fully tracked hand and returns it, or returns null when
 * any joint is missing (the classifier pauses rather than guessing).
 * @param stageNormal the stage's normal; up for the tabletop theatre.
 */
export function computeHandFeatures(
  hand: HandFrame,
  out: HandFeatures,
  stageNormal: Readonly<Vec3> = WORLD_UP,
): HandFeatures | null {
  if (!hand.tracked || hand.validJoints < 25) return null;
  const p = hand.positions;
  const palm = derivePalm(hand, out.palm);
  if (!palm) return null;

  let sum = 0,
    min = Infinity,
    max = -Infinity;
  for (let i = 0; i < FINGER_NAMES.length; i++) {
    const name = FINGER_NAMES[i];
    const full = name === 'thumb' ? FULL_CURL.thumb : FULL_CURL.finger;
    const c = Math.min(1, bend(p, CHAINS[name]) / full);
    out.curl[name] = c;
    if (name === 'thumb') continue;
    sum += c;
    min = Math.min(min, c);
    max = Math.max(max, c);
  }
  out.meanCurl = sum / 4;
  out.minCurl = min;
  out.maxCurl = max;

  const size = dist(p, JOINT.wrist, JOINT['middle-finger-phalanx-proximal']);
  out.handSizeM = size;
  const thumbTip = JOINT['thumb-tip'];
  out.pinchGapMm = dist(p, thumbTip, JOINT['index-finger-tip']) * 1000;
  for (let i = 0; i < 4; i++) out.tipGap[i] = size > 1e-6 ? dist(p, thumbTip, TIPS[i]) / size : 0;

  // Finger directions in the palm plane, so curling a finger doesn't read as spreading it.
  const n = palm.normal;
  for (let i = 0; i < 4; i++) {
    const v = projected[i];
    direction(p, PROXIMAL[i], PROXIMAL[i] + 1, v);
    const d = v[0] * n[0] + v[1] * n[1] + v[2] * n[2];
    for (let k = 0; k < 3; k++) v[k] -= d * n[k];
    projectedOk[i] = Math.hypot(v[0], v[1], v[2]) >= MIN_PROJECTED_M;
  }
  out.spreadDeg = projectedAngle(0, 3);
  for (let i = 0; i < 3; i++) out.pairSpreadDeg[i] = projectedAngle(i, i + 1);

  out.palmStage = n[0] * stageNormal[0] + n[1] * stageNormal[1] + n[2] * stageNormal[2];
  out.palmUp = n[1];

  direction(p, JOINT['thumb-phalanx-proximal'], thumbTip, a);
  const len = Math.hypot(a[0], a[1], a[2]);
  const f = palm.forward;
  if (len < 1e-6) {
    out.thumbFwdDeg = 0;
    out.thumbElev = 0;
  } else {
    const cos = (a[0] * f[0] + a[1] * f[1] + a[2] * f[2]) / len;
    out.thumbFwdDeg = Math.acos(Math.max(-1, Math.min(1, cos))) * DEG;
    out.thumbElev = -(a[0] * n[0] + a[1] * n[1] + a[2] * n[2]) / len;
  }
  return out;
}

/** Allocating convenience for the UI and tests; per-frame code should use computeHandFeatures. */
export function handFeatures(hand: HandFrame, stageNormal: Readonly<Vec3> = WORLD_UP): HandFeatures | null {
  return computeHandFeatures(hand, createHandFeatures(), stageNormal);
}

export type RoughShape = 'pinch' | 'fist' | 'flat (fingers together)' | 'open (fingers spread)' | 'in between';

/**
 * A rough label for the webcam test page only. The real classifier (week 3)
 * adds palm orientation, hold time and hysteresis.
 */
export function roughShape(f: HandFeatures): RoughShape {
  if (f.pinchGapMm < 25 && f.curl.index < 0.6) return 'pinch';
  if (f.meanCurl > 0.6) return 'fist';
  if (f.meanCurl < 0.25 && f.spreadDeg < 15) return 'flat (fingers together)';
  if (f.meanCurl < 0.25) return 'open (fingers spread)';
  return 'in between';
}

/** Writes the vector from joint `from` to joint `to` into `out`. */
function direction(p: Float32Array, from: number, to: number, out: Float64Array): void {
  for (let k = 0; k < 3; k++) out[k] = p[to * 3 + k] - p[from * 3 + k];
}

function dist(p: Float32Array, i: number, j: number): number {
  return Math.hypot(p[j * 3] - p[i * 3], p[j * 3 + 1] - p[i * 3 + 1], p[j * 3 + 2] - p[i * 3 + 2]);
}

/** Angle between two vectors, radians; 0 if either is (near) zero. */
function angle(u: Float64Array, v: Float64Array): number {
  const lu = Math.hypot(u[0], u[1], u[2]),
    lv = Math.hypot(v[0], v[1], v[2]);
  if (lu < 1e-9 || lv < 1e-9) return 0;
  const c = (u[0] * v[0] + u[1] * v[1] + u[2] * v[2]) / (lu * lv);
  return Math.acos(Math.max(-1, Math.min(1, c)));
}

function projectedAngle(i: number, j: number): number {
  return projectedOk[i] && projectedOk[j] ? angle(projected[i], projected[j]) * DEG : 0;
}

/** Sum of the angles between consecutive bones along a joint chain. */
function bend(p: Float32Array, chain: readonly number[]): number {
  let total = 0;
  for (let i = 1; i < chain.length - 1; i++) {
    direction(p, chain[i - 1], chain[i], a);
    direction(p, chain[i], chain[i + 1], b);
    total += angle(a, b);
  }
  return total;
}
