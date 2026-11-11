// Debug view: one small dot per tracked joint, so a tester can see hand tracking
// working once IWSDK's hand models are hidden. Plain three.js, one draw call.
import { Color, InstancedMesh, Matrix4, MeshBasicMaterial, SphereGeometry } from '@iwsdk/core';
import { JOINT_COUNT, type HandFrame } from '../hands/hand';
import { litAmount } from './candle-tint';

export class JointDots {
  readonly mesh: InstancedMesh;
  private readonly m = new Matrix4();
  private readonly colors = { right: new Color(0xf09a3e), left: new Color(0x5aa0d8) };
  private readonly litColor = new Color(0xffdf80); // warm bright candlelight
  private readonly scratchColor = new Color();

  constructor() {
    // Drawn last and without a depth test, so nothing in the room can hide them.
    this.mesh = new InstancedMesh(
      new SphereGeometry(1, 8, 6),
      new MeshBasicMaterial({ depthTest: false }),
      JOINT_COUNT * 2,
    );
    this.mesh.renderOrder = 4;
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
  }

  update(hands: readonly HandFrame[], flamePos?: ArrayLike<number> | null): void {
    let n = 0;
    const fx = flamePos ? flamePos[0] : 0;
    const fy = flamePos ? flamePos[1] : 0;
    const fz = flamePos ? flamePos[2] : 0;
    const hasFlame = flamePos !== null && flamePos !== undefined;

    for (const hand of hands) {
      if (hand.validJoints === 0) continue;
      const baseColor = this.colors[hand.handedness];
      for (let j = 0; j < JOINT_COUNT; j++) {
        const p = hand.positions;
        const x = p[j * 3];
        const y = p[j * 3 + 1];
        const z = p[j * 3 + 2];
        if (x === 0 && y === 0 && z === 0) continue;
        const r = hand.radii[j] || 0.01;
        let s = Math.max(r * 0.4, 0.006);

        if (hasFlame) {
          const t = litAmount(x, y, z, fx, fy, fz);
          if (t > 0) {
            // Joint is near candlelight: brighten and warm up!
            this.scratchColor.copy(baseColor).lerp(this.litColor, t * 0.9);
            s *= 1.0 + t * 0.35;
            this.mesh.setColorAt(n, this.scratchColor);
          } else {
            this.mesh.setColorAt(n, baseColor);
          }
        } else {
          this.mesh.setColorAt(n, baseColor);
        }

        this.m.makeScale(s, s, s).setPosition(x, y, z);
        this.mesh.setMatrixAt(n++, this.m);
      }
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}
