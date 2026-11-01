// One short line of the story on the wall, written in ink: it waits a moment, then a small spark runs along the line and the
// letters appear behind it as if it were writing them, holds, and fades. Black like the captions and the hands' shadows. The
// cutscenes have their own captions (and a Skip button); this is the quiet narrator that speaks between them while the player
// plays, so it has no Skip. The line is drawn once and shown by a tiny shader (how far the ink has come), so writing costs
// nothing per frame but moving two quads.
import {
  AdditiveBlending,
  CanvasTexture,
  DoubleSide,
  Group,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  ShaderMaterial,
  SRGBColorSpace,
} from '@iwsdk/core';
import type { StagePlane } from './pure/stage-plane';
import { placeOnStage } from './stage-quad';
import { RenderOrder } from './pure/render-order';

/** In front of the hands' shadows (render order 2) and the cutscene captions' neighbours. */
const RENDER_ORDER = RenderOrder.sprite;
const LIFT_M = 0.005;
const WIDTH = 0.8; // of the stage width
const ASPECT = 8;
/** Of the stage's height, from the centre: the top of the wall, clear of the ledge the traveller walks on. */
const Y = 0.37;
const FADE_OUT_S = 0.9;
/** Seconds the spark takes per letter, and the least and most it takes to write a line. */
const WRITE_PER_CHAR_S = 0.075;
const WRITE_MIN_S = 1.4;
const WRITE_MAX_S = 3.4;
/** Seconds the spark glows on after the last letter. */
const SPARK_LINGER_S = 0.5;
const INK = '#1a1410';
const SPARK_SIZE_M = 0.05; // of the stage's width

const VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

// The ink shows left of the writing front, which leans a little (the pen's slant) and is ragged where it meets the cloth, so
// the edge reads as wet ink, not a wipe.
const FRAGMENT = /* glsl */ `
uniform sampler2D map;
uniform float progress;
uniform float x0;
uniform float x1;
uniform float opacity;
varying vec2 vUv;
void main() {
  vec4 t = texture2D(map, vUv);
  float front = mix(x0 - 0.03, x1 + 0.03, progress);
  float n = fract(sin(dot(vUv * vec2(317.0, 91.0), vec2(12.9898, 78.233))) * 43758.5453);
  float lean = (vUv.y - 0.5) * 0.04;
  float reveal = smoothstep(0.0, 0.03, front + lean - vUv.x + (n - 0.5) * 0.012);
  gl_FragColor = vec4(t.rgb, t.a * reveal * opacity);
  #include <colorspace_fragment>
}`;

interface Line {
  text: string;
  delay: number;
  hold: number;
}

export class StoryLineView {
  readonly group = new Group();
  private readonly quad: Mesh;
  private readonly ink: ShaderMaterial;
  private readonly spark: Mesh;
  private readonly sparkMat: MeshBasicMaterial;
  private readonly m = new Matrix4();
  private texture: CanvasTexture | null = null;
  /** A line that starts when the one on the wall is done. */
  private pending: Line | null = null;
  /** Seconds to wait before the line shows, seconds it takes to write, seconds it holds, and how long it has been up. */
  private wait = 0;
  private write = 1;
  private hold = 0;
  private t = -1;
  private time = 0;
  private readonly y: number;
  private readonly width: number;

  /**
   * @param options `y`: of the stage's height from the centre (default: the top of the wall); `width`: of the stage's width.
   * A second, smaller line lower down carries the captions.
   */
  constructor(options: { y?: number; width?: number } = {}) {
    this.y = options.y ?? Y;
    this.width = options.width ?? WIDTH;
    this.ink = new ShaderMaterial({
      uniforms: {
        map: { value: null },
        progress: { value: 0 },
        x0: { value: 0.05 },
        x1: { value: 0.95 },
        opacity: { value: 0 },
      },
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
    });
    this.quad = new Mesh(new PlaneGeometry(1, 1), this.ink);
    this.quad.renderOrder = RENDER_ORDER;
    this.quad.matrixAutoUpdate = false;
    this.quad.visible = false;

    // The spark that does the writing: a soft warm dot, added over the paper.
    let glow: HTMLCanvasElement | undefined;
    if (typeof document !== 'undefined') glow = document.createElement('canvas');
    let map: CanvasTexture | null = null;
    if (glow) {
      glow.width = glow.height = 64;
      const g = glow.getContext ? glow.getContext('2d') : null;
      if (g) {
        const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
        grad.addColorStop(0, 'rgba(255, 244, 214, 1)');
        grad.addColorStop(0.25, 'rgba(255, 190, 90, 0.7)');
        grad.addColorStop(1, 'rgba(255, 150, 50, 0)');
        g.fillStyle = grad;
        g.fillRect(0, 0, 64, 64);
        map = new CanvasTexture(glow);
        map.colorSpace = SRGBColorSpace;
      }
    }
    this.sparkMat = new MeshBasicMaterial({
      map,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
      opacity: 0,
    });
    this.spark = new Mesh(new PlaneGeometry(1, 1), this.sparkMat);
    this.spark.renderOrder = RENDER_ORDER + 1;
    this.spark.matrixAutoUpdate = false;
    this.spark.visible = false;
    this.group.add(this.quad, this.spark);
  }

  /** Whether a line is waiting or showing. */
  get active(): boolean {
    return this.t >= 0;
  }

  /** How far the ink has come along the line now, 0..1. */
  get progress(): number {
    return this.ink.uniforms.progress.value as number;
  }

  /**
   * Says `text` after `delay` seconds, for `hold` seconds once it is written. It replaces a line already up, unless `after` is
   * true, which waits for that line to finish first (and replaces any other line waiting).
   */
  say(text: string, delay = 0, hold = 5, after = false): void {
    if (after && this.t >= 0) {
      this.pending = { text, delay, hold };
      return;
    }
    this.pending = null; // a line that was waiting for the old one is stale now
    this.start({ text, delay, hold });
  }

  /** Takes the line away now (and any waiting after it). */
  clear(): void {
    this.t = -1;
    this.pending = null;
    this.ink.uniforms.opacity.value = 0;
    this.quad.visible = false;
    this.spark.visible = false;
  }

  /** Once per frame; `opacity` is the shadows' current opacity (the ink dims with the candle). */
  update(dt: number, stage: StagePlane, opacity: number): void {
    if (this.t < 0) return;
    const step = dt > 0 ? Math.min(dt, 0.1) : 0;
    this.t += step;
    this.time += step;
    const t = this.t - this.wait;
    const total = this.write + this.hold + FADE_OUT_S;
    if (t >= total) {
      const next = this.pending;
      this.pending = null;
      if (next) this.start(next);
      else this.clear();
      return;
    }
    const written = t < 0 ? 0 : Math.min(1, t / this.write);
    const fade = t < this.write + this.hold ? 1 : Math.max(0, (total - t) / FADE_OUT_S);
    this.ink.uniforms.progress.value = written;
    this.ink.uniforms.opacity.value = fade * opacity;
    this.quad.visible = t >= 0 && fade > 0;
    const w = stage.width * this.width;
    const h = w / ASPECT;
    if (this.quad.visible) placeOnStage(this.m, this.quad, stage, 0, stage.height * this.y, w, h, LIFT_M);
    // The spark runs along the baseline with the ink, with a small bob, and burns on a moment after the last letter.
    const x0 = this.ink.uniforms.x0.value as number;
    const x1 = this.ink.uniforms.x1.value as number;
    const sparkOn = t >= 0 && t < this.write + SPARK_LINGER_S && fade > 0;
    this.spark.visible = sparkOn;
    if (sparkOn) {
      const u = x0 + (x1 - x0) * written;
      const bob = Math.sin(this.time * 31) * 0.012 * h;
      const s = stage.width * SPARK_SIZE_M * (0.85 + 0.15 * Math.sin(this.time * 17));
      placeOnStage(
        this.m,
        this.spark,
        stage,
        (u - 0.5) * w,
        stage.height * this.y - 0.1 * h + bob,
        s,
        s,
        LIFT_M + 0.001,
      );
      this.sparkMat.opacity = Math.min(1, (this.write + SPARK_LINGER_S - t) / SPARK_LINGER_S) * opacity;
    }
  }

  dispose(): void {
    this.texture?.dispose();
    this.sparkMat.map?.dispose();
    this.quad.geometry.dispose();
    this.spark.geometry.dispose();
    this.ink.dispose();
    this.sparkMat.dispose();
  }

  private start(line: Line): void {
    this.texture?.dispose();
    const { texture, x0, x1 } = this.paint(line.text);
    this.texture = texture;
    this.ink.uniforms.map.value = texture;
    this.ink.uniforms.x0.value = x0;
    this.ink.uniforms.x1.value = x1;
    this.ink.uniforms.progress.value = 0;
    this.wait = Math.max(0, line.delay);
    this.hold = Math.max(0, line.hold);
    this.write = Math.min(WRITE_MAX_S, Math.max(WRITE_MIN_S, line.text.length * WRITE_PER_CHAR_S));
    this.t = 0;
  }

  /** Draws the line once and says where on the canvas (0..1 across) its first and last letters are. */
  private paint(text: string): { texture: CanvasTexture; x0: number; x1: number } {
    let canvas: HTMLCanvasElement | undefined;
    if (typeof document !== 'undefined') canvas = document.createElement('canvas');
    if (!canvas) canvas = { width: 1024, height: 128, getContext: () => null } as unknown as HTMLCanvasElement;
    canvas.width = 1024;
    canvas.height = 128;
    const g = canvas.getContext ? canvas.getContext('2d') : null;
    let x0 = 0.05;
    let x1 = 0.95;
    if (g) {
      g.fillStyle = INK;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      let size = 64;
      do {
        g.font = `700 ${size}px 'Cinzel Decorative', Georgia, serif`;
        size -= 4;
      } while (g.measureText(text).width > 980 && size > 20);
      g.fillText(text, 512, 66);
      const half = g.measureText(text).width / 2;
      x0 = Math.max(0, (512 - half) / 1024);
      x1 = Math.min(1, (512 + half) / 1024);
    }
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = 4;
    return { texture, x0, x1 };
  }
}
