// Shape features computed from a HandFrame: the inputs the pose classifier
// (GDD, "Pose classifier") will use. Plain TypeScript: no IWSDK, no three.js.
// Thresholds here are first guesses for the webcam test page, not tuned values.
import { JOINT, type HandFrame } from './hand';

export const FINGER_NAMES = ['thumb', 'index', 'middle', 'ring', 'pinky'] as const;
export type FingerName = (typeof FINGER_NAMES)[number];

/** Joint chains from the base of each finger to its tip. */
const CHAINS: Record<FingerName, number[]> = {
  thumb: [1, 2, 3, 4],
  index: [5, 6, 7, 8, 9],
  middle: [10, 11, 12, 13, 14],
  ring: [15, 16, 17, 18, 19],
  pinky: [20, 21, 22, 23, 24],
};

/** Total bend (radians) treated as fully curled: about 210° for fingers, 90° for the thumb. */
const FULL_CURL = { finger: (210 * Math.PI) / 180, thumb: Math.PI / 2 };

export interface HandFeatures {
  /** 0 = straight, 1 = fully curled, per finger. */
  curl: Record<FingerName, number>;
  /** Mean curl of the four fingers (thumb excluded). */
  meanCurl: number;
  /** Thumb tip to index tip, millimetres. */
  pinchGapMm: number;
  /** Angle between the index and pinky directions, degrees. Small = fingers together. */
  spreadDeg: number;
}

export function handFeatures(hand: HandFrame): HandFeatures | null {
  if (!hand.tracked) return null;
  const p = hand.positions;
  const curl = {} as Record<FingerName, number>;
  for (const name of FINGER_NAMES) {
    const full = name === 'thumb' ? FULL_CURL.thumb : FULL_CURL.finger;
    curl[name] = Math.min(1, bend(p, CHAINS[name]) / full);
  }
  return {
    curl,
    meanCurl: (curl.index + curl.middle + curl.ring + curl.pinky) / 4,
    pinchGapMm: dist(p, JOINT['thumb-tip'], JOINT['index-finger-tip']) * 1000,
    spreadDeg: angleDeg(
      dir(p, JOINT['index-finger-phalanx-proximal'], JOINT['index-finger-phalanx-intermediate']),
      dir(p, JOINT['pinky-finger-phalanx-proximal'], JOINT['pinky-finger-phalanx-intermediate']),
    ),
  };
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

type V = [number, number, number];

function at(p: Float32Array, j: number): V {
  return [p[j * 3], p[j * 3 + 1], p[j * 3 + 2]];
}

function dir(p: Float32Array, a: number, b: number): V {
  const A = at(p, a),
    B = at(p, b);
  return [B[0] - A[0], B[1] - A[1], B[2] - A[2]];
}

function dist(p: Float32Array, a: number, b: number): number {
  const d = dir(p, a, b);
  return Math.hypot(d[0], d[1], d[2]);
}

function angle(a: V, b: V): number {
  const la = Math.hypot(...a),
    lb = Math.hypot(...b);
  if (la < 1e-9 || lb < 1e-9) return 0;
  const c = (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (la * lb);
  return Math.acos(Math.max(-1, Math.min(1, c)));
}

function angleDeg(a: V, b: V): number {
  return (angle(a, b) * 180) / Math.PI;
}

/** Sum of the angles between consecutive bones along a joint chain. */
function bend(p: Float32Array, chain: number[]): number {
  let total = 0;
  for (let i = 1; i < chain.length - 1; i++)
    total += angle(dir(p, chain[i - 1], chain[i]), dir(p, chain[i], chain[i + 1]));
  return total;
}
