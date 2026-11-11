import { describe, expect, it } from 'vitest';
import { createHandFrame, derivePalm, JOINT, JOINT_COUNT } from './hand';
import { MATCH_GRIP, PosedHand } from './posed-hand';
import { PRESETS, writeHandPose } from './synthetic-hand';

const tip = (p: Float32Array, name: 'thumb-tip' | 'index-finger-tip') => {
  const k = JOINT[name] * 3;
  return [p[k], p[k + 1], p[k + 2]];
};
const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** A live hand: spread open, turned and moved, a little smaller than the pose. */
function liveHand() {
  const pose = { ...PRESETS.spread, rollDeg: 40, yawDeg: -70, pitchDeg: 20 };
  return writeHandPose(pose, [0.3, 1.2, -0.5], createHandFrame('right'), 0.8);
}

describe('PosedHand', () => {
  it("holds the grip on the live hand's wrist and palm, whatever its fingers do", () => {
    const live = liveHand();
    const out = new PosedHand('right', MATCH_GRIP).update(live, 0);
    const w = JOINT.wrist * 3;
    expect([out.positions[w], out.positions[w + 1], out.positions[w + 2]]).toEqual([
      expect.closeTo(live.positions[w], 5),
      expect.closeTo(live.positions[w + 1], 5),
      expect.closeTo(live.positions[w + 2], 5),
    ]);
    // The live hand is open; the posed one pinches.
    expect(dist(tip(live.positions, 'thumb-tip'), tip(live.positions, 'index-finger-tip'))).toBeGreaterThan(0.04);
    expect(dist(tip(out.positions, 'thumb-tip'), tip(out.positions, 'index-finger-tip'))).toBeLessThan(0.012);
    // Facing the same way as the live palm.
    const a = derivePalm(live)!;
    const b = derivePalm(out)!;
    const facing = a.forward[0] * b.forward[0] + a.forward[1] * b.forward[1] + a.forward[2] * b.forward[2];
    expect(facing).toBeGreaterThan(0.99);
  });

  it('blends to the live hand at mix 1, and follows its tracking', () => {
    const live = liveHand();
    const hand = new PosedHand('right', MATCH_GRIP);
    const out = hand.update(live, 1);
    for (let i = 0; i < JOINT_COUNT * 3; i++) expect(out.positions[i]).toBeCloseTo(live.positions[i], 5);
    const half = hand.update(live, 0.5);
    expect(dist(tip(half.positions, 'thumb-tip'), tip(half.positions, 'index-finger-tip'))).toBeGreaterThan(0.012);
    live.tracked = false;
    expect(hand.update(live, 0).tracked).toBe(false);
  });
});
