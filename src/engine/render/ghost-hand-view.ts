// A ghost of a hand: a soft, pale, see-through hand drawn from a HandFrame, used at the end to show the player to cover the
// flame (stage/story/sleep-hint.ts, hands/cover-hand.ts). Drawn as the capsule hands are (a sphere per joint, a cylinder per
// bone), but in two passes: the first writes only depth, the second colour where the first was nearest, so the overlapping
// capsules read as one even shape at one opacity rather than a bright blotch at every joint. It draws in its own late layer
// (RenderOrder.ghost), after everything it could be seen against. Allocates nothing per frame.
import {
  Color,
  CylinderGeometry,
  Group,
  InstancedMesh,
  MeshBasicMaterial,
  SphereGeometry,
  type Material,
} from '@iwsdk/core';
import { JOINT_COUNT, type HandFrame } from '../hands/hand';
import { CAPSULE_JOINTS } from '../shadow/pure/shadow-projector';
import { RenderOrder } from '../shadow/pure/render-order';

const BONES = CAPSULE_JOINTS.length / 2;
/** The ghost's capsules against the hand's joint radii (a little slimmer, as the drawn gloves are). */
const RADIUS_SCALE = 0.8;
const MIN_RADIUS_M = 0.005;
/** Its colour: a pale warm light, like the dream at the start. */
const COLOUR = 0xffe2b8;
/** Its opacity at full strength. */
const MAX_OPACITY = 0.42;

export class GhostHandView {
  readonly object = new Group();
  private readonly geometries: [SphereGeometry, CylinderGeometry];
  private readonly depthMaterial: MeshBasicMaterial;
  private readonly colourMaterial: MeshBasicMaterial;
  /** [depth joints, depth bones, colour joints, colour bones]; each pair shares its matrices. */
  private readonly meshes: InstancedMesh[];

  constructor() {
    const sphere = new SphereGeometry(1, 12, 8);
    const cylinder = new CylinderGeometry(1, 1, 1, 10, 1, true);
    this.geometries = [sphere, cylinder];
    this.depthMaterial = new MeshBasicMaterial({ colorWrite: false, depthWrite: true, transparent: true });
    this.colourMaterial = new MeshBasicMaterial({
      color: new Color(COLOUR),
      transparent: true,
      opacity: 0,
      depthWrite: false,
      toneMapped: false,
    });
    const make = (geo: SphereGeometry | CylinderGeometry, mat: Material, count: number, order: number) => {
      const m = new InstancedMesh(geo, mat, count);
      m.frustumCulled = false;
      m.renderOrder = order;
      m.count = 0;
      this.object.add(m);
      return m;
    };
    const joints = make(sphere, this.depthMaterial, JOINT_COUNT, RenderOrder.ghost);
    const bones = make(cylinder, this.depthMaterial, BONES, RenderOrder.ghost);
    const cJoints = make(sphere, this.colourMaterial, JOINT_COUNT, RenderOrder.ghost + 0.01);
    const cBones = make(cylinder, this.colourMaterial, BONES, RenderOrder.ghost + 0.01);
    // The colour pass draws the depth pass's matrices.
    cJoints.instanceMatrix = joints.instanceMatrix;
    cBones.instanceMatrix = bones.instanceMatrix;
    this.meshes = [joints, bones, cJoints, cBones];
    this.object.visible = false;
  }

  /** Draws `hand` at `strength` (0 .. 1; 0 hides it). */
  update(hand: HandFrame, strength: number): void {
    if (strength <= 0.001 || !hand.tracked) {
      this.object.visible = false;
      return;
    }
    this.object.visible = true;
    this.colourMaterial.opacity = MAX_OPACITY * Math.min(1, strength);
    const [joints, bones, cJoints, cBones] = this.meshes;
    const p = hand.positions;
    const r = hand.radii;
    const jm = joints.instanceMatrix.array as Float32Array;
    for (let j = 0; j < JOINT_COUNT; j++) {
      const s = Math.max(MIN_RADIUS_M, r[j] * RADIUS_SCALE);
      const o = j * 16;
      jm.fill(0, o, o + 16);
      jm[o] = jm[o + 5] = jm[o + 10] = s;
      jm[o + 12] = p[j * 3];
      jm[o + 13] = p[j * 3 + 1];
      jm[o + 14] = p[j * 3 + 2];
      jm[o + 15] = 1;
    }
    const bm = bones.instanceMatrix.array as Float32Array;
    let nb = 0;
    for (let k = 0; k < BONES; k++) {
      const i = CAPSULE_JOINTS[k * 2];
      const j = CAPSULE_JOINTS[k * 2 + 1];
      const ax = p[i * 3];
      const ay = p[i * 3 + 1];
      const az = p[i * 3 + 2];
      const dx = p[j * 3] - ax;
      const dy = p[j * 3 + 1] - ay;
      const dz = p[j * 3 + 2] - az;
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (len < 1e-6) continue;
      // The turn taking +Y (the cylinder's axis) to the bone's direction.
      const nx = dx / len;
      const ny = dy / len;
      const nz = dz / len;
      let qx = nz;
      let qz = -nx;
      let qw = 1 + ny;
      if (qw < 1e-6) {
        qx = 1;
        qz = 0;
        qw = 0;
      }
      const ql = Math.sqrt(qx * qx + qz * qz + qw * qw);
      qx /= ql;
      qz /= ql;
      qw /= ql;
      const s = Math.max(MIN_RADIUS_M, Math.min(r[i], r[j]) * RADIUS_SCALE);
      const xx = 2 * qx * qx;
      const zz = 2 * qz * qz;
      const xz = 2 * qx * qz;
      const wx = 2 * qw * qx;
      const wz = 2 * qw * qz;
      const o = nb * 16;
      bm[o] = (1 - zz) * s;
      bm[o + 1] = wz * s;
      bm[o + 2] = xz * s;
      bm[o + 3] = 0;
      bm[o + 4] = -wz * len;
      bm[o + 5] = (1 - (xx + zz)) * len;
      bm[o + 6] = wx * len;
      bm[o + 7] = 0;
      bm[o + 8] = xz * s;
      bm[o + 9] = -wx * s;
      bm[o + 10] = (1 - xx) * s;
      bm[o + 11] = 0;
      bm[o + 12] = ax + dx * 0.5;
      bm[o + 13] = ay + dy * 0.5;
      bm[o + 14] = az + dz * 0.5;
      bm[o + 15] = 1;
      nb++;
    }
    joints.count = cJoints.count = JOINT_COUNT;
    bones.count = cBones.count = nb;
    joints.instanceMatrix.needsUpdate = true;
    bones.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    for (const g of this.geometries) g.dispose();
    this.depthMaterial.dispose();
    this.colourMaterial.dispose();
  }
}
