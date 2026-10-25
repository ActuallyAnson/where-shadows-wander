// Draws the shadow rabbits (pure/hopper.ts) on the stage: black quads like the hands' shadows, one per hop in progress (a
// hand each), with three poses (rabbit-art.ts). Textures are drawn once; update() moves quads and allocates nothing.
import { DoubleSide, Group, Matrix4, Mesh, MeshBasicMaterial, PlaneGeometry } from '@iwsdk/core';
import type { CanvasTexture } from '@iwsdk/core';
import { Hopper } from './pure/hopper';
import type { StagePlane } from './pure/stage-plane';
import { paintRabbit, RABBIT_BOX, RABBIT_FRAMES } from './rabbit-art';
import { SHADOW_RENDER_ORDER } from './shadow-renderer';
import { crispTexture, placeOnStage } from './stage-quad';

const LIFT_M = 0.0032;
/** The rabbit's width as a fraction of the stage's. */
const WIDTH = 0.18;

function frameTexture(frame: number): CanvasTexture {
  const W = 360;
  const H = Math.round((W * RABBIT_BOX[1]) / RABBIT_BOX[0]);
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  paintRabbit(c.getContext('2d')!, W, H, frame);
  return crispTexture(c);
}

export class RabbitView {
  readonly group = new Group();
  /** One rabbit a hand. */
  readonly hoppers = [new Hopper(), new Hopper()];
  private readonly quads: Mesh[] = [];
  private readonly mats: MeshBasicMaterial[] = [];
  private readonly frames = Array.from({ length: RABBIT_FRAMES }, (_, i) => frameTexture(i));
  private readonly m = new Matrix4();

  constructor() {
    const geo = new PlaneGeometry(1, 1);
    for (let i = 0; i < this.hoppers.length; i++) {
      const mat = new MeshBasicMaterial({
        map: this.frames[0],
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
        toneMapped: false,
      });
      const q = new Mesh(geo, mat);
      q.matrixAutoUpdate = false;
      q.frustumCulled = false;
      q.renderOrder = SHADOW_RENDER_ORDER;
      q.visible = false;
      this.group.add(q);
      this.quads.push(q);
      this.mats.push(mat);
    }
  }

  /** A rabbit hops out at (x, y), `hand` 0 or 1. */
  spawn(hand: number, x: number, y: number, facing: 1 | -1): void {
    this.hoppers[hand].spawn(x, y, facing);
  }

  /** Once per frame; `opacity` is the shadows' current opacity (fades with the light). */
  update(dt: number, stage: StagePlane, opacity: number): void {
    const w = stage.width * WIDTH;
    const h = (w * RABBIT_BOX[1]) / RABBIT_BOX[0];
    for (let i = 0; i < this.hoppers.length; i++) {
      const hop = this.hoppers[i];
      hop.update(dt, stage.width / 2);
      const q = this.quads[i];
      q.visible = hop.active && hop.alpha > 0.01;
      if (!q.visible) continue;
      placeOnStage(this.m, q, stage, hop.x, hop.y + h * 0.3, w * hop.facing, h, LIFT_M);
      const map = this.frames[hop.frame];
      if (this.mats[i].map !== map) this.mats[i].map = map;
      this.mats[i].opacity = opacity * hop.alpha;
    }
  }

  dispose(): void {
    for (const t of this.frames) t.dispose();
    for (const m of this.mats) m.dispose();
    this.quads[0]?.geometry.dispose();
  }
}
