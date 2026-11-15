// Lighting the candle at the start (docs/STORY.md, scene 1): the matchstick's flame held at the wick for a few seconds lights
// it. `near` says how close the match is from further out than that, so the wick can answer it (brighten, the match's flame
// leaning to it) before it is close enough to catch. Drifting off loses the progress slowly and only after a moment, so a
// shaky hand does not have to start again. Plain TypeScript; time comes in as `dt`.

/** Within this of the wick (m), the match's flame lights it. */
export const LIGHT_REACH_M = 0.15;
/** From this far (m), the wick starts to answer the match (`near` above 0). */
export const NEAR_REACH_M = 0.35;
/** Seconds the match is held at the wick to light it. */
export const LIGHT_HOLD_S = 3;
/** Seconds after the match leaves before the progress starts to go back. */
export const DRAIN_GRACE_S = 0.8;
/** How fast it goes back once it does, as a fraction of how fast it fills. */
export const DRAIN_RATE = 0.35;

export class IgnitionHold {
  /** 0 .. 1: how far it is to lit. */
  progress = 0;
  /** 0 (out of reach) .. 1 (close enough to catch): how near the match is to the wick. */
  near = 0;
  private away = 0;

  /**
   * One frame: `distance` is from the match's flame to the wick (m; Infinity when there is no match). Returns true on the
   * frame the candle catches (progress reaches 1).
   */
  update(dt: number, distance: number): boolean {
    const t = Math.min(1, Math.max(0, (NEAR_REACH_M - distance) / (NEAR_REACH_M - LIGHT_REACH_M)));
    this.near = t * t * (3 - 2 * t);
    if (distance < LIGHT_REACH_M) {
      this.away = 0;
      const was = this.progress;
      this.progress = Math.min(1, this.progress + dt / LIGHT_HOLD_S);
      return was < 1 && this.progress >= 1;
    }
    this.away += dt;
    if (this.away > DRAIN_GRACE_S) this.progress = Math.max(0, this.progress - (dt * DRAIN_RATE) / LIGHT_HOLD_S);
    return false;
  }

  reset(): void {
    this.progress = 0;
    this.near = 0;
    this.away = 0;
  }
}
