// Soft warm light on the wall: a few round glows lying on the stage, one wide one for the solve bloom and one for each hand's
// near-miss. The texture is drawn once; set() moves and fades a glow and allocates nothing. They sit between the paper wall
// and the hands' shadows, so a shadow still reads black on top of them.
import { CanvasTexture, DoubleSide, Group, Matrix4, Mesh, MeshBasicMaterial, PlaneGeometry } from '@iwsdk/core';
import type { StagePlane } from './pure/stage-plane';
import { placeOnStage, crispTexture } from './stage-quad';

export const GLOW_SLOTS = 3;
const RENDER_ORDER = 1.8;
const LIFT_M = 0.0015;

function glowTexture(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const r = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  r.addColorStop(0, 'rgba(255,255,244,1)');
  r.addColorStop(0.35, 'rgba(255,244,196,0.75)');
  r.addColorStop(0.7, 'rgba(255,226,150,0.28)');
  r.addColorStop(1, 'rgba(255,215,130,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 256, 256);
  return crispTexture(c);
}

export class GlowView {
  readonly group = new Group();
  private readonly quads: Mesh[] = [];
  private readonly mats: MeshBasicMaterial[] = [];
  private readonly tex = glowTexture();
  private readonly m = new Matrix4();

  constructor() {
    const geo = new PlaneGeometry(1, 1);
    for (let i = 0; i < GLOW_SLOTS; i++) {
      const mat = new MeshBasicMaterial({
        map: this.tex,
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
        toneMapped: false,
        opacity: 0,
      });
      const q = new Mesh(geo, mat);
      q.matrixAutoUpdate = false;
      q.frustumCulled = false;
      q.renderOrder = RENDER_ORDER;
      q.visible = false;
      this.group.add(q);
      this.quads.push(q);
      this.mats.push(mat);
    }
  }

  /** Places glow `slot` at stage point (x, y), `radius` metres across the half-width, `alpha` 0..1 (0 hides it). */
  set(slot: number, stage: StagePlane, x: number, y: number, radius: number, alpha: number): void {
    const q = this.quads[slot];
    q.visible = alpha > 0.003;
    if (!q.visible) return;
    placeOnStage(this.m, q, stage, x, y, radius * 2, radius * 2, LIFT_M);
    this.mats[slot].opacity = Math.min(1, alpha);
  }

  hideAll(): void {
    for (const q of this.quads) q.visible = false;
  }

  dispose(): void {
    this.tex.dispose();
    for (const m of this.mats) m.dispose();
    this.quads[0]?.geometry.dispose();
  }
}
