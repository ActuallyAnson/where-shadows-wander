// Draws the kindred (pure/kindred.ts) on the stage: one black quad, three textures (wings up, level, down) swapped as it
// flaps, in the same black and at the same render order as the hands' shadows. The textures are drawn once; update() moves
// the quad, picks the texture and sets the opacity, and allocates nothing.
import { CanvasTexture, DoubleSide, Group, Matrix4, Mesh, MeshBasicMaterial, PlaneGeometry } from '@iwsdk/core';
import type { Kindred } from './pure/kindred';
import { PUPPETS } from './pure/puppets';
import type { StagePlane } from './pure/stage-plane';
import { SHADOW_RENDER_ORDER } from './shadow-renderer';
import { placeOnStage } from './stage-quad';

const LIFT_M = 0.003;
/** Its width as a fraction of the stage's. */
const WIDTH = 0.2;
/** Where the bird's wings fold from, in the bird's drawing. */
const HINGES: readonly (readonly [number, number])[] = [
  [-8, -4],
  [12, -4],
];
/** How far each frame stretches the wings: up as drawn, level, folded down past the body. */
const WING_SCALE: readonly number[] = [1, 0.12, -0.7];
/** The drawing's box, tall enough for the wings in every frame. */
const BOX = [-130, -110, 252, 190] as const;

function frameTexture(frame: number): CanvasTexture {
  const art = PUPPETS.bird;
  const W = 256;
  const H = Math.round((W * BOX[3]) / BOX[2]);
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  const sx = (W - 12) / BOX[2];
  const sy = (H - 12) / BOX[3];
  g.translate(6 - BOX[0] * sx, 6 - BOX[1] * sy);
  g.scale(sx, sy);
  g.fillStyle = '#000';
  g.shadowColor = '#000';
  g.shadowBlur = 4;
  g.fill(new Path2D(art.paths[0]));
  for (let i = 0; i < 2; i++) {
    const [hx, hy] = HINGES[i];
    g.save();
    g.translate(hx, hy);
    g.scale(1, WING_SCALE[frame]);
    g.translate(-hx, -hy);
    g.fill(new Path2D(art.paths[i + 1]));
    g.restore();
  }
  return new CanvasTexture(c);
}

export class KindredView {
  readonly group = new Group();
  private readonly mesh: Mesh;
  private readonly material: MeshBasicMaterial;
  private readonly frames = [frameTexture(0), frameTexture(1), frameTexture(2)];
  private readonly m = new Matrix4();

  constructor() {
    this.material = new MeshBasicMaterial({
      map: this.frames[1],
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      toneMapped: false,
    });
    this.mesh = new Mesh(new PlaneGeometry(1, 1), this.material);
    this.mesh.matrixAutoUpdate = false;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = SHADOW_RENDER_ORDER;
    this.group.add(this.mesh);
    this.group.visible = false;
  }

  /** Call once per frame while it is shown; `opacity` is the shadows' current opacity (fades with the light). */
  update(k: Kindred, stage: StagePlane, opacity: number): void {
    this.group.visible = opacity > 0.001;
    if (!this.group.visible) return;
    const w = stage.width * WIDTH;
    const h = (w * BOX[3]) / BOX[2];
    placeOnStage(this.m, this.mesh, stage, k.x, k.y, w * k.facing, h, LIFT_M);
    const map = this.frames[k.frame];
    if (this.material.map !== map) this.material.map = map;
    this.material.opacity = opacity;
  }

  hide(): void {
    this.group.visible = false;
  }

  dispose(): void {
    for (const t of this.frames) t.dispose();
    this.material.dispose();
    this.mesh.geometry.dispose();
  }
}
