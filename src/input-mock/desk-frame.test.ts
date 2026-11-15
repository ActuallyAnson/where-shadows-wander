import { describe, expect, it } from 'vitest';
import { createHandFrame } from '../engine/hands/hand';
import { handFeatures } from '../engine/hands/hand-features';
import { MOCK_HEAD, placeLantern } from '../engine/shadow/pure/test-rig';
import { DeskFrame } from './desk-frame';
import { SyntheticSource } from './synthetic-source';

const posed = () => {
  const left = createHandFrame('left'),
    right = createHandFrame('right');
  const src = new SyntheticSource();
  src.setShape('right', 'rabbit');
  src.update(1, left, right);
  return right;
};

describe('DeskFrame', () => {
  it('leaves the hands where they are for the desk rig itself', () => {
    const f = new DeskFrame();
    const hand = posed();
    const before = Array.from(hand.positions);
    f.set(MOCK_HEAD, 0);
    f.toRig(hand);
    Array.from(hand.positions).forEach((v, i) => expect(v).toBeCloseTo(before[i], 5));
  });

  it('keeps a hand where it was relative to the candle, for any head and yaw', () => {
    const deskLantern = new Float64Array(3);
    placeLantern(MOCK_HEAD, 0, deskLantern);
    const head = [0.4, 1.3, -0.2],
      yaw = 0.7;
    const rigLantern = new Float64Array(3);
    placeLantern(head, yaw, rigLantern);
    const f = new DeskFrame();
    f.set(head, yaw);
    const hand = posed();
    const wrist = [hand.positions[0], hand.positions[1], hand.positions[2]];
    f.toRig(hand);
    const deskDist = Math.hypot(wrist[0] - deskLantern[0], wrist[1] - deskLantern[1], wrist[2] - deskLantern[2]);
    const rigDist = Math.hypot(
      hand.positions[0] - rigLantern[0],
      hand.positions[1] - rigLantern[1],
      hand.positions[2] - rigLantern[2],
    );
    expect(rigDist).toBeCloseTo(deskDist, 5);
  });

  it('keeps the shape: moving and turning a hand does not change what it reads as', () => {
    const f = new DeskFrame();
    f.set([1, 1.6, 2], -2.1);
    const hand = posed();
    const before = handFeatures(hand)!;
    f.toRig(hand);
    const after = handFeatures(hand)!;
    for (const [finger, v] of Object.entries(after.curl))
      expect(v).toBeCloseTo(before.curl[finger as keyof typeof before.curl], 4);
  });

  it('maps a room point back to the desk rig', () => {
    const f = new DeskFrame();
    f.set([0.4, 1.3, -0.2], 0.7);
    const rigLantern = new Float64Array(3);
    placeLantern([0.4, 1.3, -0.2], 0.7, rigLantern);
    const deskLantern = new Float64Array(3);
    placeLantern(MOCK_HEAD, 0, deskLantern);
    const out = [0, 0, 0];
    f.toDesk(rigLantern, out);
    out.forEach((v, i) => expect(v).toBeCloseTo(deskLantern[i], 5));
  });

  it('leaves an empty hand alone', () => {
    const f = new DeskFrame();
    f.set([5, 5, 5], 1);
    const hand = createHandFrame('left');
    f.toRig(hand);
    expect(Array.from(hand.positions).every((v) => v === 0)).toBe(true);
  });
});
