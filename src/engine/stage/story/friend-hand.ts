// The friend's hand (docs/STORY.md, "How a memory starts"): a hand that is not the player's, held up between the candle and the
// wall so its shadow falls beside theirs, making the shape the player is to copy. It forms the shape from a resting hand, holds
// it, and now and then eases half out of it and back, as if showing it again; it breathes and sways a little all the while.
// This poses it as a HandFrame (a synthetic hand, synthetic-hand.ts) for a second shadow projector to cast. Plain TypeScript;
// a frame allocates nothing.
import { createHandFrame, JOINT_COUNT, type HandFrame, type Handedness } from '../../hands/hand';
import type { Shape } from '../../hands/shapes';
import { clonePose, lerpPose, PRESETS, writeHandPose } from '../../hands/synthetic-hand';

type V3 = Readonly<ArrayLike<number>>;

/** The wall, as the shadow projector's StagePlane has it (structurally). */
export interface WallFrame {
  readonly origin: V3;
  readonly right: V3;
  readonly up: V3;
  readonly normal: V3;
}

/** How far off the wall the hand is held, metres: near enough for a shadow a little bigger than a hand, a little soft. */
export const FRIEND_HAND_OFF_WALL_M = 0.42;
/** A child's hand. */
export const FRIEND_HAND_SCALE = 0.9;
/** Seconds to form the shape from a resting hand. */
export const FORM_S = 1.4;
/** After forming, the shape is shown again every CYCLE_S: held, eased half out over LOOSEN_S, and back over REFORM_S. */
export const CYCLE_S = 5.5;
const LOOSEN_S = 0.7;
const REFORM_S = 0.9;
/** How far it loosens towards the resting hand (0 not at all, 1 all the way). */
const LOOSEN = 0.45;
/** Breathing: the hand rises and falls this much (metres) every BREATH_S, and turns a little with it (radians). */
const BREATH_M = 0.004;
const BREATH_S = 3.6;
const SWAY_RAD = 0.035;

const smooth = (k: number) => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k));

/** How formed the shape is (0 the resting hand, 1 the shape) `t` seconds after the hand appeared. */
export function formAt(t: number): number {
  if (t < FORM_S) return smooth(t / FORM_S);
  const c = (t - FORM_S) % CYCLE_S;
  const hold = CYCLE_S - LOOSEN_S - REFORM_S;
  if (c < hold) return 1;
  if (c < hold + LOOSEN_S) return 1 - LOOSEN * smooth((c - hold) / LOOSEN_S);
  return 1 - LOOSEN + LOOSEN * smooth((c - hold - LOOSEN_S) / REFORM_S);
}

export class FriendHand {
  /** The friend's hand, and an untracked one for the other side: what the projector casts (its `update(hands, …)`). */
  readonly hands: Record<Handedness, HandFrame>;
  /** The posed hand (one of `hands`). */
  readonly frame: HandFrame;
  private readonly pose = clonePose(PRESETS.relaxed);
  /** The pose written about the origin, before it is placed on the wall. */
  private readonly local: HandFrame;
  private readonly zero: [number, number, number] = [0, 0, 0];

  constructor(readonly handedness: Handedness = 'left') {
    this.frame = createHandFrame(handedness);
    this.local = createHandFrame(handedness);
    const other = createHandFrame(handedness === 'left' ? 'right' : 'left');
    this.hands = handedness === 'left' ? { left: this.frame, right: other } : { left: other, right: this.frame };
  }

  /** Hides it: no shadow. */
  clear(): void {
    this.frame.tracked = false;
    this.frame.validJoints = 0;
  }

  /**
   * Poses the hand making `shape`, `t` seconds after it appeared, so that its shadow falls `x`, `y` metres (right, up) from the
   * wall's centre when cast from `light`. `tilt` leans the fingers off straight up (radians, counter-clockwise as seen).
   */
  update(shape: Shape, t: number, wall: WallFrame, light: V3, x: number, y: number, tilt = 0): HandFrame {
    lerpPose(PRESETS.relaxed, PRESETS[shape], formAt(t), this.pose);
    const lp = writeHandPose(this.pose, this.zero, this.local, FRIEND_HAND_SCALE).positions;
    // The hand's middle: its joints' mean, which is what lands on (x, y).
    let mx = 0,
      my = 0,
      mz = 0;
    for (let j = 0; j < JOINT_COUNT; j++) {
      mx += lp[j * 3];
      my += lp[j * 3 + 1];
      mz += lp[j * 3 + 2];
    }
    mx /= JOINT_COUNT;
    my /= JOINT_COUNT;
    mz /= JOINT_COUNT;

    const breath = Math.sin((2 * Math.PI * t) / BREATH_S);
    const a = tilt + SWAY_RAD * Math.sin((2 * Math.PI * t) / (BREATH_S * 1.7));
    const c = Math.cos(a),
      s = Math.sin(a);
    const r = wall.right,
      u = wall.up,
      n = wall.normal,
      o = wall.origin;
    // Where it is held: on the line from the wall point to the light, FRIEND_HAND_OFF_WALL_M off the wall, so its shadow lands
    // on the point whatever side the candle is on.
    const ty = y + BREATH_M * breath;
    const px = o[0] + r[0] * x + u[0] * ty,
      py = o[1] + r[1] * x + u[1] * ty,
      pz = o[2] + r[2] * x + u[2] * ty;
    const lightOff = (light[0] - px) * n[0] + (light[1] - py) * n[1] + (light[2] - pz) * n[2];
    const k = lightOff > FRIEND_HAND_OFF_WALL_M + 0.05 ? FRIEND_HAND_OFF_WALL_M / lightOff : 0;
    const hx = k ? px + (light[0] - px) * k : px + n[0] * FRIEND_HAND_OFF_WALL_M;
    const hy = k ? py + (light[1] - py) * k : py + n[1] * FRIEND_HAND_OFF_WALL_M;
    const hz = k ? pz + (light[2] - pz) * k : pz + n[2] * FRIEND_HAND_OFF_WALL_M;
    // The synthetic hand lies palm down with its fingers along -z: stand it up on the wall, fingers up (leaned by the tilt),
    // knuckles across, the back of the hand towards the player.
    const ax0 = r[0] * c + u[0] * s,
      ax1 = r[1] * c + u[1] * s,
      ax2 = r[2] * c + u[2] * s;
    const ay0 = u[0] * c - r[0] * s,
      ay1 = u[1] * c - r[1] * s,
      ay2 = u[2] * c - r[2] * s;
    const out = this.frame.positions;
    for (let j = 0; j < JOINT_COUNT; j++) {
      const dx = lp[j * 3] - mx,
        dy = lp[j * 3 + 1] - my,
        dz = mz - lp[j * 3 + 2];
      out[j * 3] = hx + ax0 * dx + n[0] * dy + ay0 * dz;
      out[j * 3 + 1] = hy + ax1 * dx + n[1] * dy + ay1 * dz;
      out[j * 3 + 2] = hz + ax2 * dx + n[2] * dy + ay2 * dz;
    }
    this.frame.radii.set(this.local.radii);
    this.frame.tracked = true;
    this.frame.validJoints = JOINT_COUNT;
    return this.frame;
  }
}
