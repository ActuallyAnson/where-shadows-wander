// Draws both hands' shadows on the stage from their capsules (HandShadow), in
// one draw call: a quad over the stage rectangle, so shadows are clipped to the
// stage for free, with soft edges that widen as the hand moves away from it.
// On the room's wall the quad covers the candle's whole pool of light instead, and the shadows fade with it (stage-edge-glsl.ts).
// No allocation per frame.
import { Color, DoubleSide, Matrix4, Mesh, PlaneGeometry, ShaderMaterial, Vector2, Vector3 } from '@iwsdk/core';
import type { Handedness } from '../hands/hand';
import type { HandShadow } from '../hands/hand-shadow';
import type { ShadowLook } from './pure/shadow-sharpen';
import type { StagePlane } from './pure/stage-plane';
import { MAX_CAPSULES, packShadowUniforms, type ShadowUniformArrays } from './pure/shadow-uniforms';
import { shadowFragment, shadowVertex } from './shadow-shader';
import { RenderOrder } from './pure/render-order';
import { LIGHT_POOL_RX_M, LIGHT_POOL_RY_M } from './stage-edge-glsl';

/** Shadows draw after the stage paper (1) and before sprites drawn on top. */
export const SHADOW_RENDER_ORDER = RenderOrder.shadow;
/** Lifted this far off the stage, toward the player, so it never fights the paper for depth. */
const LIFT_M = 0.002;

/** How solid a shadow is drawn (1 is fully black). High contrast uses 1. */
export const DEFAULT_SHADOW_OPACITY = 0.88;

export class ShadowRenderer {
  readonly mesh: Mesh;
  private readonly material: ShaderMaterial;
  private readonly uniforms: ShadowUniformArrays = {
    caps: new Float32Array(MAX_CAPSULES * 4),
    radBlur: new Float32Array(MAX_CAPSULES * 2),
    bounds: new Float32Array(2 * 4),
    active: new Int32Array(2),
    opacity: new Float32Array(2),
    held: new Float32Array(2),
    lastOpacity: new Float32Array(2),
  };
  private readonly m = new Matrix4();
  /** Where the candle's pool of light is drawn ([width, height, centre x, centre y], stage metres), or null: just the stage. */
  private pool: Float64Array | null = null;

  /** `baseOpacity` can change while running: high contrast makes the shadows fully solid. */
  constructor(public baseOpacity = DEFAULT_SHADOW_OPACITY) {
    this.uniforms.opacity.fill(baseOpacity);
    this.material = new ShaderMaterial({
      uniforms: {
        uCaps: { value: this.uniforms.caps },
        uRadBlur: { value: this.uniforms.radBlur },
        uBounds: { value: this.uniforms.bounds },
        uActive: { value: this.uniforms.active },
        uSize: { value: new Vector2(1, 1) },
        uColor: { value: new Color(0x000000) },
        uOpacity: { value: this.uniforms.opacity },
        uAreaC: { value: new Vector2(0, 0) },
        uPool: { value: new Vector3(0, 0, 0) },
        uPoolR: { value: new Vector2(LIGHT_POOL_RX_M, LIGHT_POOL_RY_M) },
      },
      vertexShader: shadowVertex,
      fragmentShader: shadowFragment,
      transparent: true,
      premultipliedAlpha: false, // blends as src-alpha over a (0,0,0,0) clear, which is premultiplied in the XR target
      toneMapped: false, // black stays black whatever the scene's tone mapping is
      depthWrite: false,
      side: DoubleSide,
    });
    this.mesh = new Mesh(new PlaneGeometry(1, 1), this.material);
    this.mesh.matrixAutoUpdate = false;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = SHADOW_RENDER_ORDER;
    this.mesh.visible = false;
  }

  /**
   * Call once per frame after the projector, `dt` seconds after the last call (a lost hand's shadow fades out over it).
   * @param looks each hand's sharpen look (shadow-sharpen.ts), or null for plain shadows
   */
  update(
    shadows: Readonly<Record<Handedness, HandShadow>>,
    stage: StagePlane,
    looks: Readonly<Record<Handedness, ShadowLook>> | null,
    lightOcclusion: number,
    dt: number,
  ): void {
    const any =
      lightOcclusion > 0.001 &&
      packShadowUniforms(shadows, looks, this.baseOpacity * lightOcclusion, this.uniforms, dt);
    // With the light out there is no shadow to hold: a hand lost meanwhile must not reappear and fade when it comes back.
    if (lightOcclusion <= 0.001) this.uniforms.held.fill(0);
    this.mesh.visible = any;
    if (!this.mesh.visible) return;

    // The quad spans the stage: x along right × width, y along up × height, z along the normal.
    const r = stage.right,
      u = stage.up,
      n = stage.normal,
      o = stage.origin;
    const a = this.pool;
    const w = a ? a[0] : stage.width,
      ht = a ? a[1] : stage.height,
      cx = a ? a[2] : 0,
      cy = a ? a[3] : 0;
    // prettier-ignore
    this.m.set(
      r[0] * w, u[0] * ht, n[0], o[0] + r[0] * cx + u[0] * cy + n[0] * LIFT_M,
      r[1] * w, u[1] * ht, n[1], o[1] + r[1] * cx + u[1] * cy + n[1] * LIFT_M,
      r[2] * w, u[2] * ht, n[2], o[2] + r[2] * cx + u[2] * cy + n[2] * LIFT_M,
      0, 0, 0, 1,
    );
    this.mesh.matrix.copy(this.m);
    this.mesh.matrixWorldNeedsUpdate = true;
    (this.material.uniforms.uSize.value as Vector2).set(w, ht);
    (this.material.uniforms.uAreaC.value as Vector2).set(cx, cy);
  }

  /**
   * Draws the shadows over the candle's pool of light (`area`: [width, height, centre x, centre y], metres from the stage's
   * centre; lightArea in stage-edge-glsl.ts), fading with it; `flameX`, `flameY` are the flame's place across and up the wall
   * from the stage's centre. `null` draws them on the stage only, with a hard edge. Allocates nothing.
   */
  setPool(area: Readonly<ArrayLike<number>> | null, flameX = 0, flameY = 0): void {
    const pool = this.material.uniforms.uPool.value as Vector3;
    if (!area) {
      this.pool = null;
      pool.set(0, 0, 0);
      return;
    }
    this.pool ??= new Float64Array(4);
    for (let i = 0; i < 4; i++) this.pool[i] = area[i];
    pool.set(flameX, flameY, 1);
  }
}
