// A fading ribbon behind something that moves: the last couple of seconds of its path, as a strip that is widest and most
// solid at the head and tapers to nothing at the tail. Positions are stage coordinates. Plain TypeScript, no allocation
// after construction: `update` records the path, `build` fills the caller's arrays with the strip's vertices.

export const TRAIL_SAMPLES = 40;
/** Seconds between recorded points; with TRAIL_SAMPLES this is the trail's length in time. */
export const TRAIL_STEP_S = 0.05;
/** Vertices of the strip: the head, then each recorded point, two a point (left and right). */
export const TRAIL_POINTS = TRAIL_SAMPLES + 1;
export const TRAIL_VERTS = TRAIL_POINTS * 2;

export interface TrailVerts {
  readonly x: Float32Array;
  readonly y: Float32Array;
  /** 0..1 opacity of each vertex. */
  readonly a: Float32Array;
}

export function createTrailVerts(): TrailVerts {
  return { x: new Float32Array(TRAIL_VERTS), y: new Float32Array(TRAIL_VERTS), a: new Float32Array(TRAIL_VERTS) };
}

export class Trail {
  private readonly xs = new Float32Array(TRAIL_SAMPLES);
  private readonly ys = new Float32Array(TRAIL_SAMPLES);
  /** Index the next point goes to; the newest is at head - 1. */
  private head = 0;
  private count = 0;
  private acc = 0;
  // Scratch for build: the path from the head back, so that no call builds an array.
  private readonly px = new Float32Array(TRAIL_POINTS);
  private readonly py = new Float32Array(TRAIL_POINTS);

  /** Forget the path (it was moved or shown again, so it must not streak across the stage). */
  clear(): void {
    this.count = 0;
    this.head = 0;
    this.acc = 0;
  }

  /** `dt` seconds passed and the thing is now at (x, y). */
  update(dt: number, x: number, y: number): void {
    if (!(dt > 0)) return;
    this.acc += dt;
    // A long step records one point, not a burst of identical ones.
    if (this.acc >= TRAIL_STEP_S) {
      this.acc %= TRAIL_STEP_S;
      this.xs[this.head] = x;
      this.ys[this.head] = y;
      this.head = (this.head + 1) % TRAIL_SAMPLES;
      if (this.count < TRAIL_SAMPLES) this.count++;
    }
  }

  /**
   * Fills `out` with the strip for a thing now at (hx, hy), `width` wide at the head. Returns how many vertices are used
   * (always an even number; 0 if there is nothing to draw yet).
   */
  build(hx: number, hy: number, width: number, out: TrailVerts): number {
    const n = this.count + 1;
    if (n < 2) return 0;
    this.px[0] = hx;
    this.py[0] = hy;
    for (let i = 1; i < n; i++) {
      const k = (this.head - i + TRAIL_SAMPLES * 2) % TRAIL_SAMPLES;
      this.px[i] = this.xs[k];
      this.py[i] = this.ys[k];
    }
    let nx = 0;
    let ny = 1;
    for (let i = 0; i < n; i++) {
      const a = Math.max(0, i - 1);
      const b = Math.min(n - 1, i + 1);
      const dx = this.px[a] - this.px[b];
      const dy = this.py[a] - this.py[b];
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > 1e-6) {
        nx = -dy / len;
        ny = dx / len;
      } // else keep the last direction
      const t = i / (n - 1);
      const w = (width / 2) * Math.pow(1 - t, 0.8);
      const alpha = Math.pow(1 - t, 1.6);
      out.x[i * 2] = this.px[i] + nx * w;
      out.y[i * 2] = this.py[i] + ny * w;
      out.x[i * 2 + 1] = this.px[i] - nx * w;
      out.y[i * 2 + 1] = this.py[i] - ny * w;
      out.a[i * 2] = alpha;
      out.a[i * 2 + 1] = alpha;
    }
    return n * 2;
  }
}
