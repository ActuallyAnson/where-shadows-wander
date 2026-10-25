// Two small glows on the wall, as plain numbers. The solve bloom: a puzzle is solved, light swells in about a quarter of a
// second and drains away over a couple more. The near-miss glow: a hand that is almost making the wanted shape gets a soft
// light round its shadow, brighter the closer it is. Plain TypeScript, no allocation.

export const SOLVE_RISE_S = 0.25;
export const SOLVE_HOLD_S = 0.3;
export const SOLVE_FALL_S = 1.5;
export const SOLVE_TOTAL_S = SOLVE_RISE_S + SOLVE_HOLD_S + SOLVE_FALL_S;

const smooth = (x: number) => {
  const t = Math.min(Math.max(x, 0), 1);
  return t * t * (3 - 2 * t);
};

/** A one-shot swell: trigger() starts it, update() moves it, `value` is 0..1. */
export class SolveBloom {
  private t = -1;

  get active(): boolean {
    return this.t >= 0;
  }

  /** Seconds since it started (0 when it is not running). */
  get time(): number {
    return this.t < 0 ? 0 : this.t;
  }

  get value(): number {
    const t = this.t;
    if (t < 0) return 0;
    if (t < SOLVE_RISE_S) return smooth(t / SOLVE_RISE_S);
    if (t < SOLVE_RISE_S + SOLVE_HOLD_S) return 1;
    return 1 - smooth((t - SOLVE_RISE_S - SOLVE_HOLD_S) / SOLVE_FALL_S);
  }

  trigger(): void {
    this.t = 0;
  }

  update(dt: number): void {
    if (this.t < 0 || !(dt > 0)) return;
    this.t += Math.min(dt, 0.1);
    if (this.t >= SOLVE_TOTAL_S) this.t = -1;
  }
}

/** How far outside a shape's ranges still counts as "nearly" (the classifier's margin units; 0 is the edge). */
export const NEAR_RANGE = 0.8;

/** The glow wanted for a classifier margin: 0 when far off, rising to 1 at the shape's edge, and 1 inside it. */
export function nearMissLevel(margin: number): number {
  if (!(margin > -NEAR_RANGE)) return 0; // far off, or -Infinity (nothing tracked), or NaN
  if (margin >= 0) return 1;
  return smooth(1 + margin / NEAR_RANGE);
}

/** Follows a wanted level without flicker: quick to rise, slower to fall. */
export class Follower {
  value = 0;

  constructor(
    private readonly riseS = 0.12,
    private readonly fallS = 0.35,
  ) {}

  update(target: number, dt: number): number {
    if (!(dt > 0)) return this.value;
    const k = Math.min(1, dt / (target > this.value ? this.riseS : this.fallS));
    this.value += (target - this.value) * k;
    return this.value;
  }
}
