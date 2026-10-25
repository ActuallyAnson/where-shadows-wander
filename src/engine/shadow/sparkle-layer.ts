// A layer of sparkle motes on the stage (pure/sparkles.ts): one mesh, four vertices a mote, positions and opacity rewritten
// each frame from the pool. Every fourth mote is a four-point star, the rest soft dots, all in warm black like the shadows.
// The fox's trail and the dust a hand shakes off a prop both use it. Nothing is allocated per frame.
import { BufferAttribute, BufferGeometry, CanvasTexture, DoubleSide, Mesh, MeshBasicMaterial } from '@iwsdk/core';
import { createSparkleOut, Sparkles, SPARKLE_MAX } from './pure/sparkles';
import type { StagePlane } from './pure/stage-plane';
import { SHADOW_RENDER_ORDER } from './shadow-renderer';
import { crispTexture } from './stage-quad';

const LIFT_M = 0.0035;

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
  return crispTexture(c);
}

export class SparkleLayer {
  readonly mesh: Mesh;
  readonly sparkles: Sparkles;
  private readonly motes = createSparkleOut();
  private readonly positions = new Float32Array(SPARKLE_MAX * 4 * 3);
  private readonly colours = new Float32Array(SPARKLE_MAX * 4 * 4);
  private readonly geometry = new BufferGeometry();
  private readonly sheet = sparkleSheet();

  constructor(seed = 5) {
    this.sparkles = new Sparkles(seed);
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
    this.mesh = new Mesh(
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
    this.mesh.matrixAutoUpdate = false;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = SHADOW_RENDER_ORDER;
  }

  /** Writes the motes' quads in world space (the mesh itself stays at the origin). */
  draw(stage: StagePlane, opacity: number): void {
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
        const x = cx + (c === 1 || c === 2 ? s : -s);
        const y = cy + (c === 2 || c === 3 ? s : -s);
        const v = (i * 4 + c) * 3;
        this.positions[v] = o[0] + r[0] * x + u[0] * y + nn[0] * LIFT_M;
        this.positions[v + 1] = o[1] + r[1] * x + u[1] * y + nn[1] * LIFT_M;
        this.positions[v + 2] = o[2] + r[2] * x + u[2] * y + nn[2] * LIFT_M;
        const k = (i * 4 + c) * 4;
        this.colours[k] = 1;
        this.colours[k + 1] = 1;
        this.colours[k + 2] = 1;
        this.colours[k + 3] = m.alpha[i] * opacity;
      }
    }
    (this.geometry.getAttribute('position') as BufferAttribute).needsUpdate = true;
    (this.geometry.getAttribute('color') as BufferAttribute).needsUpdate = true;
  }

  dispose(): void {
    this.sheet.dispose();
    this.geometry.dispose();
    (this.mesh.material as MeshBasicMaterial).dispose();
  }
}
