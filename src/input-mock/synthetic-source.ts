// Interactive synthetic hands for mock mode: the keyboard picks a shape per
// hand (mock-controls.ts) and the hand blends into it over a short time.
import type { HandFrame, Handedness, Vec3 } from '../engine/hands/hand';
import {
  clonePose,
  copyPose,
  jitterHand,
  lerpPose,
  PRESETS,
  seededRandom,
  writeHandPose,
  type HandPose,
  type PresetName,
} from '../engine/hands/synthetic-hand';
import { clearHand, MOCK_WRIST, type HandSource } from './hand-source';

/** Seconds to blend from one shape to the next. */
export const BLEND_S = 0.15;

interface HandState {
  /** Shape being shown, or null to hide the hand (untracked). */
  target: PresetName | null;
  from: HandPose;
  current: HandPose;
  shown: HandPose;
  changedAt: number;
  wrist: Vec3;
  /** Added to the preset's wrist orientation, degrees. */
  rollDeg: number;
  yawDeg: number;
}

export class SyntheticSource implements HandSource {
  readonly name = 'synthetic';
  /** Joint noise in metres (0 = off). Real headsets jitter by a few millimetres. */
  jitter = 0;
  private readonly hands: Record<Handedness, HandState> = {
    left: state('relaxed', MOCK_WRIST.left),
    right: state('relaxed', MOCK_WRIST.right),
  };
  private readonly random = seededRandom(1);
  private t = 0;

  shapeOf(hand: Handedness): PresetName | null {
    return this.hands[hand].target;
  }

  setShape(hand: Handedness, shape: PresetName | null): void {
    const h = this.hands[hand];
    if (h.target === shape) return;
    copyPose(h.current, h.from);
    h.target = shape;
    h.changedAt = this.t;
  }

  /** Moves a hand's wrist by (dx, dy, dz) metres. */
  move(hand: Handedness, dx: number, dy: number, dz: number): void {
    const w = this.hands[hand].wrist;
    w[0] += dx;
    w[1] += dy;
    w[2] += dz;
  }

  /** Turns a hand by `rollDeg` about its fingers and `yawDeg` about the vertical. */
  turn(hand: Handedness, rollDeg: number, yawDeg: number): void {
    this.hands[hand].rollDeg += rollDeg;
    this.hands[hand].yawDeg += yawDeg;
  }

  update(t: number, left: HandFrame, right: HandFrame): void {
    this.t = t;
    this.write(this.hands.left, left);
    this.write(this.hands.right, right);
  }

  private write(h: HandState, out: HandFrame): void {
    if (h.target === null) return clearHand(out);
    const k = Math.min(Math.max((this.t - h.changedAt) / BLEND_S, 0), 1);
    lerpPose(h.from, PRESETS[h.target], k * k * (3 - 2 * k), h.current);
    copyPose(h.current, h.shown);
    h.shown.rollDeg += h.rollDeg;
    h.shown.yawDeg += h.yawDeg;
    writeHandPose(h.shown, h.wrist, out);
    if (this.jitter > 0) jitterHand(out, this.jitter, this.random);
  }
}

function state(target: PresetName, wrist: Readonly<Vec3>): HandState {
  return {
    target,
    from: clonePose(PRESETS[target]),
    current: clonePose(PRESETS[target]),
    shown: clonePose(PRESETS[target]),
    changedAt: -Infinity,
    wrist: [...wrist],
    rollDeg: 0,
    yawDeg: 0,
  };
}
