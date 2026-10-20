// Draws both hands' shadows on the stage from their capsules (HandShadow), in
// one draw call: a quad over the stage rectangle, so shadows are clipped to the
// stage for free, with soft edges that widen as the hand moves away from it.
// No allocation per frame.
import { Color, DoubleSide, Matrix4, Mesh, PlaneGeometry, ShaderMaterial, Vector2 } from '@iwsdk/core';
import type { Handedness } from '../hands/hand';
import type { HandShadow } from '../hands/hand-shadow';
import type { ShadowLook } from './pure/shadow-sharpen';
import type { StagePlane } from './pure/stage-plane';
import { MAX_CAPSULES, packShadowUniforms, type ShadowUniformArrays } from './pure/shadow-uniforms';
import { shadowFragment, shadowVertex } from './shadow-shader';

/** Shadows draw after the stage paper (1) and before sprites drawn on top. */
export const SHADOW_RENDER_ORDER = 2;
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
  };
  private readonly m = new Matrix4();

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
   * Call once per frame after the projector.
   * @param looks each hand's sharpen look (shadow-sharpen.ts), or null for plain shadows
   */
  update(
    shadows: Readonly<Record<Handedness, HandShadow>>,
    stage: StagePlane,
    looks: Readonly<Record<Handedness, ShadowLook>> | null = null,
    lightOcclusion = 1.0,
  ): void {
    const any =
      lightOcclusion > 0.001 && packShadowUniforms(shadows, looks, this.baseOpacity * lightOcclusion, this.uniforms);
    this.mesh.visible = any;
    if (!this.mesh.visible) return;

    // The quad spans the stage: x along right × width, y along up × height, z along the normal.
    const r = stage.right,
      u = stage.up,
      n = stage.normal,
      o = stage.origin;
    const w = stage.width,
      ht = stage.height;
    // prettier-ignore
    this.m.set(
      r[0] * w, u[0] * ht, n[0], o[0] + n[0] * LIFT_M,
      r[1] * w, u[1] * ht, n[1], o[1] + n[1] * LIFT_M,
      r[2] * w, u[2] * ht, n[2], o[2] + n[2] * LIFT_M,
      0, 0, 0, 1,
    );
    this.mesh.matrix.copy(this.m);
    this.mesh.matrixWorldNeedsUpdate = true;
    (this.material.uniforms.uSize.value as Vector2).set(w, ht);
  }
}
