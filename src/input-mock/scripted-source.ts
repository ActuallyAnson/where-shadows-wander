// A scripted sequence of shapes for mock mode (the Hand Lab's Script source). The pose
// is a pure function of mock time, so the same script gives the same hands
// every run, whatever the frame rate. It runs on the same ShapeScript as
// guided recordings, so a guided recording of it gives labelled synthetic data.
import type { HandFrame, Handedness } from '../engine/hands/hand';
import { SHAPES_SCRIPT, ShapeScript, type ScriptStep } from '../engine/hands/shape-script';
import { clonePose, lerpPose, PRESETS, writeHandPose, type PresetName } from '../engine/hands/synthetic-hand';
import { clearHand, MOCK_WRIST, type HandSource } from './hand-source';
import { BLEND_S } from './synthetic-source';

export class ScriptedSource implements HandSource {
  readonly name = 'script';
  readonly script: ShapeScript;
  private readonly pose = clonePose(PRESETS.relaxed);
  private readonly shown: Record<Handedness, PresetName | null> = { left: null, right: null };

  /** Hands not mentioned in the script yet start `initial`. When `loop` is off, the last step holds. */
  constructor(
    steps: readonly ScriptStep[] = SHAPES_SCRIPT,
    private readonly loop = true,
    private readonly initial: Readonly<Record<Handedness, PresetName | null>> = { left: null, right: null },
  ) {
    this.script = new ShapeScript(steps);
  }

  get duration(): number {
    return this.script.duration;
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
    const cur = this.script.lastStepFor(hand, t);
    const prev = cur < 0 ? -1 : this.script.prevForHand[cur];
    const steps = this.script.steps;
    const to = cur < 0 ? this.initial[hand] : steps[cur].shape;
    const from = prev < 0 ? this.initial[hand] : steps[prev].shape;
    this.shown[hand] = to;
    if (to === null) return clearHand(out);
    const k = cur < 0 || from === null ? 1 : Math.min((t - this.script.starts[cur]) / BLEND_S, 1);
    lerpPose(PRESETS[from ?? to], PRESETS[to], k * k * (3 - 2 * k), this.pose);
    writeHandPose(this.pose, MOCK_WRIST[hand], out);
  }
}
