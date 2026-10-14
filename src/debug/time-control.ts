// Slow motion, pause and single-stepping for the simulation, from the outside: it wraps the call to
// `FixedStepLoop.advance` and never touches the loop itself (Teammate A's), so the simulation still only ever sees
// `dt === step` and stays deterministic. Plain TypeScript, no allocation.

export const SPEEDS: readonly number[] = [1, 0.5, 0.25, 0.1];
/** The most steps one frame can be asked for, so a held key cannot queue a long burst. */
const MAX_QUEUED_STEPS = 8;

/** The part of FixedStepLoop this uses. */
export interface Steppable {
  readonly step: number;
  alpha: number;
  advance(frameDt: number): number;
}

export class TimeControl {
  paused = false;
  private speedIndex = 0;
  private queued = 0;

  get speed(): number {
    return SPEEDS[this.speedIndex];
  }

  /** Text for a HUD or a button: "1x", "1/2x", "1/4x", "1/10x". */
  get speedLabel(): string {
    const s = this.speed;
    return s === 1 ? '1x' : `1/${Math.round(1 / s)}x`;
  }

  togglePause(): void {
    this.paused = !this.paused;
    this.queued = 0;
  }

  /** Runs exactly one fixed step on the next frame (and pauses, if it was running). */
  stepOnce(): void {
    this.paused = true;
    this.queued = Math.min(this.queued + 1, MAX_QUEUED_STEPS);
  }

  slower(): void {
    this.speedIndex = Math.min(this.speedIndex + 1, SPEEDS.length - 1);
  }

  faster(): void {
    this.speedIndex = Math.max(this.speedIndex - 1, 0);
  }

  /** Round and round through the speeds (a single button). */
  cycleSpeed(): void {
    this.speedIndex = (this.speedIndex + 1) % SPEEDS.length;
  }

  /** Normal speed, running. */
  reset(): void {
    this.paused = false;
    this.speedIndex = 0;
    this.queued = 0;
  }

  /**
   * Use in place of `loop.advance(frameDt)`. Running: advances by the scaled frame time. Paused: advances nothing, except
   * one whole step for each queued `stepOnce`. Returns the interpolation factor, as `advance` does.
   */
  advance(loop: Steppable, frameDt: number): number {
    if (!this.paused) return loop.advance(frameDt * SPEEDS[this.speedIndex]);
    // Each call after the loop's remainder (always under one step) adds exactly one step.
    for (let n = this.queued; n > 0; n--) loop.advance(loop.step);
    this.queued = 0;
    return loop.alpha;
  }
}
