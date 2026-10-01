// Reads WebXR hand joints into the HandFrame contract. Uses only the raw WebXR
// XRFrame/XRHand API (not IWSDK's input, grab or gesture systems), so it runs
// unchanged under the plain three.js fallback (docs/adr/0002-plain-threejs-fallback.md).
import { Matrix4 } from '@iwsdk/core';
import { createHandFrame, JOINT_COUNT, JOINT_NAMES, type HandFrame, type Handedness } from '../contracts/hand';

// fillPoses/fillJointRadii are in the Hand Input spec but missing from @types/webxr.
type FrameWithFill = XRFrame & {
  fillPoses?: (spaces: XRSpace[], base: XRSpace, out: Float32Array) => boolean;
  fillJointRadii?: (spaces: XRJointSpace[], out: Float32Array) => boolean;
};

export class XRHandReader {
  readonly hands: Record<Handedness, HandFrame> = {
    left: createHandFrame('left'),
    right: createHandFrame('right'),
  };
  /** How joints were read, for diagnostics. */
  readonly method = { fillPoses: 0, getJointPose: 0 };
  private readonly poses = new Float32Array(16 * JOINT_COUNT);
  private readonly spaces: XRJointSpace[] = new Array(JOINT_COUNT);
  private readonly m = new Matrix4();

  /**
   * @param originMatrix matrixWorld of the XR origin (world.player): reference space to scene.
   */
  update(frame: XRFrame, refSpace: XRReferenceSpace, originMatrix: Matrix4): void {
    this.hands.left.tracked = this.hands.right.tracked = false;
    this.hands.left.validJoints = this.hands.right.validJoints = 0;
    const f = frame as FrameWithFill;
    const sources = frame.session.inputSources;
    for (let s = 0; s < sources.length; s++) {
      const source = sources[s];
      const xrHand = source.hand;
      if (!xrHand || (source.handedness !== 'left' && source.handedness !== 'right')) continue;
      const hand = this.hands[source.handedness];
      for (let i = 0; i < JOINT_COUNT; i++) this.spaces[i] = xrHand.get(JOINT_NAMES[i])!;

      let valid = 0;
      if (f.fillPoses && f.fillJointRadii && f.fillPoses(this.spaces, refSpace, this.poses)) {
        f.fillJointRadii(this.spaces, hand.radii);
        valid = JOINT_COUNT;
        this.method.fillPoses++;
      } else {
        for (let i = 0; i < JOINT_COUNT; i++) {
          const pose = frame.getJointPose?.(this.spaces[i], refSpace);
          if (!pose) continue;
          this.poses.set(pose.transform.matrix, i * 16);
          hand.radii[i] = pose.radius ?? 0.01;
          valid++;
        }
        this.method.getJointPose++;
      }
      // Reference space to scene space; keep translation only.
      for (let i = 0; i < JOINT_COUNT; i++) {
        this.m.fromArray(this.poses, i * 16).premultiply(originMatrix);
        const e = this.m.elements;
        hand.positions[i * 3] = e[12];
        hand.positions[i * 3 + 1] = e[13];
        hand.positions[i * 3 + 2] = e[14];
      }
      hand.validJoints = valid;
      hand.tracked = valid === JOINT_COUNT;
    }
  }
}
