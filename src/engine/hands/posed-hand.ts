// A hand drawn in a set pose that still goes where the real hand goes: the pose's joints are kept in the palm's own frame
// (from the wrist: along the fingers, across the knuckles, out of the palm) and placed each frame on the live hand's wrist
// and palm, sized to it. `mix` blends it toward the live joints (0 the pose, 1 the live hand), so a held pose can hand over
// to the real fingers smoothly. Used for the opening, where the right hand holds the matchstick in a pinch whatever its
// fingers do. Plain TypeScript, no allocation per frame.
import { createHandFrame, createPalm, derivePalm, JOINT, JOINT_COUNT, type HandFrame, type Handedness } from './hand';
import { clonePose, PRESETS, writeHandPose, type HandPose } from './synthetic-hand';

/** Holding a matchstick: thumb on the index tip, the other fingers curled out of the way. */
export const MATCH_GRIP: Readonly<HandPose> = (() => {
  const p = clonePose(PRESETS.relaxed);
  p.fingers[0].curl = 0.35;
  p.fingers[1].curl = 0.62;
  p.fingers[2].curl = 0.72;
  p.fingers[3].curl = 0.78;
  p.thumb.curl = 0.3;
  p.thumb.abductDeg = 35;
  p.thumb.pinch = 1;
  p.thumb.pinchTo = 'index';
  return p;
})();

const WRIST = JOINT.wrist * 3;
const MID_PROX = JOINT['middle-finger-phalanx-proximal'] * 3;

export class PosedHand {
  /** The hand to draw. Its handedness is the one given; tracked only while the live hand is. */
  readonly frame: HandFrame;
  /** The pose's joints from its wrist, in its palm frame: along forward, across, and normal (metres, adult size). */
  private readonly local = new Float64Array(JOINT_COUNT * 3);
  private readonly poseRadii = new Float32Array(JOINT_COUNT);
  /** The pose's wrist to middle knuckle (m): the live hand's own length over this sizes the pose to it. */
  private readonly poseLength: number;
  private readonly palm = createPalm();

  constructor(handedness: Handedness, pose: Readonly<HandPose>) {
    this.frame = createHandFrame(handedness);
    const ref = writeHandPose(pose, [0, 0, 0], createHandFrame(handedness));
    const palm = derivePalm(ref);
    if (!palm) throw new Error('posed hand: the pose has no palm');
    const p = ref.positions;
    for (let j = 0; j < JOINT_COUNT; j++) {
      const dx = p[j * 3] - p[WRIST];
      const dy = p[j * 3 + 1] - p[WRIST + 1];
      const dz = p[j * 3 + 2] - p[WRIST + 2];
      this.local[j * 3] = dx * palm.forward[0] + dy * palm.forward[1] + dz * palm.forward[2];
      this.local[j * 3 + 1] = dx * palm.across[0] + dy * palm.across[1] + dz * palm.across[2];
      this.local[j * 3 + 2] = dx * palm.normal[0] + dy * palm.normal[1] + dz * palm.normal[2];
    }
    this.poseRadii.set(ref.radii);
    this.poseLength = Math.hypot(
      p[MID_PROX] - p[WRIST],
      p[MID_PROX + 1] - p[WRIST + 1],
      p[MID_PROX + 2] - p[WRIST + 2],
    );
  }

  /** Places the pose on `live`'s wrist and palm, blended toward `live` by `mix` (0 the pose .. 1 the live hand). */
  update(live: HandFrame, mix: number): HandFrame {
    const out = this.frame;
    out.tracked = live.tracked;
    out.validJoints = live.validJoints;
    const t = mix <= 0 ? 0 : mix >= 1 ? 1 : mix;
    const palm = live.tracked && t < 1 ? derivePalm(live, this.palm) : null;
    const lp = live.positions;
    const op = out.positions;
    if (!palm) {
      // Not tracked (the drawing fades it out from its last pose) or fully live: the live hand as it is.
      op.set(lp);
      out.radii.set(live.radii);
      return out;
    }
    const lx = lp[MID_PROX] - lp[WRIST];
    const ly = lp[MID_PROX + 1] - lp[WRIST + 1];
    const lz = lp[MID_PROX + 2] - lp[WRIST + 2];
    const scale = Math.hypot(lx, ly, lz) / this.poseLength;
    const f = palm.forward;
    const a = palm.across;
    const n = palm.normal;
    const wx = lp[WRIST];
    const wy = lp[WRIST + 1];
    const wz = lp[WRIST + 2];
    for (let j = 0; j < JOINT_COUNT; j++) {
      const u = this.local[j * 3] * scale;
      const v = this.local[j * 3 + 1] * scale;
      const w = this.local[j * 3 + 2] * scale;
      for (let i = 0; i < 3; i++) {
        const posed = (i === 0 ? wx : i === 1 ? wy : wz) + u * f[i] + v * a[i] + w * n[i];
        op[j * 3 + i] = posed + (lp[j * 3 + i] - posed) * t;
      }
      out.radii[j] = this.poseRadii[j] * scale + (live.radii[j] - this.poseRadii[j] * scale) * t;
    }
    return out;
  }
}
