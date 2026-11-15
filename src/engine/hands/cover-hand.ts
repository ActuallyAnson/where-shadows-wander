// A hand cupped palm-down over the flame, as a HandFrame: the ghost that shows the player, at the end, to cover the candle
// (stage/story/sleep-hint.ts). Its palm is centred `lift` metres over the flame and its fingers point along a level
// direction (away from the player, toward the wall). Plain TypeScript, no allocation per call.
import { createHandFrame, createPalm, derivePalm, type HandFrame, type Vec3 } from './hand';
import { clonePose, PRESETS, writeHandPose, type HandPose } from './synthetic-hand';

/** A loosely cupped hand, palm down, as one held over a flame. */
export const COVER_POSE: Readonly<HandPose> = (() => {
  const p = clonePose(PRESETS.flat);
  p.fingers[0].curl = 0.22;
  p.fingers[1].curl = 0.24;
  p.fingers[2].curl = 0.26;
  p.fingers[3].curl = 0.28;
  p.thumb.curl = 0.2;
  p.thumb.abductDeg = 22;
  return p;
})();

const ORIGIN: Vec3 = [0, 0, 0];
const scratch = createHandFrame('right');
const palm = createPalm();

/**
 * Writes the cover hand into `out` (a right hand): its palm `lift` m above `flame`, its fingers along (`dirX`, `dirZ`) on the
 * floor plane (any length; a zero direction points them along -Z). `scale` sizes it (1 = adult).
 */
export function writeCoverHand(
  flame: ArrayLike<number>,
  lift: number,
  dirX: number,
  dirZ: number,
  out: HandFrame,
  scale = 1,
): HandFrame {
  writeHandPose(COVER_POSE, ORIGIN, scratch, scale);
  const pc = derivePalm(scratch, palm)!.position;
  const len = Math.hypot(dirX, dirZ);
  // The pose is built with its fingers along -Z; turned about Y so -Z goes to the direction asked.
  const dx = len > 1e-6 ? dirX / len : 0;
  const dz = len > 1e-6 ? dirZ / len : -1;
  const s = scratch.positions;
  const o = out.positions;
  for (let j = 0; j < o.length; j += 3) {
    const x = s[j] - pc[0];
    const y = s[j + 1] - pc[1];
    const z = s[j + 2] - pc[2];
    o[j] = flame[0] - x * dz - z * dx;
    o[j + 1] = flame[1] + lift + y;
    o[j + 2] = flame[2] + x * dx - z * dz;
  }
  out.radii.set(scratch.radii);
  out.tracked = true;
  out.validJoints = scratch.validJoints;
  return out;
}
