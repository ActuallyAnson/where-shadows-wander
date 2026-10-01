// Debug view: one small dot per tracked joint, so a tester can see hand tracking
// working once IWSDK's hand models are hidden. Plain three.js, one draw call.
import { InstancedMesh, Matrix4, MeshBasicMaterial, SphereGeometry } from '@iwsdk/core';
import { JOINT_COUNT, type HandFrame } from '../contracts/hand';

export class JointDots {
  readonly mesh: InstancedMesh;
  private readonly m = new Matrix4();

  constructor() {
    this.mesh = new InstancedMesh(
      new SphereGeometry(1, 8, 6),
      new MeshBasicMaterial({ color: 0xffb347 }),
      JOINT_COUNT * 2,
    );
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
  }

  update(hands: readonly HandFrame[]): void {
    let n = 0;
    for (const hand of hands) {
      if (!hand.tracked) continue;
      for (let j = 0; j < JOINT_COUNT; j++) {
        const s = Math.max(hand.radii[j] * 0.5, 0.003);
        const p = hand.positions;
        this.m.makeScale(s, s, s).setPosition(p[j * 3], p[j * 3 + 1], p[j * 3 + 2]);
        this.mesh.setMatrixAt(n++, this.m);
      }
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
