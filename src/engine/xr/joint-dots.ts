// Debug view: one small dot per tracked joint, so a tester can see hand tracking
// working once IWSDK's hand models are hidden. Plain three.js, one draw call.
import { Color, InstancedMesh, Matrix4, MeshBasicMaterial, SphereGeometry } from '@iwsdk/core';
import { JOINT_COUNT, type HandFrame } from '../hands/hand';

export class JointDots {
  readonly mesh: InstancedMesh;
  private readonly m = new Matrix4();
  private readonly colors = { right: new Color(0xf09a3e), left: new Color(0x5aa0d8) };

  constructor() {
    // Drawn last and without a depth test, so the hand occluder (hand-occluder.ts) can't hide them.
    this.mesh = new InstancedMesh(
      new SphereGeometry(1, 8, 6),
      new MeshBasicMaterial({ depthTest: false }),
      JOINT_COUNT * 2,
    );
    this.mesh.renderOrder = 4;
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
  }

  update(hands: readonly HandFrame[]): void {
    let n = 0;
    for (const hand of hands) {
      if (hand.validJoints === 0) continue;
      for (let j = 0; j < JOINT_COUNT; j++) {
        const p = hand.positions;
        if (p[j * 3] === 0 && p[j * 3 + 1] === 0 && p[j * 3 + 2] === 0) continue;
        const r = hand.radii[j] || 0.01;
        const s = Math.max(r * 0.4, 0.006);
        this.m.makeScale(s, s, s).setPosition(p[j * 3], p[j * 3 + 1], p[j * 3 + 2]);
        this.mesh.setColorAt(n, this.colors[hand.handedness]);
        this.mesh.setMatrixAt(n++, this.m);
      }
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}
