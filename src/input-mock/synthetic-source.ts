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
  /** Thumb pulled onto the index tip (0..1), blending toward `pinchOn`. */
  pinch: number;
  pinchOn: boolean;
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

  /** Pinches the thumb onto the index tip (on) or lets go, on top of the current shape. */
  setPinch(hand: Handedness, on: boolean): void {
    this.hands[hand].pinchOn = on;
  }

  pinching(hand: Handedness): boolean {
    return this.hands[hand].pinchOn;
  }

  /** Moves a hand so its palm is just above `point` (e.g. over the lantern), palm down. */
  placeOver(hand: Handedness, point: Readonly<Vec3>): void {
    const w = this.hands[hand].wrist;
    // The palm centre sits about 6 cm along the fingers from the wrist; keep it 4 cm above the point.
    w[0] = point[0];
    w[1] = point[1] + 0.04;
    w[2] = point[2] + 0.06;
  }

  /** Puts a hand back where it rests. */
  home(hand: Handedness): void {
    const w = this.hands[hand].wrist;
    w[0] = MOCK_WRIST[hand][0];
    w[1] = MOCK_WRIST[hand][1];
    w[2] = MOCK_WRIST[hand][2];
  }

  update(t: number, left: HandFrame, right: HandFrame): void {
    const step = Math.max(t - this.t, 0) / BLEND_S;
    blendPinch(this.hands.left, step);
    blendPinch(this.hands.right, step);
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
    if (h.pinch > 0) {
      h.shown.thumb.pinch = Math.max(h.shown.thumb.pinch, h.pinch);
      h.shown.thumb.pinchTo = 'index';
    }
    writeHandPose(h.shown, h.wrist, out);
    if (this.jitter > 0) jitterHand(out, this.jitter, this.random);
  }
}

function blendPinch(h: HandState, step: number): void {
  h.pinch = h.pinchOn ? Math.min(h.pinch + step, 1) : Math.max(h.pinch - step, 0);
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
    pinch: 0,
    pinchOn: false,
  };
}
