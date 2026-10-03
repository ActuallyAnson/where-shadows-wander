// Hand data shared by every hand source (headset, webcam, recordings), which
// fill it, and the classifier and gameplay, which read it. Plain TypeScript: no IWSDK, no three.js.
//
// WebXR Hand Input exposes 25 joints per hand. OpenXR's 26th joint, "palm", is
// not exposed by any browser, so the palm is derived (see derivePalm).

export type Handedness = 'left' | 'right';

// prettier-ignore
export const JOINT_NAMES = [
  'wrist',
  'thumb-metacarpal', 'thumb-phalanx-proximal', 'thumb-phalanx-distal', 'thumb-tip',
  'index-finger-metacarpal', 'index-finger-phalanx-proximal', 'index-finger-phalanx-intermediate', 'index-finger-phalanx-distal', 'index-finger-tip',
  'middle-finger-metacarpal', 'middle-finger-phalanx-proximal', 'middle-finger-phalanx-intermediate', 'middle-finger-phalanx-distal', 'middle-finger-tip',
  'ring-finger-metacarpal', 'ring-finger-phalanx-proximal', 'ring-finger-phalanx-intermediate', 'ring-finger-phalanx-distal', 'ring-finger-tip',
  'pinky-finger-metacarpal', 'pinky-finger-phalanx-proximal', 'pinky-finger-phalanx-intermediate', 'pinky-finger-phalanx-distal', 'pinky-finger-tip',
] as const;

export type JointName = (typeof JOINT_NAMES)[number];

export const JOINT_COUNT = 25;

/** Joint index by name, e.g. JOINT.wrist === 0. */
export const JOINT = Object.fromEntries(JOINT_NAMES.map((n, i) => [n, i])) as Record<JointName, number>;

/** Parent joint index for each joint (-1 for the wrist). */
// prettier-ignore
export const JOINT_PARENT: readonly number[] = [
  -1,
  0, 1, 2, 3,
  0, 5, 6, 7, 8,
  0, 10, 11, 12, 13,
  0, 15, 16, 17, 18,
  0, 20, 21, 22, 23,
];

/** One hand for one display frame, in scene (world) space, metres. */
export interface HandFrame {
  readonly handedness: Handedness;
  /** True only when all 25 joints have a pose this frame. */
  tracked: boolean;
  /** Joints with a pose this frame (0..25). Below 25, recognition should pause. */
  validJoints: number;
  /** Joint positions, xyz per joint (length 75). */
  readonly positions: Float32Array;
  /** Joint radii in metres (length 25). */
  readonly radii: Float32Array;
}

export function createHandFrame(handedness: Handedness): HandFrame {
  return {
    handedness,
    tracked: false,
    validJoints: 0,
    positions: new Float32Array(JOINT_COUNT * 3),
    radii: new Float32Array(JOINT_COUNT),
  };
}

export type Vec3 = [number, number, number];

/** Derived palm pose. All vectors are unit length. */
export interface Palm {
  position: Vec3;
  /** Out of the palm (the side a cupped hand holds things in). */
  normal: Vec3;
  /** From the wrist toward the middle-finger knuckle. */
  forward: Vec3;
  /** Across the knuckles, from the index side toward the pinky side. */
  across: Vec3;
}

export function createPalm(): Palm {
  return { position: [0, 0, 0], normal: [0, 0, 0], forward: [0, 0, 0], across: [0, 0, 0] };
}

/**
 * Derives the palm pose from joint positions only (no joint orientations).
 * - position: midpoint of the middle-finger metacarpal and proximal joints,
 *   close to where OpenXR places its palm joint.
 * - forward: wrist to middle-finger proximal joint (the knuckle).
 * - across: index knuckle to pinky knuckle, made perpendicular to forward.
 * - normal: forward x across for a right hand, across x forward for a left hand,
 *   so it always points out of the palm.
 * Writes into `out` and returns it. Returns null if the hand isn't fully tracked.
 */
export function derivePalm(hand: HandFrame, out: Palm = createPalm()): Palm | null {
  if (!hand.tracked) return null;
  const p = hand.positions;
  const wrist = JOINT.wrist * 3;
  const midMeta = JOINT['middle-finger-metacarpal'] * 3;
  const midProx = JOINT['middle-finger-phalanx-proximal'] * 3;
  const idxProx = JOINT['index-finger-phalanx-proximal'] * 3;
  const pnkProx = JOINT['pinky-finger-phalanx-proximal'] * 3;

  for (let i = 0; i < 3; i++) {
    out.position[i] = (p[midMeta + i] + p[midProx + i]) / 2;
    out.forward[i] = p[midProx + i] - p[wrist + i];
    out.across[i] = p[pnkProx + i] - p[idxProx + i];
  }
  if (!normalize(out.forward)) return null;
  // Gram-Schmidt: remove the forward component from across.
  const d = dot(out.across, out.forward);
  for (let i = 0; i < 3; i++) out.across[i] -= d * out.forward[i];
  if (!normalize(out.across)) return null;
  if (hand.handedness === 'right') cross(out.forward, out.across, out.normal);
  else cross(out.across, out.forward, out.normal);
  normalize(out.normal);
  return out;
}

function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross(a: Vec3, b: Vec3, out: Vec3): void {
  const x = a[1] * b[2] - a[2] * b[1];
  const y = a[2] * b[0] - a[0] * b[2];
  const z = a[0] * b[1] - a[1] * b[0];
  out[0] = x;
  out[1] = y;
  out[2] = z;
}

function normalize(v: Vec3): boolean {
  const len = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
  if (len < 1e-6) return false;
  v[0] /= len;
  v[1] /= len;
  v[2] /= len;
  return true;
}
