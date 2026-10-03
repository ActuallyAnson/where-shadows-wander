// What the stand-in rig looks like (src/engine/shadow/pure/test-rig.ts): a
// sheet of paper for the stage, with a thin border, and a small flame for the
// lantern. Teammate B's stage renderer and lantern replace it.
import {
  BufferAttribute,
  BufferGeometry,
  Group,
  LineBasicMaterial,
  LineLoop,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  SphereGeometry,
} from '@iwsdk/core';
import type { StagePlane } from './pure/stage-plane';

/** The paper draws before the shadows (SHADOW_RENDER_ORDER = 2). */
const PAPER_RENDER_ORDER = 1;

export class TestStageView {
  readonly group = new Group();
  private readonly paper: Mesh;
  private readonly border: LineLoop;
  private readonly flame: Mesh;
  private readonly m = new Matrix4();

  constructor() {
    this.paper = new Mesh(
      new PlaneGeometry(1, 1),
      new MeshBasicMaterial({
        color: 0xf2e6c9,
        transparent: true,
        premultipliedAlpha: false,
        toneMapped: false,
        opacity: 0.85,
        depthWrite: false,
      }),
    );
    this.paper.renderOrder = PAPER_RENDER_ORDER;
    const corners = new Float32Array([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0]);
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(corners, 3));
    this.border = new LineLoop(g, new LineBasicMaterial({ color: 0x8a6d3b }));
    for (const o of [this.paper, this.border]) {
      o.matrixAutoUpdate = false;
      o.frustumCulled = false;
    }
    this.flame = new Mesh(new SphereGeometry(0.012, 12, 8), new MeshBasicMaterial({ color: 0xffd27a }));
    this.group.add(this.paper, this.border, this.flame);
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
    this.flame.position.set(lantern[0], lantern[1], lantern[2]);
    this.group.visible = true;
  }

  /** The stand-in flame (hidden where another lantern view is shown, e.g. the Hand Lab's). */
  set flameVisible(v: boolean) {
    this.flame.visible = v;
  }
}
