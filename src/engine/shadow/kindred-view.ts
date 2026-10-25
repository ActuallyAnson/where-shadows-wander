// Draws the kindred (pure/kindred.ts), a spirit fox, on the stage: one black quad with three poses (fox-art.ts) swapped as it
// moves, tilted a little into its climb or dive, and a shower of fairy sparkles (pure/sparkles.ts) from its tail on a second
// quad-per-mote mesh. Same black and render order as the hands' shadows. The textures are drawn once; update() moves things
// and allocates nothing.
import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  DoubleSide,
  Group,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
} from '@iwsdk/core';
import { FOX_BOX, FOX_FRAMES, paintFox } from './fox-art';
import type { Kindred } from './pure/kindred';
import { createSparkleOut, Sparkles, SPARKLE_MAX } from './pure/sparkles';
import type { StagePlane } from './pure/stage-plane';
import { SHADOW_RENDER_ORDER } from './shadow-renderer';
import { placeOnStage } from './stage-quad';

const LIFT_M = 0.003;
const SPARKLE_LIFT_M = 0.0035;
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
  return new CanvasTexture(c);
}

/** A sheet with a soft round dot on the left and a four-point star on the right, in warm black. */
function sparkleSheet(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 64;
  const g = c.getContext('2d')!;
  const dot = g.createRadialGradient(32, 32, 0, 32, 32, 28);
  dot.addColorStop(0, 'rgba(24,14,6,1)');
  dot.addColorStop(0.35, 'rgba(24,14,6,0.9)');
  dot.addColorStop(1, 'rgba(24,14,6,0)');
  g.fillStyle = dot;
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = 'rgb(24,14,6)';
  g.beginPath();
  g.moveTo(96, 4);
  g.quadraticCurveTo(99, 29, 124, 32);
  g.quadraticCurveTo(99, 35, 96, 60);
  g.quadraticCurveTo(93, 35, 68, 32);
  g.quadraticCurveTo(93, 29, 96, 4);
  g.fill();
  return new CanvasTexture(c);
}

export class KindredView {
  readonly group = new Group();
  private readonly mesh: Mesh;
  private readonly material: MeshBasicMaterial;
  private readonly frames = Array.from({ length: FOX_FRAMES }, (_, i) => foxFrame(i));
  private readonly m = new Matrix4();
  private readonly sparkles = new Sparkles(5);
  private readonly motes = createSparkleOut();
  private readonly positions = new Float32Array(SPARKLE_MAX * 4 * 3);
  private readonly colours = new Float32Array(SPARKLE_MAX * 4 * 4);
  private readonly geometry = new BufferGeometry();
  private readonly sheet = sparkleSheet();
  private readonly sparkleMesh: Mesh;

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

    // Sparkles: four vertices a mote, positions and alpha rewritten each frame. Every fourth mote is a star, the rest dots.
    const uvs = new Float32Array(SPARKLE_MAX * 4 * 2);
    const index = new Uint16Array(SPARKLE_MAX * 6);
    for (let i = 0; i < SPARKLE_MAX; i++) {
      const u0 = i % 4 === 0 ? 0.5 : 0;
      uvs.set([u0, 0, u0 + 0.5, 0, u0 + 0.5, 1, u0, 1], i * 8);
      index.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3], i * 6);
    }
    this.geometry.setAttribute('position', new BufferAttribute(this.positions, 3).setUsage(35048));
    this.geometry.setAttribute('color', new BufferAttribute(this.colours, 4).setUsage(35048));
    this.geometry.setAttribute('uv', new BufferAttribute(uvs, 2));
    this.geometry.setIndex(new BufferAttribute(index, 1));
    this.sparkleMesh = new Mesh(
      this.geometry,
      new MeshBasicMaterial({
        map: this.sheet,
        color: 0xffffff,
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
        toneMapped: false,
      }),
    );
    this.sparkleMesh.matrixAutoUpdate = false;
    this.sparkleMesh.frustumCulled = false;
    this.sparkleMesh.renderOrder = SHADOW_RENDER_ORDER;
    this.group.add(this.sparkleMesh);
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
    this.drawSparkles(stage, opacity);
  }

  /** Writes the motes' quads in world space (the mesh itself stays at the origin). */
  private drawSparkles(stage: StagePlane, opacity: number): void {
    this.sparkles.fill(this.motes);
    const r = stage.right,
      u = stage.up,
      nn = stage.normal,
      o = stage.origin;
    const m = this.motes;
    for (let i = 0; i < SPARKLE_MAX; i++) {
      const s = m.size[i];
      const cx = m.x[i],
        cy = m.y[i];
      for (let c = 0; c < 4; c++) {
        // Corners: (-,-), (+,-), (+,+), (-,+) in the stage's own right/up plane.
        const x = cx + (c === 1 || c === 2 ? s : -s);
        const y = cy + (c === 2 || c === 3 ? s : -s);
        const v = (i * 4 + c) * 3;
        this.positions[v] = o[0] + r[0] * x + u[0] * y + nn[0] * SPARKLE_LIFT_M;
        this.positions[v + 1] = o[1] + r[1] * x + u[1] * y + nn[1] * SPARKLE_LIFT_M;
        this.positions[v + 2] = o[2] + r[2] * x + u[2] * y + nn[2] * SPARKLE_LIFT_M;
        const k = (i * 4 + c) * 4;
        this.colours[k] = 1;
        this.colours[k + 1] = 1;
        this.colours[k + 2] = 1;
        this.colours[k + 3] = m.alpha[i] * SPARKLE_OPACITY * opacity;
      }
    }
    (this.geometry.getAttribute('position') as BufferAttribute).needsUpdate = true;
    (this.geometry.getAttribute('color') as BufferAttribute).needsUpdate = true;
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
    this.sheet.dispose();
    this.material.dispose();
    this.mesh.geometry.dispose();
    this.geometry.dispose();
    (this.sparkleMesh.material as MeshBasicMaterial).dispose();
  }
}
