import { Bone, Group, Quaternion, Vector3 } from '@iwsdk/core';
import { describe, expect, it } from 'vitest';
import { createHandFrame, JOINT, JOINT_COUNT, JOINT_NAMES, type Handedness } from '../hands/hand';
import { PRESETS, writeHandPose } from '../hands/synthetic-hand';
import { ModelHandVisual } from './model-hand-visual';

/** A model as the glove GLBs are: 25 flat bones under one armature, at an open hand's joints. */
function model(handedness: Handedness): Group {
  const rest = writeHandPose(PRESETS.flat, [0, 0, 0], createHandFrame(handedness), 1.3);
  const root = new Group();
  const armature = new Group();
  root.add(armature);
  for (let j = 0; j < JOINT_COUNT; j++) {
    const b = new Bone();
    b.name = JOINT_NAMES[j];
    b.position.set(rest.positions[j * 3], rest.positions[j * 3 + 1], rest.positions[j * 3 + 2]);
    armature.add(b);
  }
  return root;
}

function boneOf(root: Group, j: number): Bone {
  return root.getObjectByName(JOINT_NAMES[j]) as Bone;
}

describe('ModelHandVisual', () => {
  for (const side of ['left', 'right'] as const) {
    it(`puts every ${side} bone on its joint, pointing at the next`, () => {
      const left = model('left');
      const right = model('right');
      const visual = new ModelHandVisual(left, right, new Group());
      const root = side === 'left' ? left : right;
      const live = writeHandPose(
        { ...PRESETS.fist, rollDeg: 30, yawDeg: 60, pitchDeg: -20 },
        [0.2, 1.1, -0.4],
        createHandFrame(side),
        0.8,
      );
      visual.update([live], 1 / 72);
      root.updateMatrixWorld(true);
      const at = new Vector3();
      const q = new Quaternion();
      const s = new Vector3();
      for (let j = 0; j < JOINT_COUNT; j++) {
        boneOf(root, j).matrixWorld.decompose(at, q, s);
        expect(at.x).toBeCloseTo(live.positions[j * 3], 5);
        expect(at.y).toBeCloseTo(live.positions[j * 3 + 1], 5);
        expect(at.z).toBeCloseTo(live.positions[j * 3 + 2], 5);
        expect(s.x).toBeCloseTo(0.8 / 1.3, 4);
      }
      // A finger bone's rest direction, turned by the bone, points at its next joint.
      const prox = JOINT['index-finger-phalanx-proximal'];
      const restModel = model(side);
      const a = boneOf(restModel, prox).position;
      const b = boneOf(restModel, prox + 1).position;
      const restDir = b.clone().sub(a).normalize();
      boneOf(root, prox).matrixWorld.decompose(at, q, s);
      const dir = restDir.applyQuaternion(q);
      const want = new Vector3(
        live.positions[(prox + 1) * 3] - live.positions[prox * 3],
        live.positions[(prox + 1) * 3 + 1] - live.positions[prox * 3 + 1],
        live.positions[(prox + 1) * 3 + 2] - live.positions[prox * 3 + 2],
      ).normalize();
      expect(dir.dot(want)).toBeGreaterThan(0.9999);
      expect(root.visible).toBe(true);
    });
  }

  it('fades out a hand that is lost', () => {
    const left = model('left');
    const right = model('right');
    const visual = new ModelHandVisual(left, right, new Group());
    const live = writeHandPose(PRESETS.relaxed, [0, 1, -0.4], createHandFrame('right'));
    visual.update([live], 1);
    expect(right.visible).toBe(true);
    live.tracked = false;
    visual.update([live], 1);
    expect(right.visible).toBe(false);
  });
});
