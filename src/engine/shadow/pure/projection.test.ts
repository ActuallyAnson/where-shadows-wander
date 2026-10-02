import { describe, expect, it } from 'vitest';
import { createHandFrame, type Vec3 } from '../../hands/hand';
import { clonePose, PRESETS, writeHandPose } from '../../hands/synthetic-hand';
import { magnification, projectToStage, shadowMatrix } from './projection';
import { ShadowProjector } from './shadow-projector';
import { createStagePlane, type MutableStagePlane } from './stage-plane';

/** A wall facing +Z (toward the player), `d` metres in front of the lantern at the origin. */
function wall(d: number): MutableStagePlane {
  const s = createStagePlane();
  s.origin.set([0, 0, -d]);
  s.width = s.height = 4;
  return s;
}
const LANTERN: Vec3 = [0, 0, 0];
const m = new Float64Array(16);
const xy = new Float64Array(2);

/** An open hand facing the wall (palm toward -Z), 0.3 m in front of the lantern. */
function handFacingWall() {
  const pose = clonePose(PRESETS.spread);
  pose.pitchDeg = 90; // fingers up, palm toward the wall
  return writeHandPose(pose, [0, -0.08, -0.3], createHandFrame('right'));
}

/** The shadow's width along the stage's right axis, radii included. */
function shadowWidth(stage: MutableStagePlane, k: number): number {
  const p = new ShadowProjector({ blend: k });
  const hand = handFacingWall();
  p.update({ left: createHandFrame('left'), right: hand }, stage, LANTERN);
  const b = p.shadows.right.bounds;
  return b[2] - b[0];
}

function trueWidth(): number {
  const h = handFacingWall();
  let min = Infinity,
    max = -Infinity;
  for (let j = 0; j < 25; j++) {
    min = Math.min(min, h.positions[j * 3] - h.radii[j]);
    max = Math.max(max, h.positions[j * 3] + h.radii[j]);
  }
  return max - min;
}

describe('shadow projection', () => {
  it('leaves points on the stage where they are, for any blend', () => {
    const stage = wall(2);
    for (const k of [0, 0.5, 0.9, 1]) {
      shadowMatrix(stage, [0.1, 0.2, 0.1], k, m);
      projectToStage(m, stage, 0.3, -0.2, -2, xy);
      expect(xy[0]).toBeCloseTo(0.3, 9);
      expect(xy[1]).toBeCloseTo(-0.2, 9);
    }
  });

  it('is a ray from the lantern at k = 0, and straight along the normal at k = 1', () => {
    const stage = wall(2);
    shadowMatrix(stage, LANTERN, 0, m);
    projectToStage(m, stage, 0.1, 0.05, -0.5, xy); // a quarter of the way: 4× further out on the wall
    expect(xy[0]).toBeCloseTo(0.4, 9);
    expect(xy[1]).toBeCloseTo(0.2, 9);
    shadowMatrix(stage, LANTERN, 1, m);
    projectToStage(m, stage, 0.1, 0.05, -0.5, xy);
    expect(xy[0]).toBeCloseTo(0.1, 9);
    expect(xy[1]).toBeCloseTo(0.05, 9);
  });

  it('gives the true hand width at k = 1', () => {
    // Each capsule uses the mean radius of its two joints, so a fingertip capsule is about 1 mm
    // wider than the tip itself: allow 3 mm in all.
    expect(Math.abs(shadowWidth(wall(2), 1) - trueWidth())).toBeLessThan(0.003);
  });

  it('keeps the shadow within ±10 % of its 2 m size for walls 1–3 m away at k = 0.9', () => {
    const at2 = shadowWidth(wall(2), 0.9);
    for (const d of [1, 1.5, 2, 2.5, 3]) {
      const ratio = shadowWidth(wall(d), 0.9) / at2;
      expect(ratio, `${d} m`).toBeGreaterThan(0.9);
      expect(ratio, `${d} m`).toBeLessThan(1.1);
    }
  });

  it('swings far more without the blend (k = 0), so the guarantee depends on it', () => {
    const at2 = shadowWidth(wall(2), 0);
    expect(shadowWidth(wall(3), 0) / at2).toBeGreaterThan(1.3);
    expect(shadowWidth(wall(1), 0) / at2).toBeLessThan(0.7);
  });

  it('magnifies by D / (D - h) at k = 0, and not at all at k = 1', () => {
    expect(magnification(2, 1, 0)).toBeCloseTo(2);
    expect(magnification(2, 1, 1)).toBe(1);
    expect(magnification(2, 0, 0.9)).toBe(1);
  });

  it('drops points level with or behind the lantern instead of mirroring them', () => {
    const stage = wall(2);
    shadowMatrix(stage, LANTERN, 0, m);
    expect(projectToStage(m, stage, 0, 0, 0.1, xy)).toBeLessThanOrEqual(0);
  });

  it('scales the shadow about the palm with the size setting', () => {
    const stage = wall(2);
    const p1 = new ShadowProjector({ blend: 1 });
    const p15 = new ShadowProjector({ blend: 1, size: 1.5 });
    const hands = { left: createHandFrame('left'), right: handFacingWall() };
    p1.update(hands, stage, LANTERN);
    p15.update(hands, stage, LANTERN);
    const w = (b: Float32Array) => b[2] - b[0];
    expect(w(p15.shadows.right.bounds) / w(p1.shadows.right.bounds)).toBeCloseTo(1.5, 2);
  });
});
