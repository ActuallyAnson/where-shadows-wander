// Recorded hand-tracking data: what the tester captures on a Quest and what
// tests and the classifier replay. Plain TypeScript: no IWSDK, no three.js.
import { JOINT_COUNT, JOINT_NAMES, type HandFrame, type Handedness } from './hand';
import { SHAPES, type Shape } from './shapes';

export const RECORDING_FORMAT = 'wsw-handrec';
/** 2 added `labels`. Version 1 files still load, as recordings with no labels. */
export const RECORDING_VERSION = 2;

/** What a label says the hand was doing: a v1 shape, or `none` (relaxed, no shape). */
export type LabelShape = Shape | 'none';

/**
 * Ground truth for one hand over a time range, written by a guided recording
 * (shape-script.ts). It records what the wearer was asked to do, over the
 * settled middle of the prompt, not what the hand actually did. A hand with no
 * label at some time wasn't being prompted; leave it out of accuracy counts
 * rather than treating it as `none`.
 */
export interface ShapeLabel {
  /** Seconds since the recording started, like frame times. */
  start: number;
  end: number;
  hand: Handedness;
  shape: LabelShape;
}

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
  /** Shape labels from a guided recording; empty for a free recording. */
  labels: ShapeLabel[];
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
    labels: [],
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
    t: ms(t),
    left: left.tracked ? toMm(left.positions) : null,
    right: right.tracked ? toMm(right.positions) : null,
    valid: [left.validJoints, right.validJoints],
    head: head ? [mm(head[0]), mm(head[1]), mm(head[2])] : null,
  });
}

/** Adds labels, with times rounded like frame times, leaving out any that end after the last frame (a recording stopped early). */
export function addLabels(rec: HandRecording, labels: readonly ShapeLabel[]): void {
  const last = rec.frames.length ? rec.frames[rec.frames.length - 1].t : -Infinity;
  for (const l of labels) {
    const label = { ...l, start: ms(l.start), end: ms(l.end) };
    if (label.end <= last) rec.labels.push(label);
  }
}

/**
 * Checks that parsed JSON is a recording this code can read, and returns it typed
 * as the current version (a version 1 file comes back with no labels). Throws if not.
 */
export function parseRecording(json: unknown): HandRecording {
  const r = json as (Partial<Omit<HandRecording, 'version'>> & { version?: unknown }) | null;
  if (r?.format !== RECORDING_FORMAT) throw new Error('Not a hand recording (.handrec.json)');
  if (r.version !== 1 && r.version !== RECORDING_VERSION)
    throw new Error(`Unsupported recording version ${String(r.version)}`);
  if (!Array.isArray(r.frames) || r.frames.length === 0) throw new Error('Recording has no frames');
  if (r.version === 1) return { ...(r as HandRecording), version: RECORDING_VERSION, labels: [] };
  if (!Array.isArray(r.labels)) throw new Error('Recording labels are missing');
  r.labels.forEach((l, i) => {
    const ok =
      Number.isFinite(l?.start) &&
      Number.isFinite(l?.end) &&
      l.start < l.end &&
      (l.hand === 'left' || l.hand === 'right') &&
      (l.shape === 'none' || (SHAPES as readonly string[]).includes(l.shape));
    if (!ok) throw new Error(`Bad label ${i}`);
  });
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

function ms(t: number): number {
  return Math.round(t * 1000) / 1000;
}

function mm(m: number): number {
  return Math.round(m * 1000);
}
