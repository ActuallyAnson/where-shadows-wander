// Example pictures of each shape (the "how to make it" images in prompts and
// the Hand Lab's shape guide): the synthetic preset hand seen from a viewpoint
// that shows the shape clearly, flattened to 2D. Plain TypeScript; drawing is
// done by the caller (src/engine/xr/hand-sample-draw.ts).
import { createHandFrame, JOINT_COUNT, type Handedness } from './hand';
import { clonePose, PRESETS, writeHandPose, type PresetName } from './synthetic-hand';

export interface SampleView {
  /** Turn the hand about the vertical, then tilt it toward the viewer, degrees. */
  yawDeg: number;
  pitchDeg: number;
  /** Tilt the hand's fingers up first (as for a shadow puppet), degrees. */
  fingersUpDeg?: number;
}

/**
 * How to look at each shape. Most are seen from behind and above, as a player
 * sees their own hand; the fox from the side, so the L of the thumb shows.
 */
export const SAMPLE_VIEWS: Readonly<Record<PresetName, SampleView>> = {
  relaxed: { yawDeg: 25, pitchDeg: 50 },
  flat: { yawDeg: 25, pitchDeg: 50 },
  fist: { yawDeg: 35, pitchDeg: 35 },
  cup: { yawDeg: 25, pitchDeg: 25 },
  spread: { yawDeg: 15, pitchDeg: 65 },
  // Ears up: the hand tilted fingers-up, seen from the side, so the pinched thumb shows below them.
  rabbit: { yawDeg: 90, pitchDeg: 0, fingersUpDeg: 70 },
  // From the side, the fingers point one way and the thumb straight up: an L.
  fox: { yawDeg: 90, pitchDeg: 0 },
};

/**
 * Writes each joint of `preset` as seen from its sample view into `out`
 * (x, y per joint, y down), scaled to fit -1..1 and centred. Allocates; for
 * pictures drawn once, not per frame.
 */
export function sampleHand(preset: PresetName, side: Handedness = 'right'): Float32Array {
  const { yawDeg, pitchDeg, fingersUpDeg = 0 } = SAMPLE_VIEWS[preset];
  const pose = clonePose(PRESETS[preset]);
  pose.pitchDeg += fingersUpDeg;
  const hand = writeHandPose(pose, [0, 0, 0], createHandFrame(side));
  const yaw = ((side === 'left' ? -yawDeg : yawDeg) * Math.PI) / 180,
    pitch = (pitchDeg * Math.PI) / 180;
  const out = new Float32Array(JOINT_COUNT * 2);
  const p = hand.positions;
  for (let j = 0; j < JOINT_COUNT; j++) {
    // Turn about the vertical, then look down at it from behind (the viewer is on +Z, above).
    const x0 = p[j * 3] * Math.cos(yaw) + p[j * 3 + 2] * Math.sin(yaw);
    const z0 = -p[j * 3] * Math.sin(yaw) + p[j * 3 + 2] * Math.cos(yaw);
    const y0 = p[j * 3 + 1];
    const y1 = y0 * Math.cos(pitch) - z0 * Math.sin(pitch);
    out[j * 2] = x0;
    out[j * 2 + 1] = -y1; // canvas y points down
  }
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;
  for (let j = 0; j < JOINT_COUNT; j++) {
    minX = Math.min(minX, out[j * 2]);
    maxX = Math.max(maxX, out[j * 2]);
    minY = Math.min(minY, out[j * 2 + 1]);
    maxY = Math.max(maxY, out[j * 2 + 1]);
  }
  const cx = (minX + maxX) / 2,
    cy = (minY + maxY) / 2;
  const half = Math.max(maxX - minX, maxY - minY) / 2 || 1;
  for (let j = 0; j < JOINT_COUNT; j++) {
    out[j * 2] = (out[j * 2] - cx) / half;
    out[j * 2 + 1] = (out[j * 2 + 1] - cy) / half;
  }
  return out;
}
