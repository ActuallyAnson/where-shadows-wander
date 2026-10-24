import { describe, expect, it } from 'vitest';
import { createHandFrame, JOINT_COUNT } from '../hands/hand';
import { CAPSULE_JOINTS } from '../shadow/pure/shadow-projector';
import { HandOccluder } from './hand-occluder';

function trackedHand() {
  const hand = createHandFrame('right');
  hand.tracked = true;
  hand.validJoints = JOINT_COUNT;
  for (let j = 0; j < JOINT_COUNT; j++) {
    hand.positions[j * 3] = j * 0.01;
    hand.positions[j * 3 + 1] = 1;
    hand.positions[j * 3 + 2] = -0.5;
    hand.radii[j] = 0.01;
  }
  return hand;
}

describe('HandOccluder', () => {
  it('draws one sphere per joint and one cylinder per bone for a tracked hand', () => {
    const occluder = new HandOccluder();
    occluder.update([trackedHand()]);
    const [joints, bones] = occluder.meshes;
    expect(joints.visible && bones.visible).toBe(true);
    expect(joints.count).toBe(JOINT_COUNT);
    expect(bones.count).toBe(CAPSULE_JOINTS.length / 2);
  });

  it('skips a hand that is not tracked', () => {
    const occluder = new HandOccluder();
    const hand = trackedHand();
    hand.tracked = false;
    occluder.update([hand]);
    expect(occluder.meshes[0].count).toBe(0);
    expect(occluder.meshes[1].count).toBe(0);
  });

  it('when off, hides both meshes and uploads nothing', () => {
    const occluder = new HandOccluder();
    occluder.update([trackedHand()]);
    const [joints, bones] = occluder.meshes;
    occluder.enabled = false;
    const before = [joints.instanceMatrix.version, bones.instanceMatrix.version];
    for (let i = 0; i < 5; i++) occluder.update([trackedHand()]);
    expect(joints.visible || bones.visible).toBe(false);
    expect(joints.count + bones.count).toBe(0);
    expect([joints.instanceMatrix.version, bones.instanceMatrix.version]).toEqual(before);
  });

  it('draws again once turned back on', () => {
    const occluder = new HandOccluder();
    occluder.enabled = false;
    occluder.update([trackedHand()]);
    occluder.enabled = true;
    occluder.update([trackedHand()]);
    expect(occluder.meshes[0].visible).toBe(true);
    expect(occluder.meshes[0].count).toBe(JOINT_COUNT);
  });
});
