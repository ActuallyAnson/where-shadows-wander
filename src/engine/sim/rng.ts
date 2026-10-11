// Seeded random numbers for the simulation (mulberry32). The sim must never call Math.random():
// with the same seed and the same inputs, a replay or a test reproduces a run exactly.
// One 32-bit integer of state, so a snapshot or save is a single number. Plain TypeScript.
//
// The state lives in a Uint32Array rather than a number field: an unsigned 32-bit value doesn't
// fit a small integer, so a plain field would box a fresh heap number on every call.

export class Rng {
  private readonly s = new Uint32Array(1);

  constructor(seed = 1) {
    this.s[0] = seed >>> 0;
  }

  /** The whole generator state; set it back to resume the sequence exactly. */
  get state(): number {
    return this.s[0];
  }

  set state(value: number) {
    this.s[0] = value >>> 0;
  }

  /** A float in [0, 1). */
  next(): number {
    this.s[0] += 0x6d2b79f5;
    const s = this.s[0];
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** A float in [min, max). */
  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  /** An integer in [0, n). */
  int(n: number): number {
    return Math.floor(this.next() * n);
  }
}
