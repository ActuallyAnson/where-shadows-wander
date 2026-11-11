// Reads WebXR hand joints into the HandFrame format. Uses only the raw WebXR
// XRFrame/XRHand API (not IWSDK's input, grab or gesture systems), so it runs
// unchanged under the plain three.js fallback (docs/adr/0002-plain-threejs-fallback.md).
import { Matrix4 } from '@iwsdk/core';
import {
  createHandFrame,
  JOINT,
  JOINT_COUNT,
  JOINT_NAMES,
  type HandFrame,
  type Handedness,
  type JointName,
} from '../hands/hand';

// fillPoses/fillJointRadii are in the Hand Input spec but missing from @types/webxr.
type FrameWithFill = XRFrame & {
  fillPoses?: (spaces: XRSpace[], base: XRSpace, out: Float32Array) => boolean;
  fillJointRadii?: (spaces: XRJointSpace[], out: Float32Array) => boolean;
};

export interface XRSourceDebug {
  targetRayMode: string;
  handedness: string;
  profiles: string[];
  hasHand: boolean;
  handSize: number;
  spacesFound: number;
}

export interface XRHandReaderDebug {
  updateCalls: number;
  sourcesSeen: number;
  sources: XRSourceDebug[];
  inputSourceEvents: string[];
  lastError: string | null;
}

/** How many input-source change events the diagnostics keep. */
const MAX_SOURCE_EVENTS = 50;

/**
 * How long a hand that drops out of tracking is held where it was last fully seen, milliseconds. Turning a hand over (back to palm) often
 * loses a joint or two for a few frames; without this the hand and its shadow blink out, and a held shape lets go.
 */
export const LOSS_GRACE_MS = 250;

export class XRHandReader {
  readonly hands: Record<Handedness, HandFrame> = {
    left: createHandFrame('left'),
    right: createHandFrame('right'),
  };
  /** How joints were read, for diagnostics. */
  readonly method = { fillPoses: 0, getJointPose: 0 };
  readonly debug: XRHandReaderDebug = {
    updateCalls: 0,
    sourcesSeen: 0,
    sources: [],
    inputSourceEvents: [],
    lastError: null,
  };
  /** The last frame each hand was fully tracked (joints, radii and when), kept to hold a hand through a short dropout. */
  private readonly lastGood = { left: new Float32Array(JOINT_COUNT * 3), right: new Float32Array(JOINT_COUNT * 3) };
  private readonly lastGoodRadii = { left: new Float32Array(JOINT_COUNT), right: new Float32Array(JOINT_COUNT) };
  /** When each hand (0 left, 1 right) was last fully tracked. A typed array: a time stored in a plain object field
   *  is boxed on the heap, 32 B a frame, which broke the allocation budget (xr-hands.alloc.test.ts). */
  private readonly lastFullAt = new Float64Array([-Infinity, -Infinity]);
  /** Milliseconds a lost hand is held (0 turns it off). */
  lossGraceMs = LOSS_GRACE_MS;
  /** Input sources this frame that are hands (not controllers); 0 when hand tracking is off or the browser gives no joints. */
  handSources = 0;
  private readonly poses = new Float32Array(16 * JOINT_COUNT);
  private readonly spaces: (XRJointSpace | undefined)[] = new Array(JOINT_COUNT);
  private readonly m = new Matrix4();
  /** The input sources this frame, reused (read by index: no new array each frame). */
  private readonly sourceList: XRInputSource[] = [];
  /** A hand's 25 joint spaces never change for the life of its XRHand, so they are looked up once. */
  private readonly spaceCache = new WeakMap<object, (XRJointSpace | undefined)[]>();
  /** Joint radii read alongside the poses on the getJointPose path, so each joint is asked for once. */
  private readonly fallbackRadii = new Float32Array(JOINT_COUNT);
  private lastWatchedSession: XRSession | null = null;

  /**
   * @param originMatrix matrixWorld of the XR origin (world.player): reference space to scene.
   */
  update(frame: XRFrame, refSpace: XRReferenceSpace, originMatrix: Matrix4): void {
    this.debug.updateCalls++;
    this.hands.left.tracked = this.hands.right.tracked = false;
    this.hands.left.validJoints = this.hands.right.validJoints = 0;
    this.handSources = 0;
    const f = frame as FrameWithFill;

    if (this.lastWatchedSession !== frame.session) {
      this.lastWatchedSession = frame.session;
      frame.session.addEventListener('inputsourceschange', (e: Event) => {
        const evt = e as XRInputSourcesChangeEvent;
        const added = (evt.added ?? [])
          .map((s: XRInputSource) => `${s.handedness}:${s.targetRayMode}:${s.hand ? 'hand' : 'ctl'}`)
          .join(',');
        const removed = (evt.removed ?? [])
          .map((s: XRInputSource) => `${s.handedness}:${s.targetRayMode}:${s.hand ? 'hand' : 'ctl'}`)
          .join(',');
        this.debug.inputSourceEvents.push(`+(${added}) -(${removed})`);
        // Only the latest few are kept, or the diagnostics report would grow with every controller on and off.
        if (this.debug.inputSourceEvents.length > MAX_SOURCE_EVENTS) this.debug.inputSourceEvents.shift();
      });
    }

    // Inspect session.inputSources AND session.trackedSources (some runtimes place bare hands there).
    const session = frame.session as XRSession & { trackedSources?: Iterable<XRInputSource> };
    // A reused array written by index: setting `length = 0` and pushing again re-allocates its storage each frame.
    const sources = this.sourceList;
    let nSources = 0;
    const inputs = session.inputSources;
    for (let i = 0; i < inputs.length; i++) sources[nSources++] = inputs[i];
    if (session.trackedSources) {
      for (const ts of session.trackedSources) {
        let known = false;
        for (let i = 0; i < nSources; i++) if (sources[i] === ts) known = true;
        if (!known) sources[nSources++] = ts;
      }
    }
    this.debug.sourcesSeen = nSources;

    // Capture first frame sources info for telemetry if empty
    if (this.debug.sources.length === 0 && nSources > 0) {
      for (let i = 0; i < nSources; i++) {
        const s = sources[i];
        this.debug.sources.push({
          targetRayMode: s.targetRayMode,
          handedness: s.handedness,
          profiles: [...s.profiles],
          hasHand: !!s.hand,
          handSize: s.hand?.size ?? 0,
          spacesFound: 0,
        });
      }
    }

    for (let s = 0; s < nSources; s++) {
      const source = sources[s];
      const xrHand = source.hand;
      if (!xrHand) continue;
      this.handSources++;

      // Determine handedness: use explicit handedness or check profiles
      let assignedHandedness: Handedness | null =
        source.handedness === 'left' || source.handedness === 'right' ? source.handedness : null;
      if (!assignedHandedness && source.profiles) {
        for (const p of source.profiles) {
          if (p.includes('left')) assignedHandedness = 'left';
          else if (p.includes('right')) assignedHandedness = 'right';
        }
      }

      // Reset spaces array for this hand
      this.spaces.fill(undefined);
      const cachedSpaces = this.spaceCache.get(xrHand);
      if (cachedSpaces) for (let i = 0; i < JOINT_COUNT; i++) this.spaces[i] = cachedSpaces[i];

      if (!cachedSpaces) {
        // Path 1: xrHand.get(jointName) or index
        for (let i = 0; i < JOINT_COUNT; i++) {
          const space = xrHand.get?.(JOINT_NAMES[i]) ?? (xrHand as unknown as Record<number, XRJointSpace>)[i];
          if (space) this.spaces[i] = space;
        }

        // Path 2: Map iterator / entries if spaces[0] missing
        if (!this.spaces[0]) {
          try {
            const iter =
              typeof (xrHand as unknown as { entries?: () => Iterable<[string, XRJointSpace]> }).entries === 'function'
                ? (xrHand as unknown as { entries: () => Iterable<[string, XRJointSpace]> }).entries()
                : typeof (xrHand as unknown as Iterable<unknown>)[Symbol.iterator] === 'function'
                  ? (xrHand as unknown as Iterable<unknown>)
                  : null;
            if (iter) {
              for (const item of iter) {
                if (Array.isArray(item)) {
                  const [key, js] = item as [unknown, XRJointSpace];
                  if (typeof key === 'string' && (key as JointName) in JOINT && js) {
                    this.spaces[JOINT[key as JointName]] = js;
                  }
                }
              }
            }
          } catch (e) {
            this.debug.lastError = `iter: ${String(e)}`;
          }
        }

        // Path 3: forEach
        if (!this.spaces[0] && typeof xrHand.forEach === 'function') {
          try {
            xrHand.forEach((val: unknown, key: unknown) => {
              const name =
                (typeof key === 'string' && (key as JointName) in JOINT ? (key as JointName) : null) ??
                (typeof val === 'string' && (val as JointName) in JOINT ? (val as JointName) : null) ??
                ((val as { jointName?: string })?.jointName as JointName | undefined);
              const js =
                val && typeof val === 'object' && !('jointName' in val && typeof key === 'string')
                  ? (val as XRJointSpace)
                  : (key as XRJointSpace);
              if (name && name in JOINT && js) {
                this.spaces[JOINT[name]] = js;
              }
            });
          } catch (e) {
            this.debug.lastError = `forEach: ${String(e)}`;
          }
        }
      }

      let spacesCount = 0;
      for (let i = 0; i < JOINT_COUNT; i++) {
        if (this.spaces[i]) spacesCount++;
      }
      if (this.debug.sources[s]) {
        this.debug.sources[s].spacesFound = spacesCount;
      }
      // A complete set is kept for the life of this XRHand; an incomplete one is looked up again next frame.
      if (!cachedSpaces && spacesCount === JOINT_COUNT) this.spaceCache.set(xrHand, this.spaces.slice());

      let valid = 0;
      let filled = false;
      if (typeof f.fillPoses === 'function' && typeof f.fillJointRadii === 'function' && spacesCount === JOINT_COUNT) {
        try {
          filled = f.fillPoses(this.spaces as XRJointSpace[], refSpace, this.poses);
          if (filled) {
            valid = JOINT_COUNT;
            this.method.fillPoses++;
          }
        } catch (e) {
          filled = false;
          this.debug.lastError = `fillPoses: ${String(e)}`;
        }
      }

      if (!filled) {
        this.fallbackRadii.fill(0.01);
        for (let i = 0; i < JOINT_COUNT; i++) {
          const space = this.spaces[i];
          if (!space) continue;
          try {
            const pose = frame.getJointPose?.(space, refSpace);
            if (!pose) continue;
            this.poses.set(pose.transform.matrix, i * 16);
            this.fallbackRadii[i] = pose.radius ?? 0.01;
            valid++;
          } catch (e) {
            this.debug.lastError = `getJointPose: ${String(e)}`;
          }
        }
        if (valid > 0) this.method.getJointPose++;
      }

      if (valid === 0) continue;

      // If handedness was unknown, infer from wrist reference position (-X is left, +X is right)
      if (!assignedHandedness) {
        const wristRefX = this.poses[12];
        if (wristRefX < 0 && this.hands.left.validJoints === 0) {
          assignedHandedness = 'left';
        } else if (this.hands.right.validJoints === 0) {
          assignedHandedness = 'right';
        } else {
          assignedHandedness = 'left';
        }
      }

      const hand = this.hands[assignedHandedness];
      if (filled && typeof f.fillJointRadii === 'function') {
        try {
          f.fillJointRadii(this.spaces as XRJointSpace[], hand.radii);
        } catch {
          hand.radii.fill(0.01);
        }
      } else {
        hand.radii.set(this.fallbackRadii);
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
    this.holdThroughDropout();
  }

  /** A hand fully seen a moment ago and not now is kept where it was for `lossGraceMs`, so a flicker does not blank it. */
  private holdThroughDropout(): void {
    const now = performance.now();
    for (const side of ['left', 'right'] as const) {
      const hand = this.hands[side];
      const at = side === 'left' ? 0 : 1;
      if (hand.tracked) {
        this.lastGood[side].set(hand.positions);
        this.lastGoodRadii[side].set(hand.radii);
        this.lastFullAt[at] = now;
      } else if (now - this.lastFullAt[at]! < this.lossGraceMs) {
        hand.positions.set(this.lastGood[side]);
        hand.radii.set(this.lastGoodRadii[side]);
        hand.validJoints = JOINT_COUNT;
        hand.tracked = true;
      }
    }
  }
}
