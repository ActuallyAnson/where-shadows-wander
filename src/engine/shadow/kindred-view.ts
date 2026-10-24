// Draws the kindred (pure/kindred.ts) on the stage: one black quad, three textures (wings up, level, down) swapped as it
// flaps, in the same black and at the same render order as the hands' shadows. The textures are drawn once; update() moves
// the quad, picks the texture and sets the opacity, and allocates nothing.
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
import type { Kindred } from './pure/kindred';
import { PUPPETS } from './pure/puppets';
import type { StagePlane } from './pure/stage-plane';
import { createTrailVerts, Trail, TRAIL_POINTS, TRAIL_VERTS } from './pure/trail';
import { SHADOW_RENDER_ORDER } from './shadow-renderer';
import { placeOnStage } from './stage-quad';

const LIFT_M = 0.003;
/** The trail lies just under the bird, and how solid it is next to the bird. */
const TRAIL_LIFT_M = 0.0025;
const TRAIL_OPACITY = 0.7;
/** Its width at the head, as a fraction of the bird's height; it starts this far behind the bird's centre (of its width). */
const TRAIL_WIDTH = 0.65;
const TRAIL_BEHIND = 0.3;
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
  private readonly trail = new Trail();
  private readonly trailVerts = createTrailVerts();
  private readonly trailPositions = new Float32Array(TRAIL_VERTS * 3);
  private readonly trailColors = new Float32Array(TRAIL_VERTS * 4);
  private readonly trailGeometry = new BufferGeometry();
  private readonly trailMesh: Mesh;

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

    // The trail: a strip of triangles whose points are rewritten every frame, in black with a fading alpha.
    this.trailGeometry.setAttribute('position', new BufferAttribute(this.trailPositions, 3).setUsage(35048));
    this.trailGeometry.setAttribute('color', new BufferAttribute(this.trailColors, 4).setUsage(35048));
    const index = new Uint16Array((TRAIL_POINTS - 1) * 6);
    for (let i = 0; i < TRAIL_POINTS - 1; i++)
      index.set([i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2], i * 6);
    this.trailGeometry.setIndex(new BufferAttribute(index, 1));
    this.trailGeometry.setDrawRange(0, 0);
    this.trailMesh = new Mesh(
      this.trailGeometry,
      new MeshBasicMaterial({
        color: 0x000000,
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
        toneMapped: false,
      }),
    );
    this.trailMesh.matrixAutoUpdate = false;
    this.trailMesh.frustumCulled = false;
    this.trailMesh.renderOrder = SHADOW_RENDER_ORDER;
    this.group.add(this.trailMesh);
    this.group.visible = false;
  }

  /** Call once per frame while it is shown; `opacity` is the shadows' current opacity (fades with the light). */
  update(k: Kindred, stage: StagePlane, opacity: number, dt: number): void {
    this.group.visible = opacity > 0.001;
    if (!this.group.visible) {
      this.trail.clear();
      return;
    }
    const w = stage.width * WIDTH;
    const h = (w * BOX[3]) / BOX[2];
    placeOnStage(this.m, this.mesh, stage, k.x, k.y, w * k.facing, h, LIFT_M);
    const map = this.frames[k.frame];
    if (this.material.map !== map) this.material.map = map;
    this.material.opacity = opacity;
    this.drawTrail(k, stage, opacity, dt, w, h);
  }

  /** Records the path from the bird's tail and rewrites the strip, in world space (the mesh itself stays at the origin). */
  private drawTrail(k: Kindred, stage: StagePlane, opacity: number, dt: number, w: number, h: number): void {
    const tx = k.x - k.facing * w * TRAIL_BEHIND;
    this.trail.update(dt, tx, k.y);
    const n = this.trail.build(tx, k.y, h * TRAIL_WIDTH, this.trailVerts);
    const r = stage.right,
      u = stage.up,
      nn = stage.normal,
      o = stage.origin;
    const v = this.trailVerts;
    for (let i = 0; i < n; i++) {
      const x = v.x[i],
        y = v.y[i];
      this.trailPositions[i * 3] = o[0] + r[0] * x + u[0] * y + nn[0] * TRAIL_LIFT_M;
      this.trailPositions[i * 3 + 1] = o[1] + r[1] * x + u[1] * y + nn[1] * TRAIL_LIFT_M;
      this.trailPositions[i * 3 + 2] = o[2] + r[2] * x + u[2] * y + nn[2] * TRAIL_LIFT_M;
      this.trailColors[i * 4 + 3] = v.a[i] * TRAIL_OPACITY * opacity;
    }
    this.trailGeometry.setDrawRange(0, n > 2 ? (n / 2 - 1) * 6 : 0);
    (this.trailGeometry.getAttribute('position') as BufferAttribute).needsUpdate = true;
    (this.trailGeometry.getAttribute('color') as BufferAttribute).needsUpdate = true;
  }

  hide(): void {
    this.group.visible = false;
    this.trail.clear();
  }

  dispose(): void {
    for (const t of this.frames) t.dispose();
    this.material.dispose();
    this.mesh.geometry.dispose();
    this.trailGeometry.dispose();
    (this.trailMesh.material as MeshBasicMaterial).dispose();
  }
}
