// A scripted sequence of shapes for mock mode (?mock=1&src=script). The pose
// is a pure function of mock time, so the same script gives the same hands
// every run, whatever the frame rate.
import type { HandFrame, Handedness } from '../engine/hands/hand';
import { SHAPES } from '../engine/hands/shapes';
import { clonePose, lerpPose, PRESETS, writeHandPose, type PresetName } from '../engine/hands/synthetic-hand';
import { clearHand, MOCK_WRIST, type HandSource } from './hand-source';
import { BLEND_S } from './synthetic-source';

export interface ScriptStep {
  hand: Handedness;
  /** Shape to make, or null to hide the hand. */
  shape: PresetName | null;
  /** How long this step lasts before the next one starts. */
  seconds: number;
}

/** Every v1 shape on the right hand, then on the left, 2 s each with a relaxed second between. */
export const SHAPES_SCRIPT: readonly ScriptStep[] = (['right', 'left'] as const).flatMap((hand) => [
  { hand, shape: 'relaxed' as const, seconds: 1 },
  ...SHAPES.flatMap((shape) => [
    { hand, shape, seconds: 2 },
    { hand, shape: 'relaxed' as const, seconds: 1 },
  ]),
]);

export class ScriptedSource implements HandSource {
  readonly name = 'script';
  readonly duration: number;
  private readonly starts: number[];
  private readonly pose = clonePose(PRESETS.relaxed);
  private readonly shown: Record<Handedness, PresetName | null> = { left: null, right: null };

  /** Hands not mentioned in the script yet start `initial`. When `loop` is off, the last step holds. */
  constructor(
    private readonly steps: readonly ScriptStep[] = SHAPES_SCRIPT,
    private readonly loop = true,
    private readonly initial: Readonly<Record<Handedness, PresetName | null>> = { left: null, right: null },
  ) {
    if (steps.length === 0) throw new RangeError('A script needs at least one step');
    let t = 0;
    this.starts = steps.map((s) => ((t += s.seconds), t - s.seconds));
    this.duration = t;
  }

  update(t: number, left: HandFrame, right: HandFrame): void {
    const local = this.loop ? t % this.duration : Math.min(t, this.duration);
    this.write('left', local, left);
    this.write('right', local, right);
  }

  shapeOf(hand: Handedness): PresetName | null {
    return this.shown[hand];
  }

  private write(hand: Handedness, t: number, out: HandFrame): void {
    // The latest step for this hand that has started, and the one before it.
    let cur = -1,
      prev = -1;
    for (let i = 0; i < this.steps.length && this.starts[i] <= t; i++) {
      if (this.steps[i].hand !== hand) continue;
      prev = cur;
      cur = i;
    }
    const to = cur < 0 ? this.initial[hand] : this.steps[cur].shape;
    const from = prev < 0 ? this.initial[hand] : this.steps[prev].shape;
    this.shown[hand] = to;
    if (to === null) return clearHand(out);
    const k = cur < 0 || from === null ? 1 : Math.min((t - this.starts[cur]) / BLEND_S, 1);
    lerpPose(PRESETS[from ?? to], PRESETS[to], k * k * (3 - 2 * k), this.pose);
    writeHandPose(this.pose, MOCK_WRIST[hand], out);
  }
}
