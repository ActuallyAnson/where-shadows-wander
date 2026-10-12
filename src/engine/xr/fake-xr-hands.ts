// A fake XR frame with two tracked hands, for testing XRHandReader without a headset. Test support, not game code.
import { Matrix4 } from '@iwsdk/core';
import { JOINT_COUNT, JOINT_NAMES } from '../hands/hand';

export interface FakeHand {
  spaces: object[];
  /** How many times the reader asked for a joint space by name. */
  getCalls: number;
  readonly hand: { size: number; get(name: string): object | undefined };
}

export function makeFakeHand(): FakeHand {
  const spaces = Array.from({ length: JOINT_COUNT }, (_, i) => ({ joint: i }));
  const fake: FakeHand = {
    spaces,
    getCalls: 0,
    hand: {
      size: JOINT_COUNT,
      get(name: string) {
        fake.getCalls++;
        const i = (JOINT_NAMES as readonly string[]).indexOf(name);
        return i >= 0 ? spaces[i] : undefined;
      },
    },
  };
  return fake;
}

export interface FakeFrameOptions {
  /** Offer fillPoses and fillJointRadii (the fast path), or only getJointPose (the Pico's). */
  fast: boolean;
  /** Joints (by index) with no pose, on the getJointPose path. */
  missing?: readonly number[];
}

export interface FakeXr {
  frame: XRFrame;
  session: XRSession;
  left: FakeHand;
  right: FakeHand;
  /** getJointPose calls since the last reset. */
  poseCalls: { n: number };
  /** Listeners registered on the session, to fire an inputsourceschange. */
  listeners: Map<string, ((e: Event) => void)[]>;
  /** Hand positions: joint i of the left hand is at (-0.2 + i * 0.001, 1, -0.4) in reference space. */
  origin: Matrix4;
}

export function makeFakeXr(options: FakeFrameOptions): FakeXr {
  const left = makeFakeHand();
  const right = makeFakeHand();
  const listeners = new Map<string, ((e: Event) => void)[]>();
  const poseCalls = { n: 0 };
  const sources = [
    { handedness: 'left', targetRayMode: 'tracked-pointer', profiles: ['generic-hand'], hand: left.hand },
    { handedness: 'right', targetRayMode: 'tracked-pointer', profiles: ['generic-hand'], hand: right.hand },
  ];
  const session = {
    inputSources: sources,
    addEventListener(type: string, fn: (e: Event) => void) {
      listeners.set(type, [...(listeners.get(type) ?? []), fn]);
    },
  } as unknown as XRSession;
  const owner = (space: object): number => (left.spaces.includes(space) ? 0 : 1);
  // One pose object per call site would allocate; a browser does allocate here, so the fake reuses one to isolate the reader.
  const pose = { transform: { matrix: new Float32Array(16) }, radius: 0.012 };
  const matrixFor = (side: number, joint: number, out: Float32Array | number[], offset = 0): void => {
    for (let k = 0; k < 16; k++) out[offset + k] = k % 5 === 0 ? 1 : 0;
    out[offset + 12] = (side === 0 ? -0.2 : 0.2) + joint * 0.001;
    out[offset + 13] = 1;
    out[offset + 14] = -0.4;
  };
  const frame = {
    session,
    getJointPose(space: object) {
      poseCalls.n++;
      const side = owner(space);
      const joint = (side === 0 ? left : right).spaces.indexOf(space);
      if (options.missing?.includes(joint)) return null;
      matrixFor(side, joint, pose.transform.matrix);
      return pose;
    },
  } as unknown as Record<string, unknown>;
  if (options.fast) {
    frame.fillPoses = (spaces: object[], _ref: unknown, out: Float32Array) => {
      const side = owner(spaces[0]);
      for (let j = 0; j < JOINT_COUNT; j++) matrixFor(side, j, out, j * 16);
      return true;
    };
    frame.fillJointRadii = (_spaces: object[], out: Float32Array) => {
      out.fill(0.012);
      return true;
    };
  }
  return { frame: frame as unknown as XRFrame, session, left, right, poseCalls, listeners, origin: new Matrix4() };
}
