// One Euro filter (Casiez, Roussel and Vogel, CHI 2012) for a block of values,
// such as a hand's joint positions. It smooths hard when the input is still,
// which hides tracking jitter, and lightly when it moves fast, which keeps lag
// low. Plain TypeScript: no IWSDK, no three.js. No per-call allocations.

export interface OneEuroOptions {
  /** Cutoff when still, in Hz. Lower is steadier but laggier. */
  minCutoff: number;
  /** How much the cutoff rises with speed (per unit/s). Higher is less laggy when moving. */
  beta: number;
  /** Cutoff for the speed estimate, in Hz. */
  dCutoff: number;
}

/** Tuned for hand joints in metres from a ~24 fps webcam: keeps about 28 % of jitter at rest, about 1 cm behind a 0.5 m/s move. */
export const HAND_ONE_EURO: OneEuroOptions = { minCutoff: 0.5, beta: 10, dCutoff: 1 };

export class OneEuroFilter {
  readonly value: Float32Array;
  private readonly speed: Float32Array;
  private primed = false;

  constructor(
    size: number,
    private readonly options: OneEuroOptions = HAND_ONE_EURO,
  ) {
    this.value = new Float32Array(size);
    this.speed = new Float32Array(size);
  }

  /** Forget the history, e.g. after tracking was lost, so the next input is taken as is. */
  reset(): void {
    this.primed = false;
  }

  /** Filters `input` sampled `dt` seconds after the previous call; the result is in `value`. */
  filter(input: ArrayLike<number>, dt: number): Float32Array {
    const n = this.value.length;
    if (!this.primed || !(dt > 0)) {
      for (let i = 0; i < n; i++) {
        this.value[i] = input[i];
        this.speed[i] = 0;
      }
      this.primed = true;
      return this.value;
    }
    const { minCutoff, beta, dCutoff } = this.options;
    const aSpeed = alpha(dCutoff, dt);
    for (let i = 0; i < n; i++) {
      const rawSpeed = (input[i] - this.value[i]) / dt;
      this.speed[i] += aSpeed * (rawSpeed - this.speed[i]);
      const a = alpha(minCutoff + beta * Math.abs(this.speed[i]), dt);
      this.value[i] += a * (input[i] - this.value[i]);
    }
    return this.value;
  }
}

function alpha(cutoffHz: number, dt: number): number {
  const tau = 1 / (2 * Math.PI * cutoffHz);
  return 1 / (1 + tau / dt);
}
