// The kindred: a small shadow bird that lives on the stage wall and flies about by itself. It drifts in slow loops, circles
// the light (or whatever it is told to), can land on a spot, and shies away from a startle. It is a picture only: it never
// touches the puzzle or the solver. Positions are stage coordinates in metres from the stage's centre (x right, y up).
// Plain TypeScript; a fixed number of numbers and no allocation per update.

const MAX_DT = 0.1;
const MAX_SPEED = 0.22;
const SPRING = 1.7;
const DAMP = 2.1;
const PERCH_SPRING = 7;
const PERCH_DAMP = 5;
/** How far from the edge of the stage it stays, as a fraction of the half-size. */
const MARGIN = 0.88;

export type KindredFrame = 0 | 1 | 2; // wings up, level, down

export class Kindred {
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  /** 1 when it faces right, -1 when it faces left. */
  facing: 1 | -1 = 1;
  /** Wing phase in turns (0..1). */
  flap = 0;
  private t = 0;
  private startle = 0;
  private perchX = 0;
  private perchY = 0;
  private perched = false;

  constructor(private readonly seed = 0) {
    this.t = seed * 7.31;
  }

  get isPerched(): boolean {
    return this.perched;
  }

  /** Which of the three wing drawings to show now. */
  get frame(): KindredFrame {
    const s = Math.sin(this.flap * 2 * Math.PI);
    return s > 0.35 ? 0 : s < -0.35 ? 2 : 1;
  }

  get speed(): number {
    return Math.sqrt(this.vx * this.vx + this.vy * this.vy);
  }

  /** Lands at a spot (and stays until `release`). */
  perchAt(x: number, y: number): void {
    this.perchX = x;
    this.perchY = y;
    this.perched = true;
  }

  release(): void {
    this.perched = false;
  }

  /** A fright: pushed away from (fromX, fromY) at once, and flying for a moment. */
  scare(fromX: number, fromY: number): void {
    let dx = this.x - fromX;
    let dy = this.y - fromY;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    dx /= d;
    dy /= d;
    this.vx += dx * MAX_SPEED * 1.6;
    this.vy += dy * MAX_SPEED * 1.6;
    this.perched = false;
    this.startle = 0.8;
  }

  /**
   * One step of `dt` seconds on a stage `halfW` by `halfH` (half-size, metres). `focus` is the spot it circles (the
   * light's projection on the wall, say), or null to wander the whole stage.
   */
  update(dt: number, halfW: number, halfH: number, focusX: number, focusY: number, hasFocus: boolean): void {
    if (!(dt > 0)) return;
    dt = Math.min(dt, MAX_DT);
    this.t += dt;
    this.startle = Math.max(0, this.startle - dt);
    const t = this.t;

    let tx: number, ty: number, k: number, c: number;
    if (this.perched) {
      tx = this.perchX;
      ty = this.perchY;
      k = PERCH_SPRING;
      c = PERCH_DAMP;
    } else {
      // Slow loops: a wide figure of eight about the focus (or the stage's middle), plus a quicker small wobble.
      const cx = hasFocus ? focusX : 0;
      const cy = hasFocus ? focusY : 0;
      const rx = hasFocus ? Math.min(0.14, halfW * 0.45) : halfW * 0.6;
      const ry = hasFocus ? Math.min(0.09, halfH * 0.4) : halfH * 0.4;
      tx = cx + rx * Math.sin(t * 0.37) + 0.02 * Math.sin(t * 1.9);
      ty = cy + ry * Math.sin(t * 0.74 + 0.8) + 0.015 * Math.sin(t * 2.3 + 1);
      k = SPRING;
      c = DAMP;
    }
    const ax = k * (tx - this.x) - c * this.vx;
    const ay = k * (ty - this.y) - c * this.vy;
    this.vx += ax * dt;
    this.vy += ay * dt;
    const sp = this.speed;
    const cap = this.startle > 0 ? MAX_SPEED * 1.8 : MAX_SPEED;
    if (sp > cap) {
      this.vx *= cap / sp;
      this.vy *= cap / sp;
    }
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    const lx = halfW * MARGIN;
    const ly = halfH * MARGIN;
    if (this.x > lx) {
      this.x = lx;
      this.vx = Math.min(this.vx, 0);
    } else if (this.x < -lx) {
      this.x = -lx;
      this.vx = Math.max(this.vx, 0);
    }
    if (this.y > ly) {
      this.y = ly;
      this.vy = Math.min(this.vy, 0);
    } else if (this.y < -ly) {
      this.y = -ly;
      this.vy = Math.max(this.vy, 0);
    }

    if (this.vx > 0.02) this.facing = 1;
    else if (this.vx < -0.02) this.facing = -1;
    const landed = this.perched && this.speed < 0.01;
    const hz = landed ? 0.5 : 2.5 + 5 * Math.min(1, this.speed / MAX_SPEED);
    this.flap = (this.flap + hz * dt) % 1;
  }
}
