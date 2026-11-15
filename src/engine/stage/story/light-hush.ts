// The room's candle light hushed by a memory (docs/STORY.md, scene 2, "The hush"): when the girl claps her hand over the torch in
// the fort, the real candle dims with it, and comes back as she lifts her hand. A `hush` cue (puppet-scene.ts) sets where the
// light eases to and how fast; main.ts multiplies the candle's light on the room by `level`. Pure: no three, no clock.

export class LightHush {
  private current = 1;
  private target = 1;
  /** Change per second towards the target. */
  private rate = 0;

  /** How much of the candle's light reaches the room now (1 all of it). */
  get level(): number {
    return this.current;
  }

  /** Eases to `level` (0..1) over `seconds` (0: at once). */
  to(level: number, seconds: number): void {
    const l = level >= 1 ? 1 : level > 0 ? level : 0; // NaN becomes 0
    this.target = l;
    if (!(seconds > 0)) {
      this.current = l;
      this.rate = 0;
      return;
    }
    this.rate = Math.abs(l - this.current) / seconds;
  }

  /** Back to the candle's own light at once (a memory skipped, the story stopped). */
  reset(): void {
    this.current = this.target = 1;
    this.rate = 0;
  }

  /** Moves on by `dt` seconds. Allocates nothing. */
  update(dt: number): void {
    if (this.current === this.target || !(dt > 0)) return;
    const step = this.rate * dt;
    if (this.current < this.target) this.current = Math.min(this.target, this.current + step);
    else this.current = Math.max(this.target, this.current - step);
  }
}
