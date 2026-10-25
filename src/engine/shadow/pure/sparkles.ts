// Fairy sparkles: a small pool of motes that are born at a point (the fox's tail), drift down and about, twinkle and fade.
// Positions are stage coordinates (metres from the stage's centre). Plain TypeScript: fixed arrays, a seeded generator,
// no allocation per update.

export const SPARKLE_MAX = 56;

export interface SparkleOut {
  readonly x: Float32Array;
  readonly y: Float32Array;
  /** Half-size of each mote, metres (0 for an empty slot). */
  readonly size: Float32Array;
  /** 0..1 opacity, twinkling (0 for an empty slot). */
  readonly alpha: Float32Array;
}

export function createSparkleOut(): SparkleOut {
  return {
    x: new Float32Array(SPARKLE_MAX),
    y: new Float32Array(SPARKLE_MAX),
    size: new Float32Array(SPARKLE_MAX),
    alpha: new Float32Array(SPARKLE_MAX),
  };
}

export class Sparkles {
  private readonly px = new Float32Array(SPARKLE_MAX);
  private readonly py = new Float32Array(SPARKLE_MAX);
  private readonly vx = new Float32Array(SPARKLE_MAX);
  private readonly vy = new Float32Array(SPARKLE_MAX);
  private readonly age = new Float32Array(SPARKLE_MAX);
  /** Lifetime in seconds; 0 means the slot is empty. */
  private readonly life = new Float32Array(SPARKLE_MAX);
  private readonly size = new Float32Array(SPARKLE_MAX);
  private readonly phase = new Float32Array(SPARKLE_MAX);
  private readonly freq = new Float32Array(SPARKLE_MAX);
  private emit = 0;
  private cursor = 0;
  private s: number;

  constructor(seed = 1) {
    this.s = seed >>> 0 || 1;
  }

  /** A small seeded generator (0..1), so the same flight sparkles the same way. */
  private rand(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  get alive(): number {
    let n = 0;
    for (let i = 0; i < SPARKLE_MAX; i++) if (this.life[i] > 0) n++;
    return n;
  }

  clear(): void {
    this.life.fill(0);
    this.emit = 0;
  }

  /** `dt` seconds pass; `rate` motes a second are born within `spread` metres of (ex, ey). */
  update(dt: number, ex: number, ey: number, rate: number, spread = 0.015): void {
    if (!(dt > 0)) return;
    dt = Math.min(dt, 0.1);
    for (let i = 0; i < SPARKLE_MAX; i++) {
      if (this.life[i] <= 0) continue;
      this.age[i] += dt;
      if (this.age[i] >= this.life[i]) {
        this.life[i] = 0;
        continue;
      }
      // They sink slowly and wander a little sideways.
      this.vy[i] -= 0.03 * dt;
      this.vx[i] += (this.rand() - 0.5) * 0.12 * dt;
      this.px[i] += this.vx[i] * dt;
      this.py[i] += this.vy[i] * dt;
    }
    if (rate > 0) {
      this.emit += rate * dt;
      while (this.emit >= 1) {
        this.emit -= 1;
        this.spawn(ex, ey, spread);
      }
    }
  }

  /** `n` motes at once from (ex, ey), flying outward at up to `speed` metres a second: a burst of light. */
  burst(ex: number, ey: number, n: number, speed = 0.12): void {
    for (let i = 0; i < n; i++) {
      this.spawn(ex, ey, 0.01);
      const slot = (this.cursor + SPARKLE_MAX - 1) % SPARKLE_MAX;
      const a = this.rand() * Math.PI * 2;
      const v = speed * (0.3 + 0.7 * this.rand());
      this.vx[slot] = Math.cos(a) * v;
      this.vy[slot] = Math.sin(a) * v;
      this.life[slot] = 1.2 + this.rand() * 1.3;
    }
  }

  private spawn(ex: number, ey: number, spread: number): void {
    // Reuse the next empty slot, or the oldest one if the pool is full.
    let slot = -1;
    for (let k = 0; k < SPARKLE_MAX; k++) {
      const i = (this.cursor + k) % SPARKLE_MAX;
      if (this.life[i] <= 0) {
        slot = i;
        break;
      }
    }
    if (slot < 0) slot = this.cursor;
    this.cursor = (slot + 1) % SPARKLE_MAX;
    const a = this.rand() * Math.PI * 2;
    const r = Math.sqrt(this.rand()) * spread;
    this.px[slot] = ex + Math.cos(a) * r;
    this.py[slot] = ey + Math.sin(a) * r;
    this.vx[slot] = (this.rand() - 0.5) * 0.03;
    this.vy[slot] = (this.rand() - 0.3) * 0.03;
    this.age[slot] = 0;
    this.life[slot] = 0.9 + this.rand() * 1.1;
    this.size[slot] = 0.008 + this.rand() * this.rand() * 0.02;
    this.phase[slot] = this.rand() * Math.PI * 2;
    this.freq[slot] = 5 + this.rand() * 7;
  }

  /** Writes every slot into `out` (an empty slot has size 0 and alpha 0). Returns how many are alive. */
  fill(out: SparkleOut): number {
    let n = 0;
    for (let i = 0; i < SPARKLE_MAX; i++) {
      const life = this.life[i];
      if (life <= 0) {
        out.size[i] = 0;
        out.alpha[i] = 0;
        continue;
      }
      n++;
      const t = this.age[i] / life; // 0 new .. 1 gone
      const fade = Math.min(1, t * 6) * Math.pow(1 - t, 0.6); // quick in, slow out
      const twinkle = 0.65 + 0.35 * Math.sin(this.age[i] * this.freq[i] + this.phase[i]);
      out.x[i] = this.px[i];
      out.y[i] = this.py[i];
      out.size[i] = this.size[i] * (0.6 + 0.4 * fade);
      out.alpha[i] = Math.max(0, Math.min(1, fade * twinkle));
    }
    return n;
  }
}
