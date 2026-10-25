// Draws the kindred (pure/kindred.ts), a spirit fox, on the stage: one black quad with three poses (fox-art.ts) swapped as it
// moves, tilted a little into its climb or dive, and a shower of fairy sparkles (pure/sparkles.ts) from its tail on a second
// quad-per-mote mesh. Same black and render order as the hands' shadows. The textures are drawn once; update() moves things
// and allocates nothing.
import { CanvasTexture, DoubleSide, Group, Matrix4, Mesh, MeshBasicMaterial, PlaneGeometry } from '@iwsdk/core';
import { FOX_BOX, FOX_FRAMES, paintFox } from './fox-art';
import type { Kindred } from './pure/kindred';
import { SparkleLayer } from './sparkle-layer';
import type { StagePlane } from './pure/stage-plane';
import { SHADOW_RENDER_ORDER } from './shadow-renderer';
import { placeOnStage, crispTexture } from './stage-quad';

const LIFT_M = 0.003;
/** The fox's width as a fraction of the stage's. */
const WIDTH = 0.26;
/** How much of its climb or dive it tips into (1 would follow its path exactly). */
const TILT = 0.5;
/** Sparkles are born at the tail: this far behind the fox's centre (of its width) and a little above it (of its height). */
const TAIL_BEHIND = 0.42;
const TAIL_UP = 0.12;
/** Motes a second while it flies, and while it rests. */
const RATE_FLYING = 34;
const RATE_RESTING = 10;
const SPARKLE_OPACITY = 1;

function foxFrame(frame: number): CanvasTexture {
  const W = 420;
  const H = Math.round((W * FOX_BOX[1]) / FOX_BOX[0]);
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  paintFox(c.getContext('2d')!, W, H, frame);
  return crispTexture(c);
}

export class KindredView {
  readonly group = new Group();
  private readonly mesh: Mesh;
  private readonly material: MeshBasicMaterial;
  private readonly frames = Array.from({ length: FOX_FRAMES }, (_, i) => foxFrame(i));
  private readonly m = new Matrix4();
  private readonly layer = new SparkleLayer(5);
  private readonly sparkles = this.layer.sparkles;

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

    this.group.add(this.layer.mesh);
    this.group.visible = false;
  }

  /** Call once per frame while it is shown; `opacity` is the shadows' current opacity (fades with the light). */
  update(k: Kindred, stage: StagePlane, opacity: number, dt: number): void {
    this.group.visible = opacity > 0.001;
    if (!this.group.visible) {
      this.sparkles.clear();
      return;
    }
    const w = stage.width * WIDTH;
    const h = (w * FOX_BOX[1]) / FOX_BOX[0];
    const tilt = Math.atan2(k.vy, Math.max(Math.abs(k.vx), 0.04)) * TILT * k.facing;
    placeOnStage(this.m, this.mesh, stage, k.x, k.y, w * k.facing, h, LIFT_M, tilt);
    const map = this.frames[k.frame];
    if (this.material.map !== map) this.material.map = map;
    this.material.opacity = opacity;

    this.sparkles.update(
      dt,
      k.x - k.facing * w * TAIL_BEHIND,
      k.y + h * TAIL_UP,
      k.speed > 0.03 ? RATE_FLYING : RATE_RESTING,
    );
    this.layer.draw(stage, opacity * SPARKLE_OPACITY);
  }

  /** A burst of light from the fox's place (a puzzle was solved). */
  burst(k: Kindred, n = 28): void {
    this.sparkles.burst(k.x, k.y, n);
  }

  hide(): void {
    this.group.visible = false;
    this.sparkles.clear();
  }

  dispose(): void {
    for (const t of this.frames) t.dispose();
    this.material.dispose();
    this.mesh.geometry.dispose();
    this.layer.dispose();
  }
}
