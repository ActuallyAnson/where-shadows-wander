// ?debug=shadow: draws what the collision solver gets, on the stage: each
// capsule's axis (red), each hand's outline (green), and every joint projected
// separately by three.js's own matrix maths (blue dots). At shadow size 1 the
// blue dots sit on the red lines' ends: a check of the projector's maths, stage
// coordinates and capsule indexing. (The shader draws the capsules themselves.)
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
import type { StagePlane } from './pure/stage-plane';

const LIFT_M = 0.003;
const HANDS: readonly Handedness[] = ['left', 'right'];

export class ShadowDebug {
  readonly group = new Group();
  private readonly capsules = segments(2 * CAPSULES_PER_HAND, 0xff3b30);
  private readonly outlines = segments(2 * OUTLINE_MAX, 0x34c759);
  private readonly joints: Points;
  private readonly m = new Matrix4();
  private readonly v = new Vector3();

  constructor() {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(2 * JOINT_COUNT * 3), 3));
    this.joints = new Points(g, new PointsMaterial({ color: 0x0a84ff, size: 0.006, depthTest: false }));
    for (const o of [this.capsules, this.outlines, this.joints]) {
      o.frustumCulled = false;
      o.renderOrder = 3;
      this.group.add(o);
    }
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
