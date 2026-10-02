// A hand's shadow on the stage, in 2D stage space: what the collision solver
// (Teammate A) collides with, and what the shadow renderer draws. Filled every
// frame by the shadow projector (src/engine/shadow/pure). Plain data, no
// allocation per frame. Lives here so pure simulation code can import it.
import type { Handedness } from './hand';
import { JOINT_COUNT } from './hand';

/** 24 bones (each joint to its parent) plus 4 webs across the palm, so a flat palm has no gaps. */
export const CAPSULES_PER_HAND = 28;
/** Floats per capsule: ax, ay, bx, by, radius (stage metres). */
export const CAPSULE_STRIDE = 5;
/** The outline is the convex hull of the projected joints: at most one point per joint. */
export const OUTLINE_MAX = JOINT_COUNT;

export interface HandShadow {
  readonly hand: Handedness;
  /** The hand is fully tracked and its shadow was projected this frame. If false, ignore the rest. */
  active: boolean;
  /** The shadow's bounds overlap the stage rectangle. Capsules are not clipped to the stage. */
  onStage: boolean;
  /** Each joint's centre in stage space: x, y per joint. */
  readonly joints: Float32Array;
  /** CAPSULES_PER_HAND capsules: ax, ay, bx, by, radius. */
  readonly capsules: Float32Array;
  /** Edge blur per capsule, metres: grows with the hand's distance from the stage (for the renderer). */
  readonly blur: Float32Array;
  /** Convex hull of the joints, counter-clockwise, x, y pairs; `outlineCount` points are valid. For visuals and tests. */
  readonly outline: Float32Array;
  outlineCount: number;
  /** minX, minY, maxX, maxY of the capsules, radii included. */
  readonly bounds: Float32Array;
  /** Mean distance of the joints from the stage plane, metres. */
  distanceM: number;
}

export function createHandShadow(hand: Handedness): HandShadow {
  return {
    hand,
    active: false,
    onStage: false,
    joints: new Float32Array(JOINT_COUNT * 2),
    capsules: new Float32Array(CAPSULES_PER_HAND * CAPSULE_STRIDE),
    blur: new Float32Array(CAPSULES_PER_HAND),
    outline: new Float32Array(OUTLINE_MAX * 2),
    outlineCount: 0,
    bounds: new Float32Array(4),
    distanceM: 0,
  };
}
