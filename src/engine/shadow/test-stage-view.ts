// What the stand-in rig looks like (src/engine/shadow/pure/test-rig.ts): a
// sheet of paper for the stage, with a thin border, and a small flame for the
// lantern. Teammate B's stage renderer and lantern replace it.
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Group,
  LineBasicMaterial,
  LineLoop,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
} from '@iwsdk/core';
import type { Quaternion } from '@iwsdk/core';
import { LanternGlow } from './lantern-glow';
import type { LanternLight } from './pure/lantern-light';
import type { StagePlane } from './pure/stage-plane';

const PAPER = new Color(0xf2e6c9);

/** The paper draws before the shadows (SHADOW_RENDER_ORDER = 2). */
const PAPER_RENDER_ORDER = 1;

export class TestStageView {
  readonly group = new Group();
  private readonly paper: Mesh;
  private readonly border: LineLoop;
  private readonly paperMaterial: MeshStandardMaterial;
  private readonly flame = new LanternGlow();
  private readonly lit = new Color();
  private readonly m = new Matrix4();

  constructor() {
    this.paperMaterial = new MeshStandardMaterial({
      color: PAPER,
      roughness: 0.85,
      metalness: 0.05,
      transparent: true,
      premultipliedAlpha: false,
      toneMapped: false,
      opacity: 0.95,
      depthWrite: false,
      side: DoubleSide,
    });
    this.paper = new Mesh(new PlaneGeometry(1, 1), this.paperMaterial);
    this.paper.renderOrder = PAPER_RENDER_ORDER;
    const corners = new Float32Array([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0]);
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(corners, 3));
    this.border = new LineLoop(g, new LineBasicMaterial({ color: 0x8a6d3b }));
    for (const o of [this.paper, this.border]) {
      o.matrixAutoUpdate = false;
      o.frustumCulled = false;
    }
    this.group.add(this.paper, this.border, this.flame.mesh);
    this.group.visible = false;
  }

  /** Places the paper on the stage and the flame at the lantern. Call when either moves. */
  place(stage: StagePlane, lantern: Readonly<ArrayLike<number>>): void {
    const r = stage.right,
      u = stage.up,
      n = stage.normal,
      o = stage.origin;
    // prettier-ignore
    this.m.set(
      r[0] * stage.width, u[0] * stage.height, n[0], o[0],
      r[1] * stage.width, u[1] * stage.height, n[1], o[1],
      r[2] * stage.width, u[2] * stage.height, n[2], o[2],
      0, 0, 0, 1,
    );
    this.paper.matrix.copy(this.m);
    this.border.matrix.copy(this.m);
    this.paper.matrixWorldNeedsUpdate = this.border.matrixWorldNeedsUpdate = true;
    this.flame.mesh.position.set(lantern[0], lantern[1], lantern[2]);
    this.group.visible = true;
  }

  /** The stand-in flame (hidden where another lantern view is shown, e.g. the Hand Lab's). */
  set flameVisible(v: boolean) {
    this.flame.mesh.visible = v;
  }

  /**
   * The lantern's flame warms the paper, while the PointLight provides the dynamic illumination.
   * `occlusion` (0..1) dims the paper down to ambient level when hands cup/smother the flame.
   */
  applyLight(light: Readonly<LanternLight>, cameraQuaternion: Readonly<Quaternion>, occlusion = 1.0): void {
    // Tint toward the flame's colour so the paper warms with the flame.
    this.lit.setRGB(light.color[0], light.color[1], light.color[2]);
    const brightness = light.lit ? Math.max(0.04, occlusion * (0.15 + 0.85 * light.intensity)) : 0.04;
    this.paperMaterial.color.copy(PAPER).lerp(this.lit, 0.12).multiplyScalar(brightness);
    this.flame.update(light, cameraQuaternion);
  }
}
