import { describe, expect, it } from 'vitest';
import { createHandFrame, derivePalm, JOINT } from '../contracts/hand';
import { handednessFromLabel, mediapipeToHandFrame, type Landmark } from './mediapipe-hands';

/**
 * A right hand held up, palm toward the camera, in MediaPipe world coords
 * (x right in the image, y down, z away from the camera). Seen by the camera,
 * the thumb is on the image's right (+x) and the pinky on its left.
 */
function rightHandPalmToCamera(): Landmark[] {
  const lm: Landmark[] = [{ x: 0, y: 0.05, z: 0 }]; // wrist below the centre
  lm.push({ x: 0.03, y: 0.03, z: 0 }, { x: 0.05, y: 0.01, z: 0 }, { x: 0.06, y: -0.01, z: 0 }, { x: 0.07, y: -0.03, z: 0 });
  [0.025, 0.008, -0.008, -0.025].forEach((x) => {
    for (const y of [-0.02, -0.05, -0.07, -0.09]) lm.push({ x, y, z: 0 });
  });
  return lm;
}

describe('MediaPipe to HandFrame', () => {
  it('uses the handedness label as is for unmirrored frames', () => {
    expect(handednessFromLabel('Left')).toBe('left');
    expect(handednessFromLabel('Right')).toBe('right');
  });

  it('keeps a right hand right-handed: palm toward the camera gives a normal toward the camera', () => {
    const world = rightHandPalmToCamera();
    const image = world.map(() => ({ x: 0.5, y: 0.5, z: 0 }));
    const h = mediapipeToHandFrame(world, image, createHandFrame(handednessFromLabel('Right')));
    expect(h.tracked).toBe(true);
    const palm = derivePalm(h)!;
    expect(palm.normal[2]).toBeGreaterThan(0.9); // camera is at +Z from the hand
    expect(palm.forward[1]).toBeGreaterThan(0.9); // fingers point up
  });

  it('places the wrist at the requested depth and estimates the metacarpals near the wrist', () => {
    const world = rightHandPalmToCamera();
    const image = world.map(() => ({ x: 0.5, y: 0.5, z: 0 }));
    const h = mediapipeToHandFrame(world, image, createHandFrame('right'), 0.5);
    expect(h.positions[JOINT.wrist * 3 + 2]).toBeCloseTo(-0.5, 6);
    const meta = JOINT['index-finger-metacarpal'] * 3, wrist = JOINT.wrist * 3, knuckle = JOINT['index-finger-phalanx-proximal'] * 3;
    const d = (a: number, b: number) => Math.hypot(h.positions[a] - h.positions[b], h.positions[a + 1] - h.positions[b + 1], h.positions[a + 2] - h.positions[b + 2]);
    expect(d(meta, wrist) / d(knuckle, wrist)).toBeCloseTo(0.15, 3);
  });
});
