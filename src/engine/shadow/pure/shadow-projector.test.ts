import { describe, expect, it } from 'vitest';
import { createHandFrame, JOINT_COUNT, type Vec3 } from '../../hands/hand';
import { CAPSULE_STRIDE } from '../../hands/hand-shadow';
import { PRESETS, writeHandPose } from '../../hands/synthetic-hand';
import { CAPSULE_JOINTS, ShadowProjector } from './shadow-projector';
import { createStagePlane } from './stage-plane';

const stage = createStagePlane(); // 0.4 × 0.3 m, centred at the origin, facing +Z
const LANTERN: Vec3 = [0, 0, 0.6];

function hands(rightWrist: Vec3 = [0, -0.05, 0.3]) {
  return {
    left: writeHandPose(PRESETS.fist, [-0.1, -0.05, 0.3], createHandFrame('left')),
    right: writeHandPose(PRESETS.spread, rightWrist, createHandFrame('right')),
  };
}

function inside(poly: Float32Array, n: number, x: number, y: number): boolean {
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const cross =
      (poly[j * 2] - poly[i * 2]) * (y - poly[i * 2 + 1]) - (poly[j * 2 + 1] - poly[i * 2 + 1]) * (x - poly[i * 2]);
    if (cross < -1e-6) return false;
  }
  return true;
}

describe('shadow projector', () => {
  it('fills both hands and reuses its arrays', () => {
    const p = new ShadowProjector();
    const capsules = p.shadows.right.capsules;
    p.update(hands(), stage, LANTERN);
    expect(p.shadows.left.active && p.shadows.right.active).toBe(true);
    expect(p.shadows.right.capsules).toBe(capsules);
    expect(p.shadows.right.onStage).toBe(true);
  });

  it('leaves an untracked or partly tracked hand inactive', () => {
    const p = new ShadowProjector();
    const h = hands();
    h.right.validJoints = 24;
    h.left.tracked = false;
    p.update(h, stage, LANTERN);
    expect(p.shadows.left.active).toBe(false);
    expect(p.shadows.right.active).toBe(false);
  });

  it('knows when a shadow is off the stage', () => {
    const p = new ShadowProjector();
    p.update(hands([2, 0, 0.3]), stage, LANTERN);
    expect(p.shadows.right.onStage).toBe(false);
    p.update(hands([0.25, 0, 0.3]), stage, LANTERN); // partly over the right edge
    expect(p.shadows.right.onStage).toBe(true);
  });

  it('puts every joint inside the outline, and capsule ends on the projected joints', () => {
    const p = new ShadowProjector();
    p.update(hands(), stage, LANTERN);
    const s = p.shadows.right;
    for (let j = 0; j < JOINT_COUNT; j++)
      expect(inside(s.outline, s.outlineCount, s.joints[j * 2], s.joints[j * 2 + 1]), `joint ${j}`).toBe(true);
    for (let c = 0; c < CAPSULE_JOINTS.length / 2; c++) {
      const a = CAPSULE_JOINTS[c * 2],
        o = c * CAPSULE_STRIDE;
      expect(s.capsules[o]).toBe(s.joints[a * 2]);
      expect(s.capsules[o + 4]).toBeGreaterThan(0);
    }
  });

  it('blurs edges more the further the hand is from the stage', () => {
    const near = new ShadowProjector(),
      far = new ShadowProjector();
    near.update(hands([0, -0.05, 0.1]), stage, LANTERN);
    far.update(hands([0, -0.05, 0.4]), stage, LANTERN);
    expect(far.shadows.right.blur[0]).toBeGreaterThan(near.shadows.right.blur[0]);
    expect(far.shadows.right.distanceM).toBeGreaterThan(near.shadows.right.distanceM);
  });
});
