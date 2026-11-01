// A rope: a chain of points joined by fixed-length links, pinned at both ends, moved by Verlet integration (each point's next place
// comes from where it is and where it was, so there is no velocity to store and nothing can blow up from a stiff spring) and then
// pulled back to the right link lengths a few times (relaxation). Gravity makes it sag, wind blows it, an impulse sets it swinging.
// It is the simulation under the room's bunting. Built from scratch in typed arrays (no physics library, as the rest of the game's
// physics), it steps on a fixed small time step whatever the frame time, and allocates nothing after construction.

const SUBSTEP_S = 1 / 120;
const MAX_SUBSTEPS = 6;

export class VerletChain {
  /** The points' places now, metres (x across, y up). */
  readonly x: Float32Array;
  readonly y: Float32Array;
  private readonly px: Float32Array;
  private readonly py: Float32Array;
  private readonly rest: number;
  private leftover = 0;
  /** Seconds of simulated time so far (for the wind's gusts). */
  time = 0;

  /**
   * @param n points (at least 3)
   * @param restLength each link's length: a little more than the pinned ends' distance makes the rope sag
   */
  constructor(
    readonly n: number,
    private readonly ax: number,
    private readonly ay: number,
    private readonly bx: number,
    private readonly by: number,
    totalLength: number,
  ) {
    if (n < 3) throw new Error('a rope needs at least 3 points');
    this.x = new Float32Array(n);
    this.y = new Float32Array(n);
    this.px = new Float32Array(n);
    this.py = new Float32Array(n);
    this.rest = totalLength / (n - 1);
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      this.x[i] = this.px[i] = ax + (bx - ax) * t;
      this.y[i] = this.py[i] = ay + (by - ay) * t;
    }
  }

  /** Advances by `dt` seconds (taken in small fixed steps, at most a few per call so a long frame cannot run away). */
  advance(dt: number, gravity: number, windX: number, damping = 0.992): void {
    if (!(dt > 0)) return;
    this.leftover += Math.min(dt, MAX_SUBSTEPS * SUBSTEP_S);
    while (this.leftover >= SUBSTEP_S) {
      this.leftover -= SUBSTEP_S;
      this.substep(SUBSTEP_S, gravity, windX, damping);
    }
  }

  /** Pushes every point within `radius` of (cx, cy) away from it, harder the nearer it is (a spark flying by, a hand). */
  impulse(cx: number, cy: number, radius: number, strength: number): void {
    for (let i = 1; i < this.n - 1; i++) {
      const dx = this.x[i] - cx;
      const dy = this.y[i] - cy;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d >= radius) continue;
      const k = (strength * (1 - d / radius)) / (d + 0.05);
      // Moving the previous place the other way is the same as giving the point a velocity.
      this.px[i] -= dx * k;
      this.py[i] -= dy * k;
    }
  }

  /** The most a point is out of place after relaxing, as a share of a link (how well the length holds). */
  get stretch(): number {
    let worst = 0;
    for (let i = 0; i < this.n - 1; i++) {
      const dx = this.x[i + 1] - this.x[i];
      const dy = this.y[i + 1] - this.y[i];
      worst = Math.max(worst, Math.abs(Math.sqrt(dx * dx + dy * dy) - this.rest) / this.rest);
    }
    return worst;
  }

  /** How much the rope is moving (the sum of the points' last steps, metres), near zero once it has settled. */
  get motion(): number {
    let m = 0;
    for (let i = 0; i < this.n; i++) m += Math.abs(this.x[i] - this.px[i]) + Math.abs(this.y[i] - this.py[i]);
    return m;
  }

  private substep(dt: number, gravity: number, windX: number, damping: number): void {
    const n = this.n;
    this.time += dt;
    // Wind comes in gusts: a steady push with slow swells on top.
    const gust = windX * (0.7 + 0.3 * Math.sin(this.time * 1.7) + 0.15 * Math.sin(this.time * 4.1));
    for (let i = 1; i < n - 1; i++) {
      const vx = (this.x[i] - this.px[i]) * damping;
      const vy = (this.y[i] - this.py[i]) * damping;
      this.px[i] = this.x[i];
      this.py[i] = this.y[i];
      this.x[i] += vx + gust * dt * dt;
      this.y[i] += vy - gravity * dt * dt;
    }
    // The ends are pinned.
    this.x[0] = this.px[0] = this.ax;
    this.y[0] = this.py[0] = this.ay;
    this.x[n - 1] = this.px[n - 1] = this.bx;
    this.y[n - 1] = this.py[n - 1] = this.by;
    // Pull each link back to its length, from both ends in turn, a number of times.
    for (let iter = 0; iter < 12; iter++) {
      for (let k = 0; k < n - 1; k++) {
        const i = iter & 1 ? n - 2 - k : k;
        const dx = this.x[i + 1] - this.x[i];
        const dy = this.y[i + 1] - this.y[i];
        const d = Math.sqrt(dx * dx + dy * dy) || 1e-6;
        const diff = (d - this.rest) / d;
        const wa = i === 0 ? 0 : 0.5;
        const wb = i + 1 === n - 1 ? 0 : 0.5;
        const sum = wa + wb || 1;
        this.x[i] += (dx * diff * wa) / sum;
        this.y[i] += (dy * diff * wa) / sum;
        this.x[i + 1] -= (dx * diff * wb) / sum;
        this.y[i + 1] -= (dy * diff * wb) / sum;
      }
    }
  }
}
