// Fixed-timestep accumulator. The display loop (owned by IWSDK) calls advance()
// once per frame; the simulation steps at a constant rate regardless of 72/90/120 Hz.
// Plain TypeScript: no IWSDK, no three.js.

/** Longest frame we simulate; anything longer (tab hidden, headset off) is dropped. */
const MAX_FRAME_S = 0.25;

export class FixedStepLoop {
  readonly step: number;
  /** Total simulation steps taken. */
  steps = 0;
  private acc = 0;

  constructor(
    hz: number,
    private readonly onStep: (dt: number) => void,
  ) {
    if (!(hz > 0)) throw new RangeError(`hz must be positive, got ${hz}`);
    this.step = 1 / hz;
  }

  /**
   * Runs as many fixed steps as the elapsed time allows.
   * @returns interpolation factor in [0, 1) between the last two sim states, for rendering.
   */
  advance(frameDt: number): number {
    this.acc += Math.min(Math.max(frameDt, 0), MAX_FRAME_S);
    while (this.acc >= this.step) {
      this.onStep(this.step);
      this.acc -= this.step;
      this.steps++;
    }
    return this.acc / this.step;
  }
}
