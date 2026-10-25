// Where a hand's shadow touches a prop's shadow: the props are invisible, but their shadows are the landscape, so a hand
// that reaches into one should be felt (a puff of dust, a soft sound). Boxes round each prop's shadow are taken once when the
// props are baked; each frame a hand's shadow box is tested against them. A touch is reported once as the shadows meet (not
// every frame they overlap), with a short pause before the same hand can touch again. Plain TypeScript, no allocation per call.

/** The least a hand's shadow must overlap a prop's, in metres, to count (so a graze does not). */
const MIN_OVERLAP_M = 0.02;
const COOLDOWN_S = 0.9;
const MAX_BOXES = 32;

export interface PolygonLike {
  readonly vertices: ArrayLike<number>;
  readonly vertexCount: number;
}

export class PropTouch {
  private readonly boxes = new Float32Array(MAX_BOXES * 4);
  private count = 0;
  private readonly inside = new Uint8Array(2);
  private readonly wait = new Float32Array(2);
  /** Where the last touch was, stage metres (the middle of the overlap). */
  touchX = 0;
  touchY = 0;

  /** Takes a box round each polygon (call when the props are baked, not per frame). */
  setPolygons(polys: readonly PolygonLike[]): void {
    this.count = 0;
    for (const poly of polys) {
      if (this.count >= MAX_BOXES) break;
      let x0 = Infinity,
        y0 = Infinity,
        x1 = -Infinity,
        y1 = -Infinity;
      for (let i = 0; i < poly.vertexCount; i++) {
        const x = poly.vertices[i * 2],
          y = poly.vertices[i * 2 + 1];
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
      if (!(x1 > x0 && y1 > y0)) continue;
      this.boxes.set([x0, y0, x1, y1], this.count * 4);
      this.count++;
    }
    this.inside.fill(0);
  }

  /** Once per frame for each hand (0 or 1): its shadow box, or active false. Returns true on a new touch (see touchX, touchY). */
  update(hand: number, dt: number, active: boolean, minX: number, minY: number, maxX: number, maxY: number): boolean {
    if (this.wait[hand] > 0) this.wait[hand] = Math.max(0, this.wait[hand] - dt);
    let hit = false;
    if (active) {
      for (let i = 0; i < this.count && !hit; i++) {
        const b = i * 4;
        const ox = Math.min(maxX, this.boxes[b + 2]) - Math.max(minX, this.boxes[b]);
        const oy = Math.min(maxY, this.boxes[b + 3]) - Math.max(minY, this.boxes[b + 1]);
        if (ox > MIN_OVERLAP_M && oy > MIN_OVERLAP_M) {
          hit = true;
          this.touchX = (Math.max(minX, this.boxes[b]) + Math.min(maxX, this.boxes[b + 2])) * 0.5;
          this.touchY = (Math.max(minY, this.boxes[b + 1]) + Math.min(maxY, this.boxes[b + 3])) * 0.5;
        }
      }
    }
    const fresh = hit && this.inside[hand] === 0 && this.wait[hand] <= 0;
    this.inside[hand] = hit ? 1 : 0;
    if (fresh) this.wait[hand] = COOLDOWN_S;
    return fresh;
  }
}
