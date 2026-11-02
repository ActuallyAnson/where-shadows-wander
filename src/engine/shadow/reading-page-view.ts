// A page of the story's book, held low in front of the player while the night begins: the first thing the hands learn. It shows the
// flat hand (palm down, fingers together) that makes the first bridge, drawn in ink on cream paper with a line of words, and it
// fades in, stays, and fades out over the opening. Drawn once, a single quad; nothing is allocated per frame.
import { CanvasTexture, DoubleSide, Group, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace } from '@iwsdk/core';
import { RenderOrder } from './pure/render-order';

/** The page's size (metres): about the size of a small book held in the lap. */
const WIDTH = 0.36;
const HEIGHT = 0.27;
/** How far ahead of the head and how far below it it is held, and how far it is tilted back toward the face (radians from flat). */
const AHEAD_M = 0.42;
const BELOW_M = 0.4;
const TILT = 0.95;
const FADE_S = 1.2;

/** Paints the page (any canvas of 4 by 3): cream paper, a flat hand in ink, and what to do with it. */
export function paintReadingPage(g: CanvasRenderingContext2D, W: number, H: number): void {
  g.clearRect(0, 0, W, H);
  g.fillStyle = '#f1e4c8';
  g.fillRect(0, 0, W, H);
  const edge = g.createLinearGradient(0, 0, W, 0);
  edge.addColorStop(0, 'rgba(120, 80, 30, 0.35)');
  edge.addColorStop(0.08, 'rgba(120, 80, 30, 0)');
  edge.addColorStop(0.92, 'rgba(120, 80, 30, 0)');
  edge.addColorStop(1, 'rgba(120, 80, 30, 0.3)');
  g.fillStyle = edge;
  g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(60, 40, 20, 0.55)';
  g.lineWidth = Math.max(2, W / 200);
  g.strokeRect(W * 0.04, H * 0.05, W * 0.92, H * 0.9);
  // The flat hand, palm down: four fingers together and a thumb, as a shadow.
  g.fillStyle = '#1a1410';
  const hx = W * 0.5;
  const hy = H * 0.5;
  const fw = W * 0.062;
  g.beginPath();
  g.roundRect(hx - fw * 2.1, hy - H * 0.04, fw * 4.2, H * 0.22, W * 0.02);
  g.fill();
  const finger = [0.16, 0.2, 0.18, 0.13];
  for (let i = 0; i < 4; i++) {
    g.beginPath();
    g.roundRect(
      hx - fw * 2.1 + i * fw * 1.05,
      hy - H * 0.04 - H * finger[i],
      fw * 0.95,
      H * finger[i] + H * 0.06,
      fw * 0.4,
    );
    g.fill();
  }
  g.save();
  g.translate(hx - fw * 2.2, hy + H * 0.09);
  g.rotate(-0.9);
  g.beginPath();
  g.roundRect(-fw * 0.2, -fw * 0.5, fw * 2.1, fw, fw * 0.45);
  g.fill();
  g.restore();
  // The shadow of a bridge it makes, drawn faintly beneath: a plank across a gap.
  g.fillStyle = 'rgba(26, 20, 16, 0.18)';
  g.fillRect(W * 0.2, H * 0.8, W * 0.6, H * 0.025);
  g.fillRect(W * 0.12, H * 0.8, W * 0.08, H * 0.1);
  g.fillRect(W * 0.8, H * 0.8, W * 0.08, H * 0.1);
  g.fillStyle = '#1a1410';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `700 ${Math.round(H * 0.075)}px 'Cinzel Decorative', Georgia, serif`;
  g.fillText('Hold a flat hand to the light', W / 2, H * 0.14);
  g.font = `400 ${Math.round(H * 0.055)}px 'Cinzel Decorative', Georgia, serif`;
  g.fillText('and its shadow becomes a bridge', W / 2, H * 0.935 - H * 0.02);
}

export class ReadingPageView {
  readonly group = new Group();
  private readonly mesh: Mesh;
  private readonly mat: MeshBasicMaterial;
  private readonly texture: CanvasTexture;
  private t = -1;
  private total = 0;

  constructor() {
    let canvas: HTMLCanvasElement | undefined;
    if (typeof document !== 'undefined') canvas = document.createElement('canvas');
    if (!canvas) canvas = { width: 512, height: 384, getContext: () => null } as unknown as HTMLCanvasElement;
    canvas.width = 512;
    canvas.height = 384;
    const g = canvas.getContext ? canvas.getContext('2d') : null;
    if (g) paintReadingPage(g, 512, 384);
    this.texture = new CanvasTexture(canvas);
    this.texture.colorSpace = SRGBColorSpace;
    this.texture.anisotropy = 4;
    this.mat = new MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      opacity: 0,
      side: DoubleSide,
      toneMapped: false,
    });
    this.mesh = new Mesh(new PlaneGeometry(WIDTH, HEIGHT), this.mat);
    this.mesh.renderOrder = RenderOrder.readingPage;
    this.group.add(this.mesh);
    this.group.visible = false;
  }

  /** Whether the page is showing. */
  get showing(): boolean {
    return this.t >= 0;
  }

  /**
   * Holds the page low in front of the head, turned to face it, for `seconds` (with a fade at each end). `head` is the head's world
   * position and (`dirX`, `dirZ`) the way it faces along the floor.
   */
  show(head: Readonly<{ x: number; y: number; z: number }>, dirX: number, dirZ: number, seconds: number): void {
    const len = Math.sqrt(dirX * dirX + dirZ * dirZ) || 1;
    const fx = dirX / len;
    const fz = dirZ / len;
    this.group.position.set(head.x + fx * AHEAD_M, head.y - BELOW_M, head.z + fz * AHEAD_M);
    // Face the head (the plane's front is +z), then tip the top back toward the face.
    this.group.rotation.set(0, Math.atan2(-fx, -fz), 0);
    this.mesh.rotation.set(-Math.PI / 2 + TILT, 0, 0);
    this.total = Math.max(2 * FADE_S, seconds);
    this.t = 0;
    this.group.visible = true;
  }

  /** Takes the page away now. */
  clear(): void {
    this.t = -1;
    this.mat.opacity = 0;
    this.group.visible = false;
  }

  /** Once per frame. */
  update(dt: number): void {
    if (this.t < 0) return;
    this.t += dt > 0 ? Math.min(dt, 0.1) : 0;
    if (this.t >= this.total) {
      this.clear();
      return;
    }
    this.mat.opacity = Math.min(1, this.t / FADE_S, (this.total - this.t) / FADE_S);
  }

  dispose(): void {
    this.texture.dispose();
    this.mesh.geometry.dispose();
    this.mat.dispose();
  }
}
