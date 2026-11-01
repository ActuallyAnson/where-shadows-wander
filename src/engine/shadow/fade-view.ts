// A soft fade to black and back, for moving between the room and a story scene without a hard cut. In a headset the fade has to
// follow the head, so it is a small black sphere around the eyes (seen from inside, drawn over everything) that is moved to the head
// each frame; its opacity eases to a target over a given time. Nothing is allocated per frame.
import { BackSide, Group, Mesh, MeshBasicMaterial, SphereGeometry } from '@iwsdk/core';
import { RenderOrder } from './pure/render-order';

export class FadeView {
  readonly group = new Group();
  private readonly mat: MeshBasicMaterial;
  private readonly sphere: Mesh;
  private from = 0;
  private target = 0;
  private seconds = 0;
  private t = 0;
  private onDone: (() => void) | null = null;
  private level = 0;

  constructor() {
    this.mat = new MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0,
      side: BackSide,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    // Close round the eyes, but beyond the near clipping plane, and big enough that turning the head never shows its edge.
    this.sphere = new Mesh(new SphereGeometry(0.4, 12, 8), this.mat);
    this.sphere.renderOrder = RenderOrder.fade;
    this.sphere.frustumCulled = false;
    this.sphere.visible = false;
    this.group.add(this.sphere);
  }

  /** How dark the screen is now (0 clear .. 1 black). */
  get alpha(): number {
    return this.level;
  }

  /** Whether a fade is still running. */
  get fading(): boolean {
    return this.t < this.seconds;
  }

  /** Eases the darkness to `target` (0..1) over `seconds`, then calls `done` (once). A fade running is replaced (its `done` is dropped). */
  fadeTo(target: number, seconds: number, done?: () => void): void {
    this.from = this.level;
    this.target = target < 0 ? 0 : target > 1 ? 1 : target;
    this.seconds = Math.max(0, seconds);
    this.t = 0;
    this.onDone = done ?? null;
    if (this.seconds === 0) this.finish();
  }

  /** Goes black now (no fade), for a cut that is already hidden. */
  setBlack(on: boolean): void {
    this.seconds = 0;
    this.t = 0;
    this.onDone = null;
    this.level = on ? 1 : 0;
    this.apply();
  }

  /** Once per frame, with where the head is (world). */
  update(dt: number, head: Readonly<{ x: number; y: number; z: number }>): void {
    if (this.level > 0) this.sphere.position.set(head.x, head.y, head.z);
    if (this.t < this.seconds) {
      this.t += dt > 0 ? Math.min(dt, 0.1) : 0;
      if (this.t >= this.seconds) this.finish();
      else {
        const s = this.t / this.seconds;
        this.level = this.from + (this.target - this.from) * (s * s * (3 - 2 * s));
        this.apply();
      }
    }
  }

  dispose(): void {
    this.sphere.geometry.dispose();
    this.mat.dispose();
  }

  private finish(): void {
    this.t = this.seconds;
    this.level = this.target;
    this.apply();
    const done = this.onDone;
    this.onDone = null;
    done?.();
  }

  private apply(): void {
    this.mat.opacity = this.level;
    this.sphere.visible = this.level > 0.001;
  }
}
