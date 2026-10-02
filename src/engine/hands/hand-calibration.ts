// Hand calibration: the player holds a hand flat for a couple of seconds and
// each finger's curl is recorded as its baseline, so curl is then measured from
// the player's own "straight". It removes a tracker's offset (a webcam reads
// straight fingers as about 0.3 curl) and helps players whose fingers don't
// fully straighten (GDD "Accessibility"). Plain TypeScript.
import type { Handedness } from './hand';
import { FINGER_NAMES, type HandFeatures } from './hand-features';

/** Seconds of a flat hand to collect. */
export const CALIBRATION_HOLD_S = 2;
/** No finger's baseline may exceed this: past it the hand wasn't flat, and fists would read as straight. */
export const MAX_CURL_BIAS = 0.5;

/** Each finger's baseline curl, FINGER_NAMES order (thumb first). Zeros = not calibrated. */
export type CurlBias = Float32Array;

export function createCurlBias(): CurlBias {
  return new Float32Array(FINGER_NAMES.length);
}

/** The median of each finger's curl over `samples` (FINGER_NAMES order each), capped at MAX_CURL_BIAS. */
export function biasFromSamples(samples: readonly ArrayLike<number>[], out: CurlBias = createCurlBias()): CurlBias {
  for (let i = 0; i < out.length; i++) {
    const v = samples.map((s) => s[i]).sort((a, b) => a - b);
    out[i] = v.length ? Math.min(v[v.length >> 1], MAX_CURL_BIAS) : 0;
  }
  return out;
}

export type CalibrationState = 'collecting' | 'done' | 'failed';

/** One calibration of one hand: feed it raw (uncalibrated) features each frame. */
export class CalibrationRun {
  state: CalibrationState = 'collecting';
  /** Why it failed, for the player. */
  reason = '';
  readonly bias = createCurlBias();
  private readonly samples: Float32Array[] = [];
  private heldS = 0;

  constructor(
    readonly hand: Handedness,
    readonly holdS = CALIBRATION_HOLD_S,
  ) {}

  /** 0..1 of the hold. */
  get progress(): number {
    return Math.min(this.heldS / this.holdS, 1);
  }

  /**
   * @param raw this frame's features without calibration, or null while the hand isn't tracked (the hold waits).
   * @returns the state after this frame
   */
  add(raw: HandFeatures | null, dt: number): CalibrationState {
    if (this.state !== 'collecting' || !raw) return this.state;
    const s = new Float32Array(FINGER_NAMES.length);
    for (let i = 0; i < FINGER_NAMES.length; i++) s[i] = raw.curl[FINGER_NAMES[i]];
    this.samples.push(s);
    this.heldS += Math.max(dt, 0);
    if (this.heldS < this.holdS) return this.state;
    biasFromSamples(this.samples, this.bias);
    // A fist or a loose hand isn't a baseline: refuse rather than calibrate shapes away.
    let sum = 0;
    for (let i = 1; i < FINGER_NAMES.length; i++) sum += this.bias[i];
    if (sum / 4 >= MAX_CURL_BIAS * 0.9) {
      this.state = 'failed';
      this.reason = 'The fingers were too bent: hold the hand flat, fingers straight and together.';
      this.bias.fill(0);
    } else this.state = 'done';
    return this.state;
  }
}
