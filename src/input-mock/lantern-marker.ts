// Hand Lab view of the stand-in lantern: a small glowing flame, and a wire
// sphere showing the cover-flame radius that fills as a closed hand covers it.
import { Color, Group, Mesh, MeshBasicMaterial, SphereGeometry } from '@iwsdk/core';
import type { Quaternion } from '@iwsdk/core';
import type { Vec3 } from '../engine/hands/hand';
import { LanternGlow } from '../engine/shadow/lantern-glow';
import type { LanternLight } from '../engine/shadow/pure/lantern-light';

const IDLE = new Color(0x6b5a35);
const FULL = new Color(0xf0a24a);

export class LanternMarker {
  readonly group = new Group();
  private readonly ring: MeshBasicMaterial;
  private readonly flame = new LanternGlow();

  constructor(position: Readonly<Vec3>, coverRadiusM: number) {
    this.ring = new MeshBasicMaterial({ color: IDLE.clone(), wireframe: true, transparent: true, opacity: 0.5 });
    const ring = new Mesh(new SphereGeometry(coverRadiusM, 16, 10), this.ring);
    this.group.add(this.flame.mesh, ring);
    this.group.position.set(position[0], position[1], position[2]);
  }

  /** The flame's glow follows the flickering light. */
  setLight(light: Readonly<LanternLight>, cameraQuaternion: Readonly<Quaternion>): void {
    this.flame.update(light, cameraQuaternion);
  }

  /** 0..1 of the cover-flame hold: the wire sphere turns from dim to orange. */
  setProgress(progress: number): void {
    this.ring.color.copy(IDLE).lerp(FULL, Math.min(Math.max(progress, 0), 1));
    this.ring.opacity = 0.5 + 0.5 * progress;
  }
}
