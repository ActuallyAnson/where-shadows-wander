// Recorded hand-tracking data: what the tester captures on a Quest and what
// tests and the classifier replay. Plain TypeScript: no IWSDK, no three.js.
import { JOINT_COUNT, JOINT_NAMES, type HandFrame } from './hand';

export const RECORDING_FORMAT = 'wsw-handrec';
export const RECORDING_VERSION = 1;

/** One sample: positions in scene space, millimetres, rounded (75 ints), or null if not fully tracked. */
export interface RecordedFrame {
  /** Seconds since the recording started. */
  t: number;
  left: number[] | null;
  right: number[] | null;
  /** Joints with a pose this frame, per hand (0..25), so partial tracking is visible. */
  valid: [number, number];
  /** Headset position, millimetres (XR reference space; equals scene space while the XR origin is at identity, as in this seated game). */
  head: [number, number, number] | null;
}

export interface HandRecording {
  format: typeof RECORDING_FORMAT;
  version: typeof RECORDING_VERSION;
  joints: readonly string[];
  units: 'mm';
  recordedAt: string;
  userAgent: string;
  /** Free text: where it came from and what the hands were doing. */
  note: string;
  frames: RecordedFrame[];
}

export function createRecording(note: string, userAgent: string, recordedAt: string): HandRecording {
  return {
    format: RECORDING_FORMAT,
    version: RECORDING_VERSION,
    joints: JOINT_NAMES,
    units: 'mm',
    recordedAt,
    userAgent,
    note,
    frames: [],
  };
}

export function recordFrame(
  rec: HandRecording,
  t: number,
  left: HandFrame,
  right: HandFrame,
  head: [number, number, number] | null,
): void {
  rec.frames.push({
    t: Math.round(t * 1000) / 1000,
    left: left.tracked ? toMm(left.positions) : null,
    right: right.tracked ? toMm(right.positions) : null,
    valid: [left.validJoints, right.validJoints],
    head: head ? [mm(head[0]), mm(head[1]), mm(head[2])] : null,
  });
}

/** Checks that parsed JSON is a recording this code can read, and returns it typed. Throws if not. */
export function parseRecording(json: unknown): HandRecording {
  const r = json as Partial<HandRecording> | null;
  if (r?.format !== RECORDING_FORMAT) throw new Error('Not a hand recording (.handrec.json)');
  if (r.version !== RECORDING_VERSION) throw new Error(`Unsupported recording version ${String(r.version)}`);
  if (!Array.isArray(r.frames) || r.frames.length === 0) throw new Error('Recording has no frames');
  return r as HandRecording;
}

/** Writes a recorded hand back into a HandFrame (for replay in tests or the emulator). */
export function replayInto(frame: RecordedFrame, side: 'left' | 'right', out: HandFrame): HandFrame {
  const src = frame[side];
  out.tracked = src !== null;
  out.validJoints = frame.valid[side === 'left' ? 0 : 1];
  if (src) for (let i = 0; i < JOINT_COUNT * 3; i++) out.positions[i] = src[i] / 1000;
  return out;
}

function toMm(p: Float32Array): number[] {
  return Array.from(p, mm);
}

function mm(m: number): number {
  return Math.round(m * 1000);
}
