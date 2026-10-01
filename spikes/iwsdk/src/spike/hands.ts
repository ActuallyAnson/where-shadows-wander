// Raw WebXR hand-joint reader. Uses only the XRFrame + XRHand API, not IWSDK's
// input/grab systems, so the same code works under plain three.js.
import { Matrix4, Vector3 } from '@iwsdk/core';

// WebXR Hand Input defines 25 joints (OpenXR's 26th, "palm", is not exposed).
export const JOINT_NAMES: XRHandJoint[] = [
  'wrist',
  'thumb-metacarpal', 'thumb-phalanx-proximal', 'thumb-phalanx-distal', 'thumb-tip',
  'index-finger-metacarpal', 'index-finger-phalanx-proximal', 'index-finger-phalanx-intermediate', 'index-finger-phalanx-distal', 'index-finger-tip',
  'middle-finger-metacarpal', 'middle-finger-phalanx-proximal', 'middle-finger-phalanx-intermediate', 'middle-finger-phalanx-distal', 'middle-finger-tip',
  'ring-finger-metacarpal', 'ring-finger-phalanx-proximal', 'ring-finger-phalanx-intermediate', 'ring-finger-phalanx-distal', 'ring-finger-tip',
  'pinky-finger-metacarpal', 'pinky-finger-phalanx-proximal', 'pinky-finger-phalanx-intermediate', 'pinky-finger-phalanx-distal', 'pinky-finger-tip',
];
export const JOINT_COUNT = JOINT_NAMES.length;

// Parent index per joint for drawing bones (-1 = root).
export const JOINT_PARENT: number[] = [
  -1,
  0, 1, 2, 3,
  0, 5, 6, 7, 8,
  0, 10, 11, 12, 13,
  0, 15, 16, 17, 18,
  0, 20, 21, 22, 23,
];

export interface HandState {
  tracked: boolean;
  /** World-space joint matrices, 16 floats per joint (three.js scene space). */
  world: Float32Array;
  radii: Float32Array;
  /** Joints with a valid pose this frame. */
  validJoints: number;
}

export class HandReader {
  readonly hands: Record<'left' | 'right', HandState> = {
    left: makeHand(),
    right: makeHand(),
  };
  private readonly refPoses = new Float32Array(16 * JOINT_COUNT);
  private readonly spaces: XRJointSpace[] = new Array(JOINT_COUNT);
  private readonly tmp = new Matrix4();
  private readonly origin = new Matrix4();
  readonly method = { fillPoses: 0, getJointPose: 0 };

  /**
   * @param originMatrix three.js matrixWorld of the XR origin (reference space -> scene).
   */
  update(frame: XRFrame, refSpace: XRReferenceSpace, originMatrix: Matrix4): void {
    this.hands.left.tracked = false;
    this.hands.right.tracked = false;
    this.origin.copy(originMatrix);
    for (const source of frame.session.inputSources) {
      const hand = source.hand;
      if (!hand || (source.handedness !== 'left' && source.handedness !== 'right')) continue;
      const state = this.hands[source.handedness];
      for (let i = 0; i < JOINT_COUNT; i++) this.spaces[i] = hand.get(JOINT_NAMES[i])!;

      let ok = false;
      // fillPoses/fillJointRadii are in the Hand Input spec but missing from @types/webxr.
      const f = frame as XRFrame & {
        fillPoses?: (spaces: XRSpace[], base: XRSpace, out: Float32Array) => boolean;
        fillJointRadii?: (spaces: XRJointSpace[], out: Float32Array) => boolean;
      };
      if (f.fillPoses && f.fillJointRadii) {
        ok = f.fillPoses(this.spaces, refSpace, this.refPoses);
        if (ok) f.fillJointRadii(this.spaces, state.radii);
        if (ok) this.method.fillPoses++;
      }
      let valid = 0;
      if (ok) {
        valid = JOINT_COUNT;
      } else {
        for (let i = 0; i < JOINT_COUNT; i++) {
          const pose = frame.getJointPose?.(this.spaces[i], refSpace);
          if (!pose) continue;
          this.refPoses.set(pose.transform.matrix, i * 16);
          state.radii[i] = pose.radius ?? 0.01;
          valid++;
        }
        this.method.getJointPose++;
      }
      // reference space -> three.js world space
      for (let i = 0; i < JOINT_COUNT; i++) {
        this.tmp.fromArray(this.refPoses, i * 16).premultiply(this.origin);
        this.tmp.toArray(state.world, i * 16);
      }
      state.validJoints = valid;
      state.tracked = valid === JOINT_COUNT;
    }
  }

  jointPosition(hand: 'left' | 'right', joint: number, out: Vector3): Vector3 {
    const w = this.hands[hand].world;
    return out.set(w[joint * 16 + 12], w[joint * 16 + 13], w[joint * 16 + 14]);
  }
}

function makeHand(): HandState {
  return {
    tracked: false,
    world: new Float32Array(16 * JOINT_COUNT),
    radii: new Float32Array(JOINT_COUNT),
    validJoints: 0,
  };
}
