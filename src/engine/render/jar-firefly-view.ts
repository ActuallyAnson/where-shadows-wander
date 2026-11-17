// The firefly's light in the room's jar on the desk (stage/story/jar-firefly.ts says how bright and where): a small green-gold
// glow, a LanternGlow facing the camera, wandering about the jar's middle. It follows the jar wherever the room layout puts it. Nothing allocated
// per frame.
import { Vector3 } from '@iwsdk/core';
import type { Object3D, Quaternion } from '@iwsdk/core';
import { LanternGlow } from '../shadow/lantern-glow';
import type { LanternLight } from '../shadow/pure/lantern-light';
import { FIREFLY_TINT } from '../stage/story/story-kit';

/** The glow's middle above the jar's base, metres (the jar is about 0.17 m tall). */
const JAR_MIDDLE_Y = 0.07;

export class JarFireflyView {
  readonly glow = new LanternGlow(0.1);
  private readonly light: LanternLight = {
    position: new Float64Array(3),
    lit: true,
    intensity: 0,
    color: new Float32Array(FIREFLY_TINT),
    flicker: 0,
  };
  private jar: Object3D | null = null;
  private readonly at = new Vector3();

  constructor() {
    this.glow.mesh.visible = false;
  }

  /** The room's jar (RoomModels' `jar` piece), once it has loaded; null if it is not there. */
  setJar(jar: Object3D | null): void {
    this.jar = jar;
  }

  /**
   * @param glow how bright, 0..1 (JarFirefly.glow)
   * @param x where it is in the jar, metres from its middle, in the jar's own axes (JarFirefly.x, y, z)
   */
  update(glow: number, x: number, y: number, z: number, cameraQuaternion: Readonly<Quaternion>): void {
    const jar = this.jar;
    this.glow.mesh.visible = jar !== null && glow > 0.001;
    if (!this.glow.mesh.visible || jar === null) return;
    this.at.set(x, JAR_MIDDLE_Y + y, z);
    jar.localToWorld(this.at);
    this.glow.mesh.position.copy(this.at);
    this.light.intensity = glow;
    this.glow.update(this.light, cameraQuaternion);
  }
}
