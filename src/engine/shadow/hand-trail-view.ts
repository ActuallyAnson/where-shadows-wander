// A faint golden glow that follows each hand's shadow across the paper (a short trail of soft lights where it has just been), and a
// ring of light that opens from the shadow the moment a shape is recognised (committed). It tells the player the paper has felt their
// hands, in the same warm gold as the spark. Two small meshes (one Points for both trails, one quad per hand for the ring), all moved
// in place: nothing is allocated per frame.
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  DynamicDrawUsage,
  Float32BufferAttribute,
  Group,
  Matrix4,
  Mesh,
  PlaneGeometry,
  Points,
  ShaderMaterial,
} from '@iwsdk/core';
import type { Handedness } from '../hands/hand';
import type { HandShadow } from '../hands/hand-shadow';
import type { ShapeEventQueue } from '../hands/shape-events';
import type { StagePlane } from './pure/stage-plane';
import { placeOnStage } from './stage-quad';
import { RenderOrder } from './pure/render-order';

/** Trail points per hand, and how often a new one is laid (seconds). */
export const TRAIL_POINTS = 18;
const SAMPLE_S = 0.04;
/** How far in front of the paper they sit, metres, and how long the ring takes to open. */
const LIFT_M = 0.006;
const FLARE_S = 0.75;
/** The ring's size at the start and the end of its opening (metres across). */
const FLARE_FROM_M = 0.1;
const FLARE_TO_M = 0.4;

const HANDS: readonly Handedness[] = ['left', 'right'];

const TRAIL_VERTEX = /* glsl */ `
uniform float uScale;
attribute float aA;
attribute float aSize;
varying float vA;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aSize * uScale / max(0.4, -mv.z);
  vA = aA;
}`;

const TRAIL_FRAGMENT = /* glsl */ `
varying float vA;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, d);
  gl_FragColor = vec4(1.0, 0.78, 0.38, a * vA);
  #include <colorspace_fragment>
}`;

const RING_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

// A thin bright ring that opens outward and fades.
const RING_FRAGMENT = /* glsl */ `
uniform float uT;
uniform float uOpacity;
varying vec2 vUv;
void main() {
  float d = length(vUv - 0.5) * 2.0;
  float r = 0.25 + 0.7 * uT;
  float ring = smoothstep(0.1, 0.0, abs(d - r)) * (1.0 - uT);
  gl_FragColor = vec4(1.0, 0.82, 0.45, ring * uOpacity);
  #include <colorspace_fragment>
}`;

export class HandTrailView {
  readonly group = new Group();
  private readonly positions = new Float32Array(TRAIL_POINTS * 2 * 3);
  private readonly alpha = new Float32Array(TRAIL_POINTS * 2);
  private readonly trail: Points;
  private readonly trailMat: ShaderMaterial;
  private readonly rings: Mesh[] = [];
  private readonly ringMats: ShaderMaterial[] = [];
  private readonly m = new Matrix4();
  /** Each hand's recent places on the stage (x, y pairs; the newest first), and whether it has been on the stage lately. */
  private readonly px = [new Float32Array(TRAIL_POINTS), new Float32Array(TRAIL_POINTS)];
  private readonly py = [new Float32Array(TRAIL_POINTS), new Float32Array(TRAIL_POINTS)];
  private readonly live = [new Float32Array(TRAIL_POINTS), new Float32Array(TRAIL_POINTS)];
  /** Whether a ring opens when a shape is recognised (the quality governor turns this off first when frames run long). */
  ringsOn = true;
  private since = 0;
  /** How far each ring has opened (0..1), or -1 when it is not showing, and where it is on the stage. */
  private readonly flare = [-1, -1];
  private readonly flareX = [0, 0];
  private readonly flareY = [0, 0];

  constructor() {
    const geometry = new BufferGeometry();
    const position = new BufferAttribute(this.positions, 3);
    position.setUsage(DynamicDrawUsage);
    const alpha = new BufferAttribute(this.alpha, 1);
    alpha.setUsage(DynamicDrawUsage);
    geometry.setAttribute('position', position);
    geometry.setAttribute('aA', alpha);
    const size = new Float32Array(TRAIL_POINTS * 2);
    for (let h = 0; h < 2; h++)
      for (let i = 0; i < TRAIL_POINTS; i++) size[h * TRAIL_POINTS + i] = 0.075 * (1 - 0.6 * (i / TRAIL_POINTS));
    geometry.setAttribute('aSize', new Float32BufferAttribute(size, 1));
    this.trailMat = new ShaderMaterial({
      uniforms: { uScale: { value: 260 } },
      vertexShader: TRAIL_VERTEX,
      fragmentShader: TRAIL_FRAGMENT,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: AdditiveBlending,
    });
    this.trail = new Points(geometry, this.trailMat);
    this.trail.frustumCulled = false;
    this.trail.renderOrder = RenderOrder.trail;
    this.group.add(this.trail);
    for (let h = 0; h < 2; h++) {
      const mat = new ShaderMaterial({
        uniforms: { uT: { value: 0 }, uOpacity: { value: 1 } },
        vertexShader: RING_VERTEX,
        fragmentShader: RING_FRAGMENT,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: AdditiveBlending,
        side: DoubleSide,
      });
      const ring = new Mesh(new PlaneGeometry(1, 1), mat);
      ring.matrixAutoUpdate = false;
      ring.frustumCulled = false;
      ring.renderOrder = RenderOrder.ring;
      ring.visible = false;
      this.rings.push(ring);
      this.ringMats.push(mat);
      this.group.add(ring);
    }
    this.group.visible = false;
  }

  /** Opens a ring from a hand's shadow when it commits a shape (call with the frame's events, before `update`). */
  onShapeEvents(events: ShapeEventQueue, shadows: Readonly<Record<Handedness, HandShadow>>): void {
    for (let i = 0; i < events.count; i++) {
      const e = events.at(i);
      if (e.type !== 'commit' || !this.ringsOn) continue;
      const h = e.hand === 'left' ? 0 : 1;
      const s = shadows[e.hand];
      if (!s.active) continue;
      this.flare[h] = 0;
      this.flareX[h] = (s.bounds[0] + s.bounds[2]) / 2;
      this.flareY[h] = (s.bounds[1] + s.bounds[3]) / 2;
    }
  }

  /** Once per frame, after the projector. `opacity` is the shadows' opacity (the glow dims with the candle). */
  update(dt: number, stage: StagePlane, shadows: Readonly<Record<Handedness, HandShadow>>, opacity: number): void {
    const step = dt > 0 ? Math.min(dt, 0.1) : 0;
    this.since += step;
    const lay = this.since >= SAMPLE_S;
    if (lay) this.since -= SAMPLE_S;
    const r = stage.right,
      u = stage.up,
      n = stage.normal,
      o = stage.origin;
    let any = false;
    for (let h = 0; h < 2; h++) {
      const s = shadows[HANDS[h]];
      const x = this.px[h],
        y = this.py[h],
        live = this.live[h];
      if (lay) {
        for (let i = TRAIL_POINTS - 1; i > 0; i--) {
          x[i] = x[i - 1];
          y[i] = y[i - 1];
          live[i] = live[i - 1] * 0.86; // each older point is a little dimmer, and gone when the hand is
        }
      }
      if (s.active && s.onStage) {
        x[0] = (s.bounds[0] + s.bounds[2]) / 2;
        y[0] = (s.bounds[1] + s.bounds[3]) / 2;
        live[0] = 1;
      } else if (lay) live[0] = 0;
      for (let i = 0; i < TRAIL_POINTS; i++) {
        const k = h * TRAIL_POINTS + i;
        this.positions[k * 3] = o[0] + r[0] * x[i] + u[0] * y[i] + n[0] * LIFT_M;
        this.positions[k * 3 + 1] = o[1] + r[1] * x[i] + u[1] * y[i] + n[1] * LIFT_M;
        this.positions[k * 3 + 2] = o[2] + r[2] * x[i] + u[2] * y[i] + n[2] * LIFT_M;
        const fade = 1 - i / TRAIL_POINTS;
        const a = live[i] * fade * fade * 0.55 * opacity;
        this.alpha[k] = a;
        if (a > 0.01) any = true;
      }
      // The ring opens, then goes.
      if (this.flare[h] >= 0) {
        this.flare[h] += step / FLARE_S;
        const ring = this.rings[h];
        if (this.flare[h] >= 1) {
          this.flare[h] = -1;
          ring.visible = false;
        } else {
          const t = this.flare[h];
          this.ringMats[h].uniforms.uT.value = t;
          this.ringMats[h].uniforms.uOpacity.value = opacity;
          const size = FLARE_FROM_M + (FLARE_TO_M - FLARE_FROM_M) * (1 - (1 - t) * (1 - t));
          placeOnStage(this.m, ring, stage, this.flareX[h], this.flareY[h], size, size, LIFT_M);
          ring.visible = true;
          any = true;
        }
      }
    }
    this.trail.geometry.attributes.position.needsUpdate = true;
    this.trail.geometry.attributes.aA.needsUpdate = true;
    this.group.visible = any;
  }

  dispose(): void {
    this.trail.geometry.dispose();
    this.trailMat.dispose();
    for (const r of this.rings) r.geometry.dispose();
    for (const m of this.ringMats) m.dispose();
  }
}
