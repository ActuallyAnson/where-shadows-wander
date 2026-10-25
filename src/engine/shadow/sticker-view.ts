// Draws the traveller's sticker (pure/traveller-mood.ts) over their head on the stage: one quad whose picture is swapped for
// the mood (sticker-art.ts), popping in, bobbing a little and fading out. The pictures are drawn once; update() allocates nothing.
import { CanvasTexture, DoubleSide, Group, Matrix4, Mesh, MeshBasicMaterial, PlaneGeometry } from '@iwsdk/core';
import { paintSticker } from './sticker-art';
import { STICKER_COUNT, type StickerId, type TravellerMood } from './pure/traveller-mood';
import type { StagePlane } from './pure/stage-plane';
import { SHADOW_RENDER_ORDER } from './shadow-renderer';
import { placeOnStage, crispTexture } from './stage-quad';

const LIFT_M = 0.006;
/** The sticker's width as a fraction of the stage's. */
const WIDTH = 0.085;
/** It hangs this far above the traveller's centre (of its own height), and bobs by a little of it. */
const ABOVE = 0.95;
const BOB = 0.05;
const TEXTURE_PX = 256;

function stickerTexture(id: StickerId): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = TEXTURE_PX;
  paintSticker(c.getContext('2d')!, TEXTURE_PX, id);
  return crispTexture(c);
}

export class StickerView {
  readonly group = new Group();
  private readonly mesh: Mesh;
  private readonly material: MeshBasicMaterial;
  private readonly pictures = Array.from({ length: STICKER_COUNT }, (_, i) => stickerTexture(i as StickerId));
  private readonly m = new Matrix4();

  constructor() {
    this.material = new MeshBasicMaterial({
      map: this.pictures[0],
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      toneMapped: false,
    });
    this.mesh = new Mesh(new PlaneGeometry(1, 1), this.material);
    this.mesh.matrixAutoUpdate = false;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = SHADOW_RENDER_ORDER + 1; // over the shadows, so a hand's shadow never hides it
    this.group.add(this.mesh);
    this.group.visible = false;
  }

  /** Call once per frame; `opacity` is the shadows' current opacity (fades with the light). */
  update(mood: TravellerMood, stage: StagePlane, opacity: number): void {
    this.group.visible = mood.active && opacity > 0.001;
    if (!this.group.visible) return;
    const w = stage.width * WIDTH * mood.scale;
    const bob = Math.sin(mood.age * 4.2) * BOB * w;
    // Kept on the wall: a traveller off its edge (a stage narrower than the puzzle) still shows its sticker at the edge.
    const lx = (stage.width - w) / 2,
      ly = (stage.height - w) / 2;
    const x = Math.max(-lx, Math.min(lx, mood.x));
    const y = Math.max(-ly, Math.min(ly, mood.y + w * ABOVE + bob));
    placeOnStage(this.m, this.mesh, stage, x, y, w, w, LIFT_M);
    const map = this.pictures[mood.sticker];
    if (this.material.map !== map) this.material.map = map;
    this.material.opacity = opacity * mood.alpha;
  }

  hide(): void {
    this.group.visible = false;
  }

  dispose(): void {
    for (const t of this.pictures) t.dispose();
    this.material.dispose();
    this.mesh.geometry.dispose();
  }
}
