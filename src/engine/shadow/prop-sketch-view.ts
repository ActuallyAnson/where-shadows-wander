// A faint painting of each prop on the paper, a little toward the light from its shadow, so the shadow is the shadow of something: a
// soft coloured shape (the same outline as the shadow, a little smaller and nearer the light) with a thin edge, under the black.
// Built when a puzzle's props are set (a puzzle load, so it may allocate), then only its opacity moves. It is faint on purpose: the
// shadows are still what the player reads, and the sketch is there to make them feel cast by real things.
import {
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  LineSegments,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
} from '@iwsdk/core';
import { createSilhouette, projectProp, type Prop } from './pure/prop-shadow';
import type { StagePlane } from './pure/stage-plane';

/** How much smaller the painting is than its shadow's outline, and how far it sits toward the light (metres, along x and y). */
const SHRINK = 0.82;
const TOWARD_LIGHT = [-0.03, 0.022] as const;
/** In front of the paper (render order 1) and behind the shadows (2); and how far off the paper, metres. */
const RENDER_ORDER = 1.5;
const LIFT_M = 0.0012;
/** Soft colours, one after another, for the props of a puzzle. */
const TINTS: readonly (readonly [number, number, number])[] = [
  [0.78, 0.55, 0.42],
  [0.55, 0.66, 0.5],
  [0.5, 0.58, 0.72],
  [0.76, 0.66, 0.4],
];

export class PropSketchView {
  readonly group = new Group();
  private readonly outline = createSilhouette();
  private fill: Mesh | null = null;
  private edge: LineSegments | null = null;
  private readonly fillMat = new MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: DoubleSide,
    toneMapped: false,
  });
  private readonly edgeMat = new LineBasicMaterial({
    color: 0x5a4030,
    transparent: true,
    opacity: 0,
    toneMapped: false,
  });
  private count = 0;

  constructor() {
    this.group.visible = false;
  }

  /** How many props have a painting now. */
  get props(): number {
    return this.count;
  }

  /** Paints the props of a puzzle (the same arguments as the shadows': scene-space props, the light, the stage and its blend). */
  setProps(props: readonly Prop[], light: Readonly<ArrayLike<number>>, stage: StagePlane, blend: number): void {
    this.clearMeshes();
    const pos: number[] = [];
    const col: number[] = [];
    const idx: number[] = [];
    const line: number[] = [];
    const r = stage.right,
      u = stage.up,
      n = stage.normal,
      o = stage.origin;
    const toWorld = (x: number, y: number, out: number[]) =>
      out.push(
        o[0] + r[0] * x + u[0] * y + n[0] * LIFT_M,
        o[1] + r[1] * x + u[1] * y + n[1] * LIFT_M,
        o[2] + r[2] * x + u[2] * y + n[2] * LIFT_M,
      );
    let count = 0;
    props.forEach((prop, k) => {
      const m = projectProp(prop, light as never, stage, blend, this.outline);
      if (m < 3) return;
      count++;
      let cx = 0;
      let cy = 0;
      for (let i = 0; i < m; i++) {
        cx += this.outline.points[i * 2];
        cy += this.outline.points[i * 2 + 1];
      }
      cx /= m;
      cy /= m;
      const tint = TINTS[k % TINTS.length];
      const base = pos.length / 3;
      for (let i = 0; i < m; i++) {
        const x = cx + (this.outline.points[i * 2] - cx) * SHRINK + TOWARD_LIGHT[0];
        const y = cy + (this.outline.points[i * 2 + 1] - cy) * SHRINK + TOWARD_LIGHT[1];
        toWorld(x, y, pos);
        col.push(tint[0], tint[1], tint[2]);
        toWorld(x, y, line);
        const j = (i + 1) % m;
        toWorld(
          cx + (this.outline.points[j * 2] - cx) * SHRINK + TOWARD_LIGHT[0],
          cy + (this.outline.points[j * 2 + 1] - cy) * SHRINK + TOWARD_LIGHT[1],
          line,
        );
      }
      // The outline is convex, so a fan from its first point fills it.
      for (let i = 1; i < m - 1; i++) idx.push(base, base + i, base + i + 1);
    });
    this.count = count;
    if (count === 0) {
      this.group.visible = false;
      return;
    }
    const fillGeo = new BufferGeometry();
    fillGeo.setAttribute('position', new Float32BufferAttribute(pos, 3));
    fillGeo.setAttribute('color', new Float32BufferAttribute(col, 3));
    fillGeo.setIndex(idx);
    this.fill = new Mesh(fillGeo, this.fillMat);
    this.fill.renderOrder = RENDER_ORDER;
    this.fill.frustumCulled = false;
    const edgeGeo = new BufferGeometry();
    edgeGeo.setAttribute('position', new Float32BufferAttribute(line, 3));
    this.edge = new LineSegments(edgeGeo, this.edgeMat);
    this.edge.renderOrder = RENDER_ORDER + 0.01;
    this.edge.frustumCulled = false;
    this.group.add(this.fill, this.edge);
    this.group.visible = true;
  }

  /** Once per frame: `opacity` is how strong the painting is (0 hides it); the fill is faint, the edge a little stronger. */
  update(opacity: number): void {
    this.fillMat.opacity = Math.min(1, Math.max(0, opacity)) * 0.4;
    this.edgeMat.opacity = Math.min(1, Math.max(0, opacity)) * 0.45;
    this.group.visible = this.count > 0 && opacity > 0.001;
  }

  /** Takes every painting away. */
  clear(): void {
    this.clearMeshes();
    this.count = 0;
    this.group.visible = false;
  }

  dispose(): void {
    this.clearMeshes();
    this.fillMat.dispose();
    this.edgeMat.dispose();
  }

  private clearMeshes(): void {
    for (const m of [this.fill, this.edge]) {
      if (!m) continue;
      this.group.remove(m);
      m.geometry.dispose();
    }
    this.fill = this.edge = null;
  }
}
