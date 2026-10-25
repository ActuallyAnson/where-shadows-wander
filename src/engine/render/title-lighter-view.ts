// Stylized ritual fire attached to the player's right hand during title / start.
// Belongs to presentation domain (src/engine/render).
//
// When entering VR, the room starts cold and unlit. The player's left hand is not drawn,
// and their right hand carries this handheld lighter/torch flame. Bringing it near the
// unlit candle wick ignites the candle, dissolves the title, and begins the game.
//
// Zero allocations per frame. All Three.js objects imported through @iwsdk/core.

import {
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  PointLight,
  SphereGeometry,
  type Quaternion,
} from '@iwsdk/core';
import { JOINT, type HandFrame } from '../hands/hand';
import { LanternGlow } from '../shadow/lantern-glow';
import type { LanternLight } from '../shadow/pure/lantern-light';

export class TitleLighterView {
  readonly group = new Group();
  readonly flame = new LanternGlow(0.12);
  readonly pointLight: PointLight;
  /** Live coordinates of the lighter flame tip in world space [x, y, z]. */
  readonly flamePosition = new Float64Array(3);

  private readonly stickGeometry: CylinderGeometry;
  private readonly headGeometry: SphereGeometry;
  private readonly stickMaterial: MeshStandardMaterial;
  private readonly headMaterial: MeshStandardMaterial;
  private readonly stickMesh: Mesh;
  private readonly headMesh: Mesh;

  private _visible = false;
  private readonly lightState: LanternLight = {
    position: new Float64Array(3),
    lit: true,
    intensity: 1.0,
    color: new Float32Array([1.0, 0.65, 0.28]),
    flicker: 0.1,
  };

  constructor() {
    // 1. Slender wooden lighter stick (length 0.06m, radius 0.003m)
    this.stickGeometry = new CylinderGeometry(0.003, 0.003, 0.06, 8);
    this.stickMaterial = new MeshStandardMaterial({
      color: 0x3d281a,
      roughness: 0.8,
    });
    this.stickMesh = new Mesh(this.stickGeometry, this.stickMaterial);
    this.stickMesh.position.set(0, 0.03, 0);

    // 2. Match head / torch brim
    this.headGeometry = new SphereGeometry(0.004, 8, 8);
    this.headMaterial = new MeshStandardMaterial({
      color: 0x8a2416,
      roughness: 0.6,
    });
    this.headMesh = new Mesh(this.headGeometry, this.headMaterial);
    this.headMesh.position.set(0, 0.06, 0);

    // 3. Flame Quad: sitting at the tip of the matchstick (Y = 0.065m)
    this.flame.mesh.position.set(0, 0.065, 0);

    // 4. Dynamic warm point light
    this.pointLight = new PointLight(0xffaa44, 0.85, 1.2, 2.0);
    this.pointLight.position.set(0, 0.065, 0);
    this.pointLight.castShadow = false;

    this.group.add(this.stickMesh, this.headMesh, this.flame.mesh, this.pointLight);
    this.group.visible = false;
  }

  get visible(): boolean {
    return this._visible;
  }

  set visible(val: boolean) {
    this._visible = val;
    this.group.visible = val;
    if (!val) {
      this.pointLight.intensity = 0;
    }
  }

  /**
   * Updates position to follow right hand index fingertip (or wrist/controller) and flickers the flame.
   * Zero per-frame allocations.
   */
  update(hand: HandFrame | null, cameraQuaternion: Quaternion, timeSeconds: number): void {
    if (!this._visible) return;

    if (hand && hand.tracked && hand.validJoints >= 5) {
      const p = hand.positions;
      // Prefer index fingertip, fallback to wrist
      const idx = hand.validJoints >= 20 ? JOINT['index-finger-tip'] * 3 : JOINT['wrist'] * 3;
      const x = p[idx];
      const y = p[idx + 1];
      const z = p[idx + 2];

      this.group.position.set(x, y, z);
      this.flamePosition[0] = x;
      this.flamePosition[1] = y + 0.065;
      this.flamePosition[2] = z;

      // Subtle organic flicker
      const flicker = 0.88 + 0.12 * Math.sin(timeSeconds * 14.0) * Math.cos(timeSeconds * 7.7);
      this.lightState.intensity = flicker * 1.15;
      this.flame.update(this.lightState, cameraQuaternion);
      this.pointLight.intensity = flicker * 0.85;
    }
  }

  dispose(): void {
    this.stickGeometry.dispose();
    this.headGeometry.dispose();
    this.stickMaterial.dispose();
    this.headMaterial.dispose();
  }
}
