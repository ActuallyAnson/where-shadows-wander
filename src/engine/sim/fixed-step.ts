// Fixed-timestep accumulator. The display loop (owned by IWSDK) calls advance()
// once per frame; the simulation steps at a constant rate regardless of 72/90/120 Hz.
// Plain TypeScript: no IWSDK, no three.js.
//
// Determinism: the sim only ever sees `dt === step`, so step N's result depends on the inputs it
// read, never on how the display frames grouped the steps. Pausing is the caller's job (don't call
// advance while paused, as main.ts does); call reset() on resume so the first frame back doesn't
// carry a stale remainder.

/** Longest frame we simulate; anything longer (tab hidden, headset off) is dropped. */
const MAX_FRAME_S = 0.25;

export class FixedStepLoop {
  readonly step: number;
  /** Total simulation steps taken. */
  steps = 0;
  /** The interpolation factor the last advance() returned. */
  alpha = 0;
  /** Simulated seconds thrown away by the frame and step caps (a number for the profiler). */
  droppedS = 0;
  private acc = 0;

  /**
   * @param maxStepsPerFrame at most this many steps per advance(); the rest of the time is dropped
   *   rather than carried, so a slow frame can't snowball into a slower one. Default: no cap beyond
   *   the 0.25 s frame clamp (15 steps at 60 Hz).
   */
  constructor(
    hz: number,
    private readonly onStep: (dt: number) => void,
    readonly maxStepsPerFrame = Infinity,
  ) {
    if (!(hz > 0)) throw new RangeError(`hz must be positive, got ${hz}`);
    if (!(maxStepsPerFrame >= 1)) throw new RangeError(`maxStepsPerFrame must be at least 1, got ${maxStepsPerFrame}`);
    this.step = 1 / hz;
  }

  /**
   * Runs as many fixed steps as the elapsed time allows.
   * @returns interpolation factor in [0, 1) between the last two sim states, for rendering.
   */
  advance(frameDt: number): number {
    const dt = Math.max(frameDt, 0);
    if (dt > MAX_FRAME_S) this.droppedS += dt - MAX_FRAME_S;
    this.acc += Math.min(dt, MAX_FRAME_S);
    let taken = 0;
    while (this.acc >= this.step) {
      if (taken === this.maxStepsPerFrame) {
        // Keep the fractional remainder so alpha stays meaningful; drop whole steps.
        const whole = Math.floor(this.acc / this.step);
        this.droppedS += whole * this.step;
        this.acc -= whole * this.step;
        break;
      }
      this.onStep(this.step);
      this.acc -= this.step;
      this.steps++;
      taken++;
    }
    this.alpha = this.acc / this.step;
    return this.alpha;
  }

  /** Forgets the accumulated remainder and the counters, e.g. on resume or when a puzzle restarts. */
  reset(): void {
    this.acc = 0;
    this.alpha = 0;
    this.steps = 0;
    this.droppedS = 0;
  }
}
