// ?debug=shadow: draws what the collision solver gets, on the stage: each
// capsule's axis (red), each hand's outline (green), and every joint projected
// separately by three.js's own matrix maths (blue dots). At shadow size 1 the
// blue dots sit on the red lines' ends: a check of the projector's maths, stage
// coordinates and capsule indexing. (The shader draws the capsules themselves.)
// Also the entity colliders (`updateColliders`): a circle of each live entity's radius at its position, coloured by
// kind, drawn from A's EntityStore, so what the solver collides with can be seen against what the hands give it.
// No allocation per frame.
import {
  BufferAttribute,
  BufferGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
  Matrix4,
  Points,
  PointsMaterial,
  Vector3,
} from '@iwsdk/core';
import { JOINT_COUNT, type HandFrame, type Handedness } from '../hands/hand';
import { CAPSULES_PER_HAND, CAPSULE_STRIDE, OUTLINE_MAX, type HandShadow } from '../hands/hand-shadow';
import { KIND_COUNT } from '../sim/entity-kinds';
import type { EntityStore } from '../sim/entity-store';
import type { StagePlane } from './pure/stage-plane';

const LIFT_M = 0.003;
const HANDS: readonly Handedness[] = ['left', 'right'];

/** Line segments in each collider circle, and how many circles are drawn (the rest of a crowd is left out). */
const CIRCLE_SEGMENTS = 20;
export const MAX_COLLIDER_CIRCLES = 192;
const CIRCLE_COS = new Float64Array(CIRCLE_SEGMENTS + 1).map((_, i) => Math.cos((i / CIRCLE_SEGMENTS) * Math.PI * 2));
const CIRCLE_SIN = new Float64Array(CIRCLE_SEGMENTS + 1).map((_, i) => Math.sin((i / CIRCLE_SEGMENTS) * Math.PI * 2));
/** One colour per kind (r, g, b), repeating if a kind is added without a colour here. */
const KIND_RGB = new Float32Array([
  0.49,
  0.78,
  0.89, // traveller
  0.69,
  0.54,
  0.41, // rock
  0.31,
  0.64,
  0.85, // raindrop
  0.6,
  0.63,
  0.71, // crow
  0.91,
  0.85,
  0.77, // rabbit
  0.88,
  0.48,
  0.25, // fox
  0.95,
  0.88,
  0.42, // firefly
]);

export class ShadowDebug {
  readonly group = new Group();
  private readonly capsules = segments(2 * CAPSULES_PER_HAND, 0xff3b30);
  private readonly outlines = segments(2 * OUTLINE_MAX, 0x34c759);
  private readonly joints: Points;
  private readonly colliders: LineSegments;
  private readonly m = new Matrix4();
  private readonly v = new Vector3();

  constructor() {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(2 * JOINT_COUNT * 3), 3));
    this.joints = new Points(g, new PointsMaterial({ color: 0x0a84ff, size: 0.006, depthTest: false }));
    const cg = new BufferGeometry();
    cg.setAttribute('position', new BufferAttribute(new Float32Array(MAX_COLLIDER_CIRCLES * CIRCLE_SEGMENTS * 6), 3));
    cg.setAttribute('color', new BufferAttribute(new Float32Array(MAX_COLLIDER_CIRCLES * CIRCLE_SEGMENTS * 6), 3));
    this.colliders = new LineSegments(cg, new LineBasicMaterial({ vertexColors: true, depthTest: false }));
    this.colliders.visible = false;
    this.capsules.visible = this.outlines.visible = this.joints.visible = false;
    for (const o of [this.capsules, this.outlines, this.joints, this.colliders]) {
      o.frustumCulled = false;
      o.renderOrder = 3;
      this.group.add(o);
    }
  }

  /** Shows or hides the hand-shadow views (capsules, outline, projected joints) or the entity colliders. */
  setVisible(part: 'capsules' | 'colliders', on: boolean): void {
    if (part === 'colliders') this.colliders.visible = on;
    else this.capsules.visible = this.outlines.visible = this.joints.visible = on;
  }

  get capsulesVisible(): boolean {
    return this.capsules.visible;
  }

  get collidersVisible(): boolean {
    return this.colliders.visible;
  }

  /** Draws a circle for each live entity (up to MAX_COLLIDER_CIRCLES), in stage space. No allocation. */
  updateColliders(store: EntityStore, stage: StagePlane): void {
    const pos = this.colliders.geometry.attributes.position as BufferAttribute;
    const col = this.colliders.geometry.attributes.color as BufferAttribute;
    let v = 0;
    let circles = 0;
    for (let slot = 0; slot < store.capacity && circles < MAX_COLLIDER_CIRCLES; slot++) {
      if (!store.alive[slot]) continue;
      circles++;
      const cx = store.x[slot];
      const cy = store.y[slot];
      const r = store.radius[slot];
      const k = (store.kind[slot] % KIND_COUNT) * 3;
      const red = KIND_RGB[k % KIND_RGB.length];
      const green = KIND_RGB[(k + 1) % KIND_RGB.length];
      const blue = KIND_RGB[(k + 2) % KIND_RGB.length];
      for (let i = 0; i < CIRCLE_SEGMENTS; i++) {
        this.stagePoint(stage, cx + r * CIRCLE_COS[i], cy + r * CIRCLE_SIN[i], pos, v);
        col.setXYZ(v++, red, green, blue);
        this.stagePoint(stage, cx + r * CIRCLE_COS[i + 1], cy + r * CIRCLE_SIN[i + 1], pos, v);
        col.setXYZ(v++, red, green, blue);
      }
    }
    this.colliders.geometry.setDrawRange(0, v);
    pos.needsUpdate = col.needsUpdate = true;
  }

  /** @param matrix the shadow matrix the projector used this frame (column-major). */
  update(
    shadows: Readonly<Record<Handedness, HandShadow>>,
    hands: Readonly<Record<Handedness, HandFrame>>,
    stage: StagePlane,
    matrix: Float64Array,
  ): void {
    let c = 0,
      o = 0,
      j = 0;
    const cap = this.capsules.geometry.attributes.position as BufferAttribute;
    const out = this.outlines.geometry.attributes.position as BufferAttribute;
    const pts = this.joints.geometry.attributes.position as BufferAttribute;
    this.m.fromArray(matrix);
    for (let h = 0; h < HANDS.length; h++) {
      const s = shadows[HANDS[h]];
      if (!s.active) continue;
      for (let k = 0; k < CAPSULES_PER_HAND; k++) {
        const i = k * CAPSULE_STRIDE;
        this.stagePoint(stage, s.capsules[i], s.capsules[i + 1], cap, c++);
        this.stagePoint(stage, s.capsules[i + 2], s.capsules[i + 3], cap, c++);
      }
      for (let k = 0; k < s.outlineCount; k++) {
        const next = (k + 1) % s.outlineCount;
        this.stagePoint(stage, s.outline[k * 2], s.outline[k * 2 + 1], out, o++);
        this.stagePoint(stage, s.outline[next * 2], s.outline[next * 2 + 1], out, o++);
      }
      // Independent check: three.js projects each joint with the same matrix (no capsule code involved).
      const p = hands[HANDS[h]].positions;
      for (let k = 0; k < JOINT_COUNT; k++) {
        this.v.set(p[k * 3], p[k * 3 + 1], p[k * 3 + 2]).applyMatrix4(this.m);
        const n = stage.normal;
        pts.setXYZ(j++, this.v.x + n[0] * LIFT_M, this.v.y + n[1] * LIFT_M, this.v.z + n[2] * LIFT_M);
      }
    }
    this.capsules.geometry.setDrawRange(0, c);
    this.outlines.geometry.setDrawRange(0, o);
    this.joints.geometry.setDrawRange(0, j);
    cap.needsUpdate = out.needsUpdate = pts.needsUpdate = true;
  }

  private stagePoint(stage: StagePlane, x: number, y: number, attr: BufferAttribute, i: number): void {
    const o = stage.origin,
      r = stage.right,
      u = stage.up,
      n = stage.normal;
    attr.setXYZ(
      i,
      o[0] + r[0] * x + u[0] * y + n[0] * LIFT_M,
      o[1] + r[1] * x + u[1] * y + n[1] * LIFT_M,
      o[2] + r[2] * x + u[2] * y + n[2] * LIFT_M,
    );
  }
}

function segments(maxSegments: number, color: number): LineSegments {
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(maxSegments * 2 * 3), 3));
  return new LineSegments(g, new LineBasicMaterial({ color, depthTest: false }));
}
