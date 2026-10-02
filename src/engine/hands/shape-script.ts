// A timed sequence of shapes to make, one hand at a time. It drives the guided
// recordings that label hand data (on a headset with ?record&script=shapes, in
// the Hand Lab and on the webcam bench) and the Hand Lab's scripted mock hands.
// Plain TypeScript: no IWSDK, no three.js.
import type { Handedness } from './hand';
import type { LabelShape, ShapeLabel } from './hand-recording';
import { SHAPES } from './shapes';
import type { PresetName } from './synthetic-hand';

export interface ScriptStep {
  hand: Handedness;
  /** Shape to make, or null to lower the hand (no label). */
  shape: PresetName | null;
  /** How long this step lasts before the next one starts. */
  seconds: number;
}

/**
 * Seconds left out of each label at both ends of a step, so the time a person
 * takes to read a prompt and change shape doesn't count as either shape.
 */
export const SETTLE_S = 0.5;

const HOLD_S = 3;
const REST_S = 2;
const LEAD_IN_S = 3;

/**
 * Every v1 shape on the right hand, then on the left: a relaxed lead-in, then
 * each shape held 3 s with 2 s relaxed between. 66 s in all, under the
 * recorder's 120 s cap. With the settle margin, each shape gets a 2 s label
 * and each rest a 1 s `none` label.
 */
export const SHAPES_SCRIPT: readonly ScriptStep[] = (['right', 'left'] as const).flatMap((hand) => [
  { hand, shape: 'relaxed' as const, seconds: LEAD_IN_S },
  ...SHAPES.flatMap((shape) => [
    { hand, shape, seconds: HOLD_S },
    { hand, shape: 'relaxed' as const, seconds: REST_S },
  ]),
]);

/** How to make each shape (GDD, "Shape vocabulary"), shown under the prompt. */
const HOW: Readonly<Record<PresetName, string>> = {
  relaxed: 'Let the hand rest',
  flat: 'Palm down, fingers together',
  fist: 'Closed hand',
  cup: 'Palm up, fingers curled',
  spread: 'Fingers spread wide',
  rabbit: 'Index and middle up, others pinched to the thumb',
  fox: 'Fingers together, thumb up as an ear',
};

/** The prompt at some time. `index` is -1 before the script starts and `steps.length` once it's done. */
export interface Prompt {
  index: number;
  /** Seconds left in this step. */
  remaining: number;
  text: string;
}

export function createPrompt(): Prompt {
  return { index: -1, remaining: 0, text: '' };
}

export class ShapeScript {
  /** When each step starts, seconds from the start of the script. */
  readonly starts: readonly number[];
  readonly duration: number;
  /** For each step, the previous step for the same hand (-1 if none), for blending between poses. */
  readonly prevForHand: readonly number[];
  /** The prompt text for each step, built once so showing a prompt allocates nothing. */
  readonly texts: readonly string[];
  readonly waitText: string;
  readonly doneText = 'Done. Thank you!';

  constructor(readonly steps: readonly ScriptStep[]) {
    if (steps.length === 0) throw new RangeError('A script needs at least one step');
    if (steps.some((s) => !(s.seconds > 0))) throw new RangeError('Every step needs a positive length');
    let t = 0;
    this.starts = steps.map((s) => ((t += s.seconds), t - s.seconds));
    this.duration = t;
    const last: Record<Handedness, number> = { left: -1, right: -1 };
    this.prevForHand = steps.map((s, i) => {
      const prev = last[s.hand];
      last[s.hand] = i;
      return prev;
    });
    this.texts = steps.map(promptText);
    this.waitText = `Raise your ${steps[0].hand} hand to start`;
  }

  /** The step running at `t`: -1 before the start, `steps.length` at or after the end. */
  stepAt(t: number): number {
    if (t < 0) return -1;
    if (t >= this.duration) return this.steps.length;
    let lo = 0,
      hi = this.steps.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (this.starts[mid] <= t) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  }

  /** The latest step for `hand` that has started by `t`, or -1. Holds the last one after the end. */
  lastStepFor(hand: Handedness, t: number): number {
    let i = Math.min(this.stepAt(t), this.steps.length - 1);
    while (i >= 0 && this.steps[i].hand !== hand) i--;
    return i;
  }

  /** Writes the prompt for time `t` into `out`. Allocates nothing. */
  promptAt(t: number, out: Prompt): Prompt {
    const i = this.stepAt(t);
    out.index = i;
    if (i < 0) {
      out.remaining = -t;
      out.text = this.waitText;
    } else if (i >= this.steps.length) {
      out.remaining = 0;
      out.text = this.doneText;
    } else {
      out.remaining = this.starts[i] + this.steps[i].seconds - t;
      out.text = this.texts[i];
    }
    return out;
  }

  /**
   * One label per step, covering its settled middle: relaxed steps are `none`,
   * hidden-hand steps and steps too short to settle get no label.
   */
  labels(settle = SETTLE_S): ShapeLabel[] {
    const out: ShapeLabel[] = [];
    this.steps.forEach((s, i) => {
      if (s.shape === null || s.seconds <= 2 * settle) return;
      const shape: LabelShape = s.shape === 'relaxed' ? 'none' : s.shape;
      out.push({ start: this.starts[i] + settle, end: this.starts[i] + s.seconds - settle, hand: s.hand, shape });
    });
    return out;
  }
}

function promptText(s: ScriptStep): string {
  const hand = s.hand === 'right' ? 'Right hand' : 'Left hand';
  if (s.shape === null) return `Lower your ${s.hand} hand`;
  if (s.shape === 'relaxed') return `${hand}: relax`;
  return `${hand}: ${s.shape.toUpperCase()}\n${HOW[s.shape]}`;
}
