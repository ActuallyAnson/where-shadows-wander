// The player's hands as drawn in the room (VR has no passthrough, so the real hands are not seen).
// A HandVisual draws both hands from their HandFrames; the shadow is cast from the tracked joints, never
// from this, so the look can change without touching the game. CapsuleHandVisual is the first look: a flat
// dark glove built from the same capsule pairs as the shadow (CAPSULE_JOINTS), in two draw calls and with
// nothing allocated per frame. A model-based look can replace it by implementing HandVisual.
//
// It draws after the paper and before the shadow, without writing depth, so where a hand overlaps its own
// shadow on the wall the shadow stays on top and is never hidden by the glove.
// Known limit: for the same reason it writes no depth, so the candle's flame (drawn after it) shows through
// a hand held in front of it, and the candle's aura and placement rings (drawn before it) sit under it.
import {
  Color,
  CylinderGeometry,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  Quaternion,
  SphereGeometry,
  Vector3,
  type BufferGeometry,
  type Object3D,
} from '@iwsdk/core';
import { JOINT_COUNT, type HandFrame } from '../hands/hand';
import { CAPSULE_JOINTS } from '../shadow/pure/shadow-projector';
import { litAmount } from './candle-tint';
import { stepFade } from './hand-fade';

export interface HandVisual {
  /** Add this to the scene. */
  readonly object: Object3D;
  /**
   * Call once per frame. `flame` is the candle flame position, or null when there is none. `shown` is false
   * while the game is paused (no hand data arrives then), which fades the hands out instead of freezing them.
   */
  update(hands: readonly HandFrame[], dt: number, flame?: ArrayLike<number> | null, shown?: boolean): void;
  dispose(): void;
}

/** Between the stage paper (render order 1) and the shadow (2). */
export const HAND_RENDER_ORDER = 1.5;
const BONES = CAPSULE_JOINTS.length / 2;
const MIN_RADIUS_M = 0.006;
const UP = new Vector3(0, 1, 0);

// The fade is a 4 x 4 ordered dither (fragments are kept or discarded, never blended), because blending
// would show every joint sphere and bone overlap as a darker blob while a hand fades.
const DITHER_FADE = `
  const float bayer[16] = float[16](0.,8.,2.,10., 12.,4.,14.,6., 3.,11.,1.,9., 15.,7.,13.,5.);
  ivec2 ditherCell = ivec2(mod(gl_FragCoord.xy, 4.0));
  if (vFade <= (bayer[ditherCell.y * 4 + ditherCell.x] + 0.5) / 16.0) discard;
  diffuseColor.a = 1.0;`;

/** `src` with `add` after the first `marker`. Throws if three.js no longer has the marker, so a renamed shader chunk fails loudly. */
export function insertAfter(src: string, marker: string, add: string): string {
  const at = src.indexOf(marker);
  if (at < 0) throw new Error(`hand visual: shader chunk ${marker} not found (did three.js change?)`);
  return src.slice(0, at + marker.length) + '\n' + add + src.slice(at + marker.length);
}

export class CapsuleHandVisual implements HandVisual {
  readonly object = new Group();
  private readonly joints: InstancedMesh;
  private readonly bones: InstancedMesh;
  private readonly jointFade: Float32Array;
  private readonly boneFade: Float32Array;
  private readonly jointFadeAttr: InstancedBufferAttribute;
  private readonly boneFadeAttr: InstancedBufferAttribute;
  /** Each hand's opacity, [left, right]. */
  readonly fade = new Float32Array(2);
  // Each hand's last fully tracked pose, [left, right]. A hand that is partly tracked or lost keeps stale
  // (even the other hand's) joints in its HandFrame, so the fade-out draws from these copies instead.
  private readonly seen = new Uint8Array(2);
  private readonly lastPositions = [new Float32Array(JOINT_COUNT * 3), new Float32Array(JOINT_COUNT * 3)];
  private readonly lastRadii = [new Float32Array(JOINT_COUNT), new Float32Array(JOINT_COUNT)];
  private readonly base = new Color(0x2b2733);
  private readonly lit = new Color(0xb8793a);
  private readonly tint = new Color();
  private readonly m = new Matrix4();
  private readonly q = new Quaternion();
  private readonly a = new Vector3();
  private readonly b = new Vector3();
  private readonly d = new Vector3();
  private readonly mid = new Vector3();
  private readonly scale = new Vector3();

  constructor() {
    const material = new MeshBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false });
    // One extra per-instance number, the hand's opacity (instance colour has no alpha). Transparent so it
    // sorts with the paper and shadow; fragments are opaque, see DITHER_FADE.
    material.customProgramCacheKey = () => 'wsw-hand-visual';
    material.onBeforeCompile = (shader) => {
      shader.vertexShader = insertAfter(
        insertAfter(shader.vertexShader, '#include <common>', 'attribute float aFade;\nvarying float vFade;'),
        '#include <begin_vertex>',
        'vFade = aFade;',
      );
      shader.fragmentShader = insertAfter(
        insertAfter(shader.fragmentShader, '#include <common>', 'varying float vFade;'),
        '#include <color_fragment>',
        DITHER_FADE,
      );
    };
    this.joints = new InstancedMesh(new SphereGeometry(1, 8, 6), material, JOINT_COUNT * 2);
    this.bones = new InstancedMesh(new CylinderGeometry(1, 1, 1, 8, 1, false), material, BONES * 2);
    this.jointFade = new Float32Array(JOINT_COUNT * 2);
    this.boneFade = new Float32Array(BONES * 2);
    this.jointFadeAttr = this.addFade(this.joints.geometry, this.jointFade);
    this.boneFadeAttr = this.addFade(this.bones.geometry, this.boneFade);
    for (const mesh of [this.joints, this.bones]) {
      mesh.frustumCulled = false;
      mesh.renderOrder = HAND_RENDER_ORDER;
      mesh.count = 0;
      mesh.setColorAt(0, this.base); // makes the colour buffer now, not on the first frame
      this.object.add(mesh);
    }
  }

  private addFade(geometry: BufferGeometry, values: Float32Array): InstancedBufferAttribute {
    const attr = new InstancedBufferAttribute(values, 1);
    geometry.setAttribute('aFade', attr);
    return attr;
  }

  update(hands: readonly HandFrame[], dt: number, flame?: ArrayLike<number> | null, shown = true): void {
    const hasFlame = flame !== null && flame !== undefined;
    const fx = hasFlame ? flame[0] : 0;
    const fy = hasFlame ? flame[1] : 0;
    const fz = hasFlame ? flame[2] : 0;
    let nj = 0;
    let nb = 0;
    for (const hand of hands) {
      const side = hand.handedness === 'left' ? 0 : 1;
      if (hand.tracked) {
        this.lastPositions[side].set(hand.positions);
        this.lastRadii[side].set(hand.radii);
        this.seen[side] = 1;
      }
      const fade = (this.fade[side] = stepFade(this.fade[side], hand.tracked && shown, dt));
      // A lost or paused hand fades out where it was last fully tracked; one never seen draws nothing.
      if (fade <= 0 || this.seen[side] === 0) continue;
      const p = this.lastPositions[side];
      const r = this.lastRadii[side];
      for (let j = 0; j < JOINT_COUNT; j++) {
        const x = p[j * 3];
        const y = p[j * 3 + 1];
        const z = p[j * 3 + 2];
        const s = Math.max(r[j] || 0, MIN_RADIUS_M);
        this.paint(this.joints, nj, hasFlame ? litAmount(x, y, z, fx, fy, fz) : 0);
        this.m.makeScale(s, s, s).setPosition(x, y, z);
        this.joints.setMatrixAt(nj, this.m);
        this.jointFade[nj++] = fade;
      }
      for (let k = 0; k < BONES; k++) {
        const i = CAPSULE_JOINTS[k * 2];
        const j = CAPSULE_JOINTS[k * 2 + 1];
        this.a.set(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]);
        this.b.set(p[j * 3], p[j * 3 + 1], p[j * 3 + 2]);
        this.d.subVectors(this.b, this.a);
        const len = this.d.length();
        if (len < 1e-6) continue;
        this.q.setFromUnitVectors(UP, this.d.multiplyScalar(1 / len));
        this.mid.addVectors(this.a, this.b).multiplyScalar(0.5);
        const s = Math.max(Math.min(r[i], r[j]) || 0, MIN_RADIUS_M);
        this.scale.set(s, len, s);
        this.m.compose(this.mid, this.q, this.scale);
        this.paint(this.bones, nb, hasFlame ? litAmount(this.mid.x, this.mid.y, this.mid.z, fx, fy, fz) : 0);
        this.bones.setMatrixAt(nb, this.m);
        this.boneFade[nb++] = fade;
      }
    }
    this.joints.count = nj;
    this.bones.count = nb;
    this.joints.instanceMatrix.needsUpdate = true;
    this.bones.instanceMatrix.needsUpdate = true;
    this.jointFadeAttr.needsUpdate = true;
    this.boneFadeAttr.needsUpdate = true;
    if (this.joints.instanceColor) this.joints.instanceColor.needsUpdate = true;
    if (this.bones.instanceColor) this.bones.instanceColor.needsUpdate = true;
  }

  /** Warms an instance's colour toward candlelight by `lit` (0 to 1). */
  private paint(mesh: InstancedMesh, index: number, lit: number): void {
    mesh.setColorAt(index, lit > 0 ? this.tint.copy(this.base).lerp(this.lit, lit * 0.85) : this.base);
  }

  dispose(): void {
    for (const mesh of [this.joints, this.bones]) {
      mesh.geometry.dispose();
      mesh.dispose();
    }
    (this.joints.material as MeshBasicMaterial).dispose();
  }
}
