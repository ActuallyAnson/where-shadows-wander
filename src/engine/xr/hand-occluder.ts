// Keeps the player's real hands visible in front of the stage. In passthrough the
// stage paper and the shadow are drawn over the camera image, so without this they
// would cover a real hand held between the player's eyes and the stage (which is
// where the hands are all the time). The occluder draws each hand as joint spheres
// and bone cylinders into the depth buffer only (no colour), before the
// transparent paper and shadow: their fragments behind a hand then fail the depth
// test and leave the passthrough image showing through.
// Plain three.js, two draw calls, nothing allocated per frame.
import {
  CylinderGeometry,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  Quaternion,
  SphereGeometry,
  Vector3,
} from '@iwsdk/core';
import { JOINT_COUNT, type HandFrame } from '../hands/hand';
import { CAPSULE_JOINTS } from '../shadow/pure/shadow-projector';

/** The occluder is a little fatter than the tracked hand, so a real finger's edge isn't clipped by its own shadow. */
const PAD = 1.2;
const MIN_RADIUS_M = 0.006;
const BONES = CAPSULE_JOINTS.length / 2;
const UP = new Vector3(0, 1, 0);

export class HandOccluder {
  /** Joint spheres, then bone cylinders; add both to the scene. */
  readonly meshes: readonly [InstancedMesh, InstancedMesh];
  enabled = true;
  private readonly joints: InstancedMesh;
  private readonly bones: InstancedMesh;
  private readonly m = new Matrix4();
  private readonly q = new Quaternion();
  private readonly a = new Vector3();
  private readonly b = new Vector3();
  private readonly d = new Vector3();
  private readonly mid = new Vector3();
  private readonly scale = new Vector3();

  constructor() {
    const material = new MeshBasicMaterial({ colorWrite: false });
    this.joints = new InstancedMesh(new SphereGeometry(1, 8, 6), material, JOINT_COUNT * 2);
    this.bones = new InstancedMesh(new CylinderGeometry(1, 1, 1, 8, 1, false), material, BONES * 2);
    for (const mesh of [this.joints, this.bones]) {
      mesh.frustumCulled = false;
      mesh.count = 0;
      mesh.renderOrder = -1; // opaque pass, before everything that tests against it
    }
    this.meshes = [this.joints, this.bones];
  }

  update(hands: readonly HandFrame[]): void {
    let nj = 0;
    let nb = 0;
    if (this.enabled) {
      for (const hand of hands) {
        if (!hand.tracked) continue;
        const p = hand.positions;
        const r = hand.radii;
        for (let j = 0; j < JOINT_COUNT; j++) {
          const s = Math.max((r[j] || 0) * PAD, MIN_RADIUS_M); // `|| 0`: a source with no radii (NaN) still gets an occluder
          this.m.makeScale(s, s, s).setPosition(p[j * 3], p[j * 3 + 1], p[j * 3 + 2]);
          this.joints.setMatrixAt(nj++, this.m);
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
          const s = Math.max((Math.min(r[i], r[j]) || 0) * PAD, MIN_RADIUS_M);
          this.scale.set(s, len, s);
          this.m.compose(this.mid, this.q, this.scale);
          this.bones.setMatrixAt(nb++, this.m);
        }
      }
    }
    this.joints.count = nj;
    this.bones.count = nb;
    this.joints.instanceMatrix.needsUpdate = true;
    this.bones.instanceMatrix.needsUpdate = true;
  }
}
