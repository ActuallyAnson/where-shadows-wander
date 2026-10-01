import { describe, expect, it } from 'vitest';
import { createHandFrame, derivePalm, JOINT, JOINT_COUNT, JOINT_NAMES, JOINT_PARENT, type Handedness } from './hand';

/** Flat hand, palm down, fingers pointing to -Z (away from the viewer). */
function flatHand(handedness: Handedness) {
  const hand = createHandFrame(handedness);
  // Thumb side is -X for a right hand palm down, +X for a left hand.
  const side = handedness === 'right' ? 1 : -1;
  const fingers = ['index', 'middle', 'ring', 'pinky'] as const;
  const set = (name: string, x: number, y: number, z: number) => hand.positions.set([x, y, z], JOINT[name as keyof typeof JOINT] * 3);
  set('wrist', 0, 1, 0);
  fingers.forEach((f, i) => {
    const x = side * (i - 1) * 0.02; // middle finger on the Z axis
    set(`${f}-finger-metacarpal`, x, 1, -0.03);
    set(`${f}-finger-phalanx-proximal`, x, 1, -0.09);
    set(`${f}-finger-phalanx-intermediate`, x, 1, -0.13);
    set(`${f}-finger-phalanx-distal`, x, 1, -0.16);
    set(`${f}-finger-tip`, x, 1, -0.18);
  });
  hand.tracked = true;
  hand.validJoints = JOINT_COUNT;
  return hand;
}

describe('hand data', () => {
  it('has 25 joints and a parent for each', () => {
    expect(JOINT_NAMES).toHaveLength(25);
    expect(JOINT_PARENT).toHaveLength(25);
    expect(JOINT_NAMES).not.toContain('palm');
  });

  it.each(['left', 'right'] as const)('derives a downward palm normal for a flat %s hand, palm down', (h) => {
    const palm = derivePalm(flatHand(h))!;
    expect(palm.normal[1]).toBeCloseTo(-1, 5);
    expect(palm.forward[2]).toBeCloseTo(-1, 5);
    expect(palm.position[2]).toBeCloseTo(-0.06, 5);
  });

  it('returns null when the hand is not tracked', () => {
    const hand = flatHand('right');
    hand.tracked = false;
    expect(derivePalm(hand)).toBeNull();
  });
});
