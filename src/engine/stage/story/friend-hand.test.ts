import { describe, expect, it } from 'vitest';
import { JOINT, JOINT_COUNT } from '../../hands/hand';
import { CYCLE_S, FORM_S, formAt, FRIEND_HAND_OFF_WALL_M, FriendHand, type WallFrame } from './friend-hand';

// A wall 2 m ahead (facing the player at the origin, normal +z), and a candle in the lap.
const wall: WallFrame = { origin: [0, 1.2, -2], right: [1, 0, 0], up: [0, 1, 0], normal: [0, 0, 1] };
const candle = [0.1, 0.8, -0.4];

const mean = (p: Float64Array | Float32Array, axis: number) => {
  let s = 0;
  for (let j = 0; j < JOINT_COUNT; j++) s += p[j * 3 + axis];
  return s / JOINT_COUNT;
};

describe('formAt', () => {
  it('forms the shape, holds it, eases half out and back, and repeats', () => {
    expect(formAt(0)).toBe(0);
    expect(formAt(FORM_S)).toBe(1);
    expect(formAt(FORM_S + 1)).toBe(1);
    const loosest = Math.min(...Array.from({ length: 100 }, (_, i) => formAt(FORM_S + (CYCLE_S * i) / 100)));
    expect(loosest).toBeGreaterThan(0.4);
    expect(loosest).toBeLessThan(0.7);
    expect(formAt(FORM_S + CYCLE_S)).toBeCloseTo(1);
  });
});

describe('FriendHand', () => {
  it('holds the hand off the wall on the line to the candle, so its shadow lands where it is asked', () => {
    const f = new FriendHand('left');
    const frame = f.update('rabbit', 2, wall, candle, -0.3, 0.05);
    expect(frame.tracked).toBe(true);
    expect(frame.validJoints).toBe(JOINT_COUNT);
    const z = mean(frame.positions, 2);
    expect(z - wall.origin[2]).toBeCloseTo(FRIEND_HAND_OFF_WALL_M, 1);
    // Projected from the candle onto the wall, the hand's middle is near the point.
    const x = mean(frame.positions, 0),
      y = mean(frame.positions, 1);
    const k = (wall.origin[2] - candle[2]) / (z - candle[2]);
    expect(candle[0] + (x - candle[0]) * k).toBeCloseTo(-0.3, 1);
    expect(candle[1] + (y - candle[1]) * k).toBeCloseTo(1.25, 1);
  });

  it('stands the hand up: fingers above the wrist, the shape facing the wall', () => {
    const f = new FriendHand('left');
    const p = f.update('rabbit', 2, wall, candle, 0, 0).positions;
    const tip = JOINT['index-finger-tip'] * 3,
      wrist = JOINT.wrist * 3;
    expect(p[tip + 1]).toBeGreaterThan(p[wrist + 1] + 0.08);
    expect(Math.abs(p[tip + 2] - p[wrist + 2])).toBeLessThan(0.04);
    expect(f.hands.left).toBe(f.frame);
    expect(f.hands.right.tracked).toBe(false);
  });

  it('turns the rabbit side-on, so the pinched thumb sticks out as a snout to the right of its neck', () => {
    const p = new FriendHand('left').update('rabbit', 2, wall, candle, 0, 0).positions;
    expect(p[JOINT['thumb-tip'] * 3]).toBeGreaterThan(p[JOINT.wrist * 3] + 0.04);
    // The two ears stay apart on the wall.
    expect(Math.abs(p[JOINT['index-finger-tip'] * 3] - p[JOINT['middle-finger-tip'] * 3])).toBeGreaterThan(0.015);
  });

  it('clears to no hand', () => {
    const f = new FriendHand('right');
    f.update('fox', 1, wall, candle, 0, 0);
    f.clear();
    expect(f.frame.tracked).toBe(false);
  });
});
