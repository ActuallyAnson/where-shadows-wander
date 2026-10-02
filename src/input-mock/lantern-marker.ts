// Hand Lab view of the stand-in lantern: a small glowing flame, and a wire
// sphere showing the cover-flame radius that fills as a closed hand covers it.
import { Color, Group, Mesh, MeshBasicMaterial, SphereGeometry } from '@iwsdk/core';
import type { Vec3 } from '../engine/hands/hand';

const IDLE = new Color(0x6b5a35);
const FULL = new Color(0xf0a24a);

export class LanternMarker {
  readonly group = new Group();
  private readonly ring: MeshBasicMaterial;

  constructor(position: Readonly<Vec3>, coverRadiusM: number) {
    const flame = new Mesh(new SphereGeometry(0.012, 12, 8), new MeshBasicMaterial({ color: 0xffd27a }));
    this.ring = new MeshBasicMaterial({ color: IDLE.clone(), wireframe: true, transparent: true, opacity: 0.5 });
    const ring = new Mesh(new SphereGeometry(coverRadiusM, 16, 10), this.ring);
    this.group.add(flame, ring);
    this.group.position.set(position[0], position[1], position[2]);
  }

  /** 0..1 of the cover-flame hold: the wire sphere turns from dim to orange. */
  setProgress(progress: number): void {
    this.ring.color.copy(IDLE).lerp(FULL, Math.min(Math.max(progress, 0), 1));
    this.ring.opacity = 0.5 + 0.5 * progress;
  }
}
