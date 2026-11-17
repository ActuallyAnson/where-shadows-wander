// A ring of light that opens from a hand's shadow the moment a shape is recognised (committed), in the same warm gold as the
// spark: it tells the player the wall has seen the shape. One quad per hand, moved in place: nothing is allocated per frame.
import { AdditiveBlending, DoubleSide, Group, Matrix4, Mesh, PlaneGeometry, ShaderMaterial } from '@iwsdk/core';
import type { Handedness } from '../hands/hand';
import type { HandShadow } from '../hands/hand-shadow';
import type { ShapeEventQueue } from '../hands/shape-events';
import type { StagePlane } from './pure/stage-plane';
import { placeOnStage } from './stage-quad';
import { RenderOrder } from './pure/render-order';

/** How far in front of the paper the ring sits, metres, and how long it takes to open. */
const LIFT_M = 0.006;
const FLARE_S = 0.75;
/** The ring's size at the start and the end of its opening (metres across). */
const FLARE_FROM_M = 0.1;
const FLARE_TO_M = 0.4;

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

export class ShapeRingView {
  readonly group = new Group();
  private readonly rings: Mesh[] = [];
  private readonly ringMats: ShaderMaterial[] = [];
  private readonly m = new Matrix4();
  /** Whether a ring opens when a shape is recognised (the quality governor turns this off first when frames run long). */
  ringsOn = true;
  /** How far each ring has opened (0..1), or -1 when it is not showing, and where it is on the stage. */
  private readonly flare = [-1, -1];
  private readonly flareX = [0, 0];
  private readonly flareY = [0, 0];

  constructor() {
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

  /** Once per frame, after the projector. `opacity` is the shadows' opacity (the ring dims with the candle). */
  update(dt: number, stage: StagePlane, opacity: number): void {
    const step = dt > 0 ? Math.min(dt, 0.1) : 0;
    let any = false;
    for (let h = 0; h < 2; h++) {
      if (this.flare[h] < 0) continue;
      // The ring opens, then goes.
      this.flare[h] += step / FLARE_S;
      const ring = this.rings[h];
      if (this.flare[h] >= 1) {
        this.flare[h] = -1;
        ring.visible = false;
        continue;
      }
      const t = this.flare[h];
      this.ringMats[h].uniforms.uT.value = t;
      this.ringMats[h].uniforms.uOpacity.value = opacity;
      const size = FLARE_FROM_M + (FLARE_TO_M - FLARE_FROM_M) * (1 - (1 - t) * (1 - t));
      placeOnStage(this.m, ring, stage, this.flareX[h], this.flareY[h], size, size, LIFT_M);
      ring.visible = true;
      any = true;
    }
    this.group.visible = any;
  }

  dispose(): void {
    for (const r of this.rings) r.geometry.dispose();
    for (const m of this.ringMats) m.dispose();
  }
}
