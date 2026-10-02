// Debug view for the Hand Lab: a line along every bone, coloured per hand, so
// the joint dots read as a hand. One draw call, no per-frame allocations.
import { BufferAttribute, BufferGeometry, LineBasicMaterial, LineSegments } from '@iwsdk/core';
import { JOINT_COUNT, JOINT_PARENT, type HandFrame } from '../engine/hands/hand';

const BONES = JOINT_COUNT - 1; // every joint but the wrist has a parent
/** Extra lines across the knuckles, so the palm reads as a surface. */
// prettier-ignore
const PALM: readonly [number, number][] = [[2, 6], [6, 11], [11, 16], [16, 21], [5, 10], [10, 15], [15, 20]];
const SEGMENTS = BONES + PALM.length;
export const HAND_COLORS = { right: [0.94, 0.6, 0.24], left: [0.35, 0.63, 0.85] } as const;

export class HandBones {
  readonly mesh: LineSegments;
  private readonly positions = new Float32Array(2 * SEGMENTS * 2 * 3);
  private readonly colors = new Float32Array(2 * SEGMENTS * 2 * 3);
  private readonly geometry = new BufferGeometry();

  constructor() {
    this.geometry.setAttribute('position', new BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('color', new BufferAttribute(this.colors, 3));
    this.mesh = new LineSegments(this.geometry, new LineBasicMaterial({ vertexColors: true }));
    this.mesh.frustumCulled = false;
  }

  update(hands: readonly HandFrame[]): void {
    let v = 0;
    for (const hand of hands) {
      if (!hand.tracked) continue;
      const c = HAND_COLORS[hand.handedness];
      for (let s = 0; s < SEGMENTS; s++) {
        const a = s < BONES ? JOINT_PARENT[s + 1] : PALM[s - BONES][0];
        const b = s < BONES ? s + 1 : PALM[s - BONES][1];
        this.vertex(v++, hand.positions, a, c);
        this.vertex(v++, hand.positions, b, c);
      }
    }
    this.geometry.setDrawRange(0, v);
    (this.geometry.attributes.position as BufferAttribute).needsUpdate = true;
    (this.geometry.attributes.color as BufferAttribute).needsUpdate = true;
  }

  private vertex(v: number, p: Float32Array, joint: number, color: readonly number[]): void {
    for (let i = 0; i < 3; i++) {
      this.positions[v * 3 + i] = p[joint * 3 + i];
      this.colors[v * 3 + i] = color[i];
    }
  }
}
