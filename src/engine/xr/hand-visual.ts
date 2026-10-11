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
  MeshBasicMaterial,
  SphereGeometry,
  type BufferGeometry,
  type Object3D,
} from '@iwsdk/core';
import { JOINT_COUNT, type HandFrame } from '../hands/hand';
import { CAPSULE_JOINTS } from '../shadow/pure/shadow-projector';
import { LIT_RADIUS_M } from './candle-tint';
import { FADE_IN_S, FADE_OUT_S } from './hand-fade';

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
/** How far toward the warm colour a joint at the flame goes (the dots use the same 0.85-ish blend). */
const LIT_MIX = 0.85;

/** A colour as the linear red, green and blue the renderer mixes in (worked out once, not per frame). */
function rgb(hex: number): [number, number, number] {
  const c = new Color(hex);
  return [c.r, c.g, c.b];
}

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
  // The glove's colour and the colour it warms toward, as rgb in typed arrays (plain numbers, no Color objects, so update allocates nothing).
  private readonly baseRgb = Float64Array.from(rgb(0x2b2733));
  private readonly litRgb = Float64Array.from(rgb(0xb8793a));

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
      mesh.setColorAt(0, new Color(0x2b2733)); // makes the colour buffer now, not on the first frame
      this.object.add(mesh);
    }
  }

  private addFade(geometry: BufferGeometry, values: Float32Array): InstancedBufferAttribute {
    const attr = new InstancedBufferAttribute(values, 1);
    geometry.setAttribute('aFade', attr);
    return attr;
  }

  update(hands: readonly HandFrame[], dt: number, flame?: ArrayLike<number> | null, shown = true): void {
    // Everything below is plain arithmetic on local numbers written straight into the typed arrays. Calling a
    // helper with several decimal arguments allocates on some JavaScript engines (the Node version CI pins did,
    // about 5 KB a frame), so the matrices, colours, fade and flame tint are all worked out here.
    const hasFlame = flame !== null && flame !== undefined;
    const fx = hasFlame ? flame[0] : 0;
    const fy = hasFlame ? flame[1] : 0;
    const fz = hasFlame ? flame[2] : 0;
    const jm = this.joints.instanceMatrix.array as Float32Array;
    const bm = this.bones.instanceMatrix.array as Float32Array;
    const jc = (this.joints.instanceColor as InstancedBufferAttribute).array as Float32Array;
    const bc = (this.bones.instanceColor as InstancedBufferAttribute).array as Float32Array;
    const base = this.baseRgb;
    const lit = this.litRgb;
    let nj = 0;
    let nb = 0;
    for (const hand of hands) {
      const side = hand.handedness === 'left' ? 0 : 1;
      if (hand.tracked) {
        this.lastPositions[side].set(hand.positions);
        this.lastRadii[side].set(hand.radii);
        this.seen[side] = 1;
      }
      // Quick in, slower out (see hand-fade.ts), and out while the game is paused.
      const was = this.fade[side];
      const fade = hand.tracked && shown ? Math.min(1, was + dt / FADE_IN_S) : Math.max(0, was - dt / FADE_OUT_S);
      this.fade[side] = fade;
      // A lost or paused hand fades out where it was last fully tracked; one never seen draws nothing.
      if (fade <= 0 || this.seen[side] === 0) continue;
      const p = this.lastPositions[side];
      const r = this.lastRadii[side];
      for (let j = 0; j < JOINT_COUNT; j++) {
        const x = p[j * 3];
        const y = p[j * 3 + 1];
        const z = p[j * 3 + 2];
        const rj = r[j];
        const s = rj > MIN_RADIUS_M ? rj : MIN_RADIUS_M; // also catches a missing radius (NaN)
        const o = nj * 16;
        jm[o] = s;
        jm[o + 1] = 0;
        jm[o + 2] = 0;
        jm[o + 3] = 0;
        jm[o + 4] = 0;
        jm[o + 5] = s;
        jm[o + 6] = 0;
        jm[o + 7] = 0;
        jm[o + 8] = 0;
        jm[o + 9] = 0;
        jm[o + 10] = s;
        jm[o + 11] = 0;
        jm[o + 12] = x;
        jm[o + 13] = y;
        jm[o + 14] = z;
        jm[o + 15] = 1;
        // Warmed toward candlelight by how close the joint is to the flame (the same tint as candle-tint.ts).
        const dx = x - fx;
        const dy = y - fy;
        const dz = z - fz;
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const t = hasFlame && d < LIT_RADIUS_M ? (1 - d / LIT_RADIUS_M) * LIT_MIX : 0;
        jc[nj * 3] = base[0] + (lit[0] - base[0]) * t;
        jc[nj * 3 + 1] = base[1] + (lit[1] - base[1]) * t;
        jc[nj * 3 + 2] = base[2] + (lit[2] - base[2]) * t;
        this.jointFade[nj++] = fade;
      }
      for (let k = 0; k < BONES; k++) {
        const i = CAPSULE_JOINTS[k * 2] * 3;
        const j = CAPSULE_JOINTS[k * 2 + 1] * 3;
        const ax = p[i];
        const ay = p[i + 1];
        const az = p[i + 2];
        const dx = p[j] - ax;
        const dy = p[j + 1] - ay;
        const dz = p[j + 2] - az;
        const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (len < 1e-6) continue;
        // The rotation taking +Y to the bone's direction, as a quaternion (qx, qy, qz, qw), then the matrix
        // for rotation, scale (radius, length, radius) and the bone's midpoint, as three.js's compose does.
        const nx = dx / len;
        const ny = dy / len;
        const nz = dz / len;
        let qx = nz;
        let qy = 0;
        let qz = -nx;
        let qw = 1 + ny;
        if (qw < 1e-6) {
          qx = 1; // pointing straight down: a half turn about X
          qz = 0;
          qw = 0;
        }
        const ql = Math.sqrt(qx * qx + qy * qy + qz * qz + qw * qw);
        qx /= ql;
        qy /= ql;
        qz /= ql;
        qw /= ql;
        const r0 = r[i / 3];
        const r1 = r[j / 3];
        const rm = r0 < r1 ? r0 : r1;
        const s = rm > MIN_RADIUS_M ? rm : MIN_RADIUS_M;
        const x2 = qx + qx;
        const y2 = qy + qy;
        const z2 = qz + qz;
        const xx = qx * x2;
        const xy = qx * y2;
        const xz = qx * z2;
        const yy = qy * y2;
        const yz = qy * z2;
        const zz = qz * z2;
        const wx = qw * x2;
        const wy = qw * y2;
        const wz = qw * z2;
        const o = nb * 16;
        bm[o] = (1 - (yy + zz)) * s;
        bm[o + 1] = (xy + wz) * s;
        bm[o + 2] = (xz - wy) * s;
        bm[o + 3] = 0;
        bm[o + 4] = (xy - wz) * len;
        bm[o + 5] = (1 - (xx + zz)) * len;
        bm[o + 6] = (yz + wx) * len;
        bm[o + 7] = 0;
        bm[o + 8] = (xz + wy) * s;
        bm[o + 9] = (yz - wx) * s;
        bm[o + 10] = (1 - (xx + yy)) * s;
        bm[o + 11] = 0;
        const mx = ax + dx * 0.5;
        const my = ay + dy * 0.5;
        const mz = az + dz * 0.5;
        bm[o + 12] = mx;
        bm[o + 13] = my;
        bm[o + 14] = mz;
        bm[o + 15] = 1;
        const ex = mx - fx;
        const ey = my - fy;
        const ez = mz - fz;
        const e = Math.sqrt(ex * ex + ey * ey + ez * ez);
        const tb = hasFlame && e < LIT_RADIUS_M ? (1 - e / LIT_RADIUS_M) * LIT_MIX : 0;
        bc[nb * 3] = base[0] + (lit[0] - base[0]) * tb;
        bc[nb * 3 + 1] = base[1] + (lit[1] - base[1]) * tb;
        bc[nb * 3 + 2] = base[2] + (lit[2] - base[2]) * tb;
        this.boneFade[nb++] = fade;
      }
    }
    this.joints.count = nj;
    this.bones.count = nb;
    this.joints.instanceMatrix.needsUpdate = true;
    this.bones.instanceMatrix.needsUpdate = true;
    this.jointFadeAttr.needsUpdate = true;
    this.boneFadeAttr.needsUpdate = true;
    this.joints.instanceColor!.needsUpdate = true;
    this.bones.instanceColor!.needsUpdate = true;
  }

  dispose(): void {
    for (const mesh of [this.joints, this.bones]) {
      mesh.geometry.dispose();
      mesh.dispose();
    }
    (this.joints.material as MeshBasicMaterial).dispose();
  }
}
