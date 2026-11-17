// Each v1 shape as ranges on a few hand features (GDD, "Pose classifier").
// Plain TypeScript: no IWSDK, no three.js.
//
// Every feature has a scale: one "tolerance unit" (e.g. 0.1 of curl, 5° of
// spread). A shape's margin is how many units the hand is inside its ranges,
// taking the tightest feature; it matches when the margin is >= 0. Widening
// moves every bound outward by whole units, which is how the tolerance
// setting (accessibility) and hysteresis (staying in a shape) work. Bounds are
// moved, not scaled about a centre, because most ranges are one-sided
// (`curl <= 0.15`) and scaling would also widen the wrong side.
//
// These ranges come from the synthetic presets (synthetic-hand.ts) and are a
// starting point: tune them against webcam and headset recordings (#12).
// With 3 mm of joint noise, straight hands read a mean curl up to about 0.17
// and a relaxed hand from about 0.23, hence 0.19 for the straight shapes.
import type { HandFeatures } from './hand-features';
import { SHAPES, type Shape } from './shapes';

/** Feature ids: indexes into a packed feature vector. */
export const F = {
  minCurl: 0,
  maxCurl: 1,
  curlIndex: 2,
  curlMiddle: 3,
  curlRing: 4,
  curlPinky: 5,
  spreadDeg: 6,
  palmStage: 7,
  thumbFwdDeg: 8,
  /** Thumb tip to index tip, in hand lengths. */
  tipGapIndex: 9,
  /** The nearer of the ring and pinky tips to the thumb tip, in hand lengths. */
  tipGapRingPinky: 10,
  /**
   * Mean curl of the four fingers. Tracking noise always reads as a little
   * bend, so the most-bent finger of a straight hand drifts up (to about 0.26
   * with 3 mm of noise, overlapping a relaxed hand); the mean drifts far less.
   */
  meanCurl: 11,
} as const;
export const FEATURE_COUNT = 12;

/** One tolerance unit per feature. */
// prettier-ignore
export const FEATURE_SCALE: readonly number[] = [
  0.1, 0.1, 0.1, 0.1, 0.1, 0.1, // curls
  5,                            // spread, degrees
  0.15,                         // palm normal · stage normal
  8,                            // thumb angle, degrees
  0.08, 0.08,                   // tip gaps, hand lengths
  0.1,                          // mean curl
];

/** Lower and upper bound per feature; ±Infinity = doesn't matter. */
export interface ShapeRanges {
  readonly lo: Float32Array;
  readonly hi: Float32Array;
}

function ranges(bounds: Partial<Record<keyof typeof F, [number, number]>>): ShapeRanges {
  const lo = new Float32Array(FEATURE_COUNT).fill(-Infinity);
  const hi = new Float32Array(FEATURE_COUNT).fill(Infinity);
  for (const [name, [l, h]] of Object.entries(bounds)) {
    lo[F[name as keyof typeof F]] = l;
    hi[F[name as keyof typeof F]] = h;
  }
  return { lo, hi };
}

const ANY = Infinity;

export const SHAPE_RANGES: Readonly<Record<Shape, ShapeRanges>> = {
  /** Palm down, fingers together, thumb alongside. */
  flat: ranges({
    meanCurl: [-ANY, 0.19],
    maxCurl: [-ANY, 0.35],
    spreadDeg: [-ANY, 18],
    palmStage: [-ANY, -0.5],
    thumbFwdDeg: [-ANY, 50],
  }),
  /** Closed hand, any orientation. */
  fist: ranges({ minCurl: [0.65, ANY] }),
  /** Palm up, fingers half curled. */
  cup: ranges({ minCurl: [0.15, ANY], maxCurl: [-ANY, 0.6], palmStage: [0.5, ANY] }),
  /** Fingers straight and wide. */
  spread: ranges({ meanCurl: [-ANY, 0.19], maxCurl: [-ANY, 0.35], spreadDeg: [25, ANY] }),
  /**
   * Two fingers up, a V: index and middle straight, ring and pinky curled. The thumb can be anywhere: a plain V is a
   * rabbit's ears, without the shadow-puppet rabbit's thumb pinched onto the ring finger, which is hard for a first shape.
   */
  rabbit: ranges({
    curlIndex: [-ANY, 0.25],
    curlMiddle: [-ANY, 0.25],
    curlRing: [0.4, ANY],
    curlPinky: [0.4, ANY],
  }),
  /**
   * Fingers straight and together, thumb up as an ear (away from the fingers),
   * the hand turned so the palm faces sideways. The palm bounds keep a palm-down
   * flat hand (whose thumb often sits 45° out) from reading as a fox.
   */
  fox: ranges({
    meanCurl: [-ANY, 0.19],
    maxCurl: [-ANY, 0.35],
    spreadDeg: [-ANY, 18],
    palmStage: [-0.7, 0.7],
    thumbFwdDeg: [38, ANY],
  }),
};

/** Writes the features the ranges use into `out` (length FEATURE_COUNT). */
export function packFeatures(f: HandFeatures, out: Float32Array): Float32Array {
  out[F.minCurl] = f.minCurl;
  out[F.maxCurl] = f.maxCurl;
  out[F.curlIndex] = f.curl.index;
  out[F.curlMiddle] = f.curl.middle;
  out[F.curlRing] = f.curl.ring;
  out[F.curlPinky] = f.curl.pinky;
  out[F.spreadDeg] = f.spreadDeg;
  out[F.palmStage] = f.palmStage;
  out[F.thumbFwdDeg] = f.thumbFwdDeg;
  out[F.tipGapIndex] = f.tipGap[0];
  out[F.tipGapRingPinky] = Math.min(f.tipGap[2], f.tipGap[3]);
  out[F.meanCurl] = f.meanCurl;
  return out;
}

/**
 * How far inside a shape's ranges `v` is, in tolerance units, with every
 * bound moved outward by `widen` units: the tightest feature decides. >= 0
 * matches. Not capped, so at high tolerance shapes still rank by how well
 * they match instead of tying.
 */
export function shapeMargin(v: Float32Array, r: ShapeRanges, widen = 0): number {
  let margin = Infinity;
  for (let i = 0; i < FEATURE_COUNT; i++) {
    const s = FEATURE_SCALE[i];
    if (r.lo[i] !== -Infinity) margin = Math.min(margin, (v[i] - r.lo[i]) / s + widen);
    if (r.hi[i] !== Infinity) margin = Math.min(margin, (r.hi[i] - v[i]) / s + widen);
  }
  return margin;
}

/** Every shape's margin, in SHAPES order, into `out` (length SHAPES.length). */
export function shapeMargins(v: Float32Array, widen: number, out: Float32Array): Float32Array {
  for (let i = 0; i < SHAPES.length; i++) out[i] = shapeMargin(v, SHAPE_RANGES[SHAPES[i]], widen);
  return out;
}

/**
 * The clear winner among `margins` (SHAPES order): the best matching shape,
 * if no other shape also matches within `gap` units of it. Otherwise -1: two
 * shapes about equally likely is a reason not to guess.
 */
export function clearWinner(margins: Float32Array, gap: number): number {
  let best = -1,
    second = -Infinity;
  for (let i = 0; i < margins.length; i++) {
    if (margins[i] < 0) continue;
    if (best < 0 || margins[i] > margins[best]) {
      if (best >= 0) second = margins[best];
      best = i;
    } else second = Math.max(second, margins[i]);
  }
  if (best < 0) return -1;
  return margins[best] - second >= gap ? best : -1;
}

const packed = new Float32Array(FEATURE_COUNT);
const margins = new Float32Array(SHAPES.length);

/** The shape a single frame looks like (no hold time, no hysteresis), or null. For tests and the UI. */
export function bestShape(f: HandFeatures, tolerance = 1, gap = 0.25): Shape | null {
  shapeMargins(packFeatures(f, packed), tolerance - 1, margins);
  const i = clearWinner(margins, gap);
  return i < 0 ? null : SHAPES[i];
}
