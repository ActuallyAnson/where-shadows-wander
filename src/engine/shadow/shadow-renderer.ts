// Draws both hands' shadows on the stage from their capsules (HandShadow), in
// one draw call: a quad over the stage rectangle, so shadows are clipped to the
// stage for free, with soft edges that widen as the hand moves away from it.
// No allocation per frame.
import { Color, DoubleSide, Matrix4, Mesh, PlaneGeometry, ShaderMaterial, Vector2 } from '@iwsdk/core';
import type { Handedness } from '../hands/hand';
import { CAPSULES_PER_HAND, CAPSULE_STRIDE, type HandShadow } from '../hands/hand-shadow';
import type { StagePlane } from './pure/stage-plane';
import { MAX_CAPSULES, shadowFragment, shadowVertex } from './shadow-shader';

/** Shadows draw after the stage paper (1) and before sprites drawn on top. */
export const SHADOW_RENDER_ORDER = 2;
/** Lifted this far off the stage, toward the player, so it never fights the paper for depth. */
const LIFT_M = 0.002;
const HANDS: readonly Handedness[] = ['left', 'right'];

export class ShadowRenderer {
  readonly mesh: Mesh;
  private readonly material: ShaderMaterial;
  private readonly caps = new Float32Array(MAX_CAPSULES * 4);
  private readonly radBlur = new Float32Array(MAX_CAPSULES * 2);
  private readonly m = new Matrix4();

  constructor(opacity = 0.88) {
    this.material = new ShaderMaterial({
      uniforms: {
        uCaps: { value: this.caps },
        uRadBlur: { value: this.radBlur },
        uCount: { value: 0 },
        uSize: { value: new Vector2(1, 1) },
        uColor: { value: new Color(0x000000) },
        uOpacity: { value: opacity },
      },
      vertexShader: shadowVertex,
      fragmentShader: shadowFragment,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
    });
    this.mesh = new Mesh(new PlaneGeometry(1, 1), this.material);
    this.mesh.matrixAutoUpdate = false;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = SHADOW_RENDER_ORDER;
    this.mesh.visible = false;
  }

  /** Call once per frame after the projector. */
  update(shadows: Readonly<Record<Handedness, HandShadow>>, stage: StagePlane): void {
    let count = 0;
    for (let h = 0; h < HANDS.length; h++) {
      const s = shadows[HANDS[h]];
      if (!s.active || !s.onStage) continue;
      for (let c = 0; c < CAPSULES_PER_HAND; c++) {
        const o = c * CAPSULE_STRIDE;
        this.caps[count * 4] = s.capsules[o];
        this.caps[count * 4 + 1] = s.capsules[o + 1];
        this.caps[count * 4 + 2] = s.capsules[o + 2];
        this.caps[count * 4 + 3] = s.capsules[o + 3];
        this.radBlur[count * 2] = s.capsules[o + 4];
        this.radBlur[count * 2 + 1] = s.blur[c];
        count++;
      }
    }
    this.material.uniforms.uCount.value = count;
    this.mesh.visible = count > 0;
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
