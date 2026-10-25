// A rabbit's hop across the wall, as plain numbers: it appears at a point (where a hand made the rabbit shape), hops away a
// few times, and fades. Visual only (the rabbit is no helper in the game). Positions are stage coordinates, metres.
// Plain TypeScript, no allocation per update.

export type HopFrame = 0 | 1 | 2; // crouch, stretched in the air, landing

const HOP_S = 0.5;
const REST_S = 0.28;
const HOP_HEIGHT_M = 0.075;
const HOP_LENGTH_M = 0.13;
export const HOPPER_LIFE_S = 4.6;
const FADE_S = 1.1;

export class Hopper {
  x = 0;
  y = 0;
  /** 1 facing right, -1 left. */
  facing: 1 | -1 = 1;
  private t = -1;
  private baseY = 0;
  private hopFrom = 0;
  private phase = 0;

  get active(): boolean {
    return this.t >= 0;
  }

  /** Seconds since it appeared (0 when not active). */
  get age(): number {
    return this.t < 0 ? 0 : this.t;
  }

  /** 1 while it hops, fading to 0 over the last second. */
  get alpha(): number {
    if (this.t < 0) return 0;
    const left = HOPPER_LIFE_S - this.t;
    return left >= FADE_S ? Math.min(1, this.t / 0.15) : Math.max(0, left / FADE_S);
  }

  get frame(): HopFrame {
    if (this.t < 0) return 0;
    if (this.phase < 0) return 0; // resting between hops: crouched
    const k = this.phase / HOP_S;
    return k < 0.15 ? 0 : k > 0.85 ? 2 : 1;
  }

  /** Starts a rabbit at (x, y), facing away from `awayFromX` (it hops the way it was pushed). */
  spawn(x: number, y: number, facing: 1 | -1): void {
    this.x = x;
    this.y = y;
    this.baseY = y;
    this.hopFrom = x;
    this.facing = facing;
    this.t = 0;
    this.phase = -REST_S * 0.4; // a short crouch before the first hop
  }

  stop(): void {
    this.t = -1;
  }

  /** `halfW` is the stage's half-width, so the rabbit turns round at the edge. */
  update(dt: number, halfW: number): void {
    if (this.t < 0 || !(dt > 0)) return;
    dt = Math.min(dt, 0.1);
    this.t += dt;
    if (this.t >= HOPPER_LIFE_S) {
      this.t = -1;
      return;
    }
    this.phase += dt;
    if (this.phase < 0) return; // resting
    if (this.phase >= HOP_S) {
      this.phase = -REST_S;
      this.hopFrom += this.facing * HOP_LENGTH_M;
      this.x = this.hopFrom;
      this.y = this.baseY;
      if (Math.abs(this.x) > halfW * 0.85) this.facing = this.facing === 1 ? -1 : 1;
      return;
    }
    const k = this.phase / HOP_S;
    this.x = this.hopFrom + this.facing * HOP_LENGTH_M * k;
    this.y = this.baseY + HOP_HEIGHT_M * 4 * k * (1 - k);
  }
}
