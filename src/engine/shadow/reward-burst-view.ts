// A small reward when a puzzle is solved, made of specks of light that fly on the paper where the traveller stands: gold dust that
// lifts off the bridge (the books), a burst of sparks (the ledge), pale drops that fall and glitter (the drip), green and gold leaves
// that spiral up in the wind (the fan), and a flood of warm light pouring out of the gate (the castle). One pool of specks, one
// Points, moved by plain arithmetic each frame: nothing is allocated.
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  DynamicDrawUsage,
  Group,
  Points,
  ShaderMaterial,
} from '@iwsdk/core';
import type { StagePlane } from './pure/stage-plane';

/** How many specks can be alive at once, and how far in front of the paper they sit (metres). */
export const BURST_POOL = 96;
const LIFT_M = 0.008;

/** The kinds of reward, one for each puzzle of the night in order. */
export const REWARDS = ['dust', 'sparks', 'drops', 'leaves', 'light'] as const;
/** The five rewards, and the small puff of dust a footstep kicks up. */
export type RewardKind = (typeof REWARDS)[number] | 'puff';

const VERTEX = /* glsl */ `
uniform float uScale;
attribute float aA;
attribute float aSize;
attribute vec3 aColor;
varying float vA;
varying vec3 vColor;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aSize * uScale / max(0.4, -mv.z);
  vA = aA;
  vColor = aColor;
}`;

const FRAGMENT = /* glsl */ `
varying float vA;
varying vec3 vColor;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, d);
  gl_FragColor = vec4(vColor, a * vA);
  #include <colorspace_fragment>
}`;

interface Look {
  count: number;
  life: [number, number];
  /** Where each starts relative to the traveller, and its velocity. */
  spread: [number, number];
  vx: [number, number];
  vy: [number, number];
  gravity: number;
  /** A spiral: its radius (m) and rate (rad/s). */
  swirl: [number, number];
  size: [number, number];
  colours: readonly (readonly [number, number, number])[];
  /** Starts this far above the traveller. */
  lift: number;
}

const LOOKS: Readonly<Record<RewardKind, Look>> = {
  dust: {
    count: 56,
    life: [1.4, 2.4],
    spread: [0.3, 0.02],
    vx: [-0.02, 0.02],
    vy: [0.05, 0.16],
    gravity: -0.02,
    swirl: [0.015, 3],
    size: [0.05, 0.11],
    colours: [
      [1, 0.82, 0.4],
      [1, 0.93, 0.7],
    ],
    lift: 0.0,
  },
  sparks: {
    count: 48,
    life: [0.8, 1.5],
    spread: [0.02, 0.02],
    vx: [-0.34, 0.34],
    vy: [0.05, 0.45],
    gravity: 0.5,
    swirl: [0, 0],
    size: [0.06, 0.12],
    colours: [
      [1, 0.95, 0.75],
      [1, 0.75, 0.35],
    ],
    lift: 0.04,
  },
  drops: {
    count: 44,
    life: [1.0, 1.8],
    spread: [0.22, 0.02],
    vx: [-0.015, 0.015],
    vy: [-0.12, -0.04],
    gravity: 0.15,
    swirl: [0.004, 5],
    size: [0.05, 0.1],
    colours: [
      [0.7, 0.88, 1],
      [0.95, 0.98, 1],
    ],
    lift: 0.3,
  },
  leaves: {
    count: 36,
    life: [1.6, 2.6],
    spread: [0.08, 0.02],
    vx: [-0.03, 0.12],
    vy: [0.08, 0.2],
    gravity: -0.01,
    swirl: [0.09, 5],
    size: [0.07, 0.13],
    colours: [
      [0.62, 0.85, 0.4],
      [1, 0.85, 0.4],
    ],
    lift: 0.02,
  },
  puff: {
    count: 4,
    life: [0.35, 0.6],
    spread: [0.012, 0.004],
    vx: [-0.05, 0.05],
    vy: [0.01, 0.07],
    gravity: 0.08,
    swirl: [0, 0],
    size: [0.035, 0.06],
    colours: [
      [1, 0.9, 0.7],
      [0.95, 0.85, 0.7],
    ],
    lift: 0,
  },
  light: {
    count: 72,
    life: [1.8, 3],
    spread: [0.1, 0.03],
    vx: [-0.1, 0.1],
    vy: [0.1, 0.4],
    gravity: -0.03,
    swirl: [0.03, 2.5],
    size: [0.1, 0.22],
    colours: [
      [1, 0.95, 0.8],
      [1, 0.8, 0.45],
    ],
    lift: 0.04,
  },
};

export class RewardBurstView {
  readonly group = new Group();
  private readonly positions = new Float32Array(BURST_POOL * 3);
  private readonly alpha = new Float32Array(BURST_POOL);
  private readonly size = new Float32Array(BURST_POOL);
  private readonly colour = new Float32Array(BURST_POOL * 3);
  private readonly points: Points;
  private readonly material: ShaderMaterial;
  // Each speck's state: where it started on the stage, its velocity, its gravity, its spiral, how old it is and how long it lives.
  private readonly x0 = new Float32Array(BURST_POOL);
  private readonly y0 = new Float32Array(BURST_POOL);
  private readonly vx = new Float32Array(BURST_POOL);
  private readonly vy = new Float32Array(BURST_POOL);
  private readonly g = new Float32Array(BURST_POOL);
  private readonly sr = new Float32Array(BURST_POOL);
  private readonly sw = new Float32Array(BURST_POOL);
  private readonly ph = new Float32Array(BURST_POOL);
  private readonly age = new Float32Array(BURST_POOL);
  private readonly life = new Float32Array(BURST_POOL);
  private cursor = 0;
  private seed = 12345;
  private live = 0;

  constructor() {
    const geometry = new BufferGeometry();
    const attr = (array: Float32Array, n: number) => {
      const a = new BufferAttribute(array, n);
      a.setUsage(DynamicDrawUsage);
      return a;
    };
    geometry.setAttribute('position', attr(this.positions, 3));
    geometry.setAttribute('aA', attr(this.alpha, 1));
    geometry.setAttribute('aSize', attr(this.size, 1));
    geometry.setAttribute('aColor', attr(this.colour, 3));
    this.material = new ShaderMaterial({
      uniforms: { uScale: { value: 260 } },
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: AdditiveBlending,
    });
    this.points = new Points(geometry, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 6;
    this.group.add(this.points);
    this.group.visible = false;
    for (let i = 0; i < BURST_POOL; i++) this.life[i] = 0;
  }

  /** How many specks are alive. */
  get alive(): number {
    return this.live;
  }

  /** Plays the reward `kind` where the traveller is (`x`, `y` on the stage). Specks of an earlier reward still flying carry on. */
  play(kind: RewardKind, x: number, y: number): void {
    const look = LOOKS[kind];
    for (let n = 0; n < look.count; n++) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % BURST_POOL;
      this.x0[i] = x + this.range(-look.spread[0], look.spread[0]);
      this.y0[i] = y + look.lift + this.range(-look.spread[1], look.spread[1]);
      this.vx[i] = this.range(look.vx[0], look.vx[1]);
      this.vy[i] = this.range(look.vy[0], look.vy[1]);
      this.g[i] = look.gravity;
      this.sr[i] = look.swirl[0] * this.range(0.5, 1);
      this.sw[i] = look.swirl[1] * this.range(0.7, 1.3);
      this.ph[i] = this.range(0, 6.283);
      this.age[i] = 0;
      this.life[i] = this.range(look.life[0], look.life[1]);
      this.size[i] = this.range(look.size[0], look.size[1]);
      const c = look.colours[Math.floor(this.range(0, look.colours.length)) % look.colours.length];
      this.colour[i * 3] = c[0];
      this.colour[i * 3 + 1] = c[1];
      this.colour[i * 3 + 2] = c[2];
    }
  }

  /** Drops every speck now. */
  clear(): void {
    this.life.fill(0);
    this.alpha.fill(0);
    this.live = 0;
    this.group.visible = false;
  }

  /** Once per frame. `opacity` is the shadows' opacity (the lights dim with the candle). Allocates nothing. */
  update(dt: number, stage: StagePlane, opacity: number): void {
    const step = dt > 0 ? Math.min(dt, 0.1) : 0;
    const r = stage.right,
      u = stage.up,
      n = stage.normal,
      o = stage.origin;
    let live = 0;
    for (let i = 0; i < BURST_POOL; i++) {
      if (this.life[i] <= 0) {
        this.alpha[i] = 0;
        continue;
      }
      this.age[i] += step;
      const t = this.age[i];
      if (t >= this.life[i]) {
        this.life[i] = 0;
        this.alpha[i] = 0;
        continue;
      }
      live++;
      const x = this.x0[i] + this.vx[i] * t + this.sr[i] * Math.sin(this.sw[i] * t + this.ph[i]);
      const y =
        this.y0[i] +
        this.vy[i] * t -
        0.5 * this.g[i] * t * t +
        this.sr[i] * 0.5 * Math.cos(this.sw[i] * t + this.ph[i]);
      this.positions[i * 3] = o[0] + r[0] * x + u[0] * y + n[0] * LIFT_M;
      this.positions[i * 3 + 1] = o[1] + r[1] * x + u[1] * y + n[1] * LIFT_M;
      this.positions[i * 3 + 2] = o[2] + r[2] * x + u[2] * y + n[2] * LIFT_M;
      const life = t / this.life[i];
      const fadeIn = Math.min(1, t / 0.12);
      const fadeOut = life > 0.55 ? 1 - (life - 0.55) / 0.45 : 1;
      // A gentle twinkle on top.
      this.alpha[i] = fadeIn * fadeOut * (0.75 + 0.25 * Math.sin(t * 17 + this.ph[i])) * opacity;
    }
    this.live = live;
    this.group.visible = live > 0;
    const g = this.points.geometry;
    g.attributes.position.needsUpdate = true;
    g.attributes.aA.needsUpdate = true;
    g.attributes.aSize.needsUpdate = true;
    g.attributes.aColor.needsUpdate = true;
  }

  dispose(): void {
    this.points.geometry.dispose();
    this.material.dispose();
  }

  /** A number between `lo` and `hi` from a small fixed sequence (the same every run). */
  private range(lo: number, hi: number): number {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return lo + (hi - lo) * (this.seed / 4294967296);
  }
}
