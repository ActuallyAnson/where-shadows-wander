// A small text panel in the scene for guided recordings on a headset
// (the Developer page's guided shapes recording). Page text isn't visible inside XR, so the prompt is
// drawn on a canvas texture on a plane in front of the wearer. It's placed
// once, not head-locked, so it stays put while the wearer looks at their hands.
import type { PresetName } from '../hands/synthetic-hand';
import { drawHandSample } from './hand-sample-draw';
import {
  CanvasTexture,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Quaternion,
  SRGBColorSpace,
  Vector3,
} from '@iwsdk/core';

const WIDTH_M = 0.4;
const HEIGHT_M = 0.2;
const DISTANCE_M = 0.6;
/** Below eye level, so it doesn't sit between the eyes and the hands. */
const DROP_M = 0.15;

export interface Orientation {
  x: number;
  y: number;
  z: number;
  w: number;
}

export class PromptPanel {
  readonly mesh: Mesh;
  private readonly canvas = document.createElement('canvas');
  private readonly texture: CanvasTexture;
  private readonly q = new Quaternion();
  private readonly forward = new Vector3();
  private lastText = '';
  private lastSeconds = -1;

  constructor() {
    this.canvas.width = 512;
    this.canvas.height = 256;
    this.texture = new CanvasTexture(this.canvas);
    this.texture.colorSpace = SRGBColorSpace;
    this.mesh = new Mesh(
      new PlaneGeometry(WIDTH_M, HEIGHT_M),
      new MeshBasicMaterial({ map: this.texture, transparent: true }),
    );
    this.mesh.visible = false;
  }

  get placed(): boolean {
    return this.mesh.visible;
  }

  /**
   * Places the panel in front of the head, level with the floor, facing it.
   * `head` and `orientation` are the viewer pose in XR reference space, so add
   * `mesh` to the XR origin (world.player), not the scene.
   */
  anchor(head: readonly number[], orientation: Orientation): void {
    this.q.set(orientation.x, orientation.y, orientation.z, orientation.w);
    this.forward.set(0, 0, -1).applyQuaternion(this.q);
    this.forward.y = 0;
    if (this.forward.lengthSq() < 1e-4) this.forward.set(0, 0, -1); // looking straight down
    this.forward.normalize();
    const y = head[1] - DROP_M;
    this.mesh.position.set(head[0] + this.forward.x * DISTANCE_M, y, head[2] + this.forward.z * DISTANCE_M);
    this.mesh.lookAt(head[0], y, head[2]);
    this.mesh.visible = true;
  }

  /** Takes the panel out of the scene until the next `anchor`. */
  hide(): void {
    this.mesh.visible = false;
  }

  /**
   * Shows `text` (first line large), a countdown and, when given, an example
   * picture of the shape on the left. Redraws only when the text or the second changes.
   */
  show(text: string, secondsLeft: number, sample: PresetName | null = null): void {
    const seconds = Math.ceil(Math.max(0, secondsLeft));
    if (text === this.lastText && seconds === this.lastSeconds) return;
    this.lastText = text;
    this.lastSeconds = seconds;
    const g = this.canvas.getContext('2d')!;
    const { width: w, height: h } = this.canvas;
    g.clearRect(0, 0, w, h);
    g.fillStyle = 'rgba(20, 22, 28, 0.88)';
    g.beginPath();
    // roundRect is Chrome 99+; a plain rectangle keeps older headset browsers working.
    if (typeof g.roundRect === 'function') g.roundRect(0, 0, w, h, 28);
    else g.rect(0, 0, w, h);
    g.fill();
    const [title, detail] = text.split('\n');
    // With a picture, it takes the left third and the text centres in the rest.
    const left = sample ? 170 : 0;
    if (sample) drawHandSample(g, sample, 95, h / 2, 170, '#f0a24a');
    const cx = left + (w - left) / 2,
      tw = w - left - 40;
    g.fillStyle = '#ece6d8';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `600 ${sample ? 38 : 46}px system-ui, sans-serif`;
    g.fillText(title, cx, detail ? 86 : h / 2 - 10, tw);
    if (detail) {
      g.fillStyle = '#a8a294';
      g.font = `${sample ? 22 : 28}px system-ui, sans-serif`;
      g.fillText(detail, cx, 150, tw);
    }
    if (seconds > 0) {
      g.fillStyle = '#f0a24a';
      g.font = '600 32px system-ui, sans-serif';
      g.fillText(String(seconds), cx, 212);
    }
    this.texture.needsUpdate = true;
  }
}
