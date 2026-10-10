// Records exactly what the game was given each frame, so a session can be played back into a fresh
// Game and reach the same state, step for step (the sim is deterministic). For bug reports ("this
// is what my hands did") and for regression tests of a real session. Plain TypeScript.
//
// The recorder is allocated once, sized for `maxFrames` (about 0.6 KB a frame: both hands' capsules
// and bounds, plus up to EVENTS_PER_FRAME shape events); record() builds nothing. It is debug
// tooling: construct one only when recording. When full it stops recording (`full`).

import type { Handedness } from '../engine/hands/hand';
import { CAPSULE_STRIDE, CAPSULES_PER_HAND, createHandShadow, type HandShadow } from '../engine/hands/hand-shadow';
import { ShapeEventQueue, type ReleaseReason, type ShapeEventType } from '../engine/hands/shape-events';
import { SHAPES } from '../engine/hands/shapes';
import type { Game, GameInput } from './game';

const CAPS = CAPSULES_PER_HAND * CAPSULE_STRIDE;
/** Shape events kept per frame; more than this in one frame is unheard of (two hands, a switch each). */
export const EVENTS_PER_FRAME = 8;
const EVENT_TYPES: readonly ShapeEventType[] = ['candidate', 'cancel', 'commit', 'release'];
const REASONS: readonly (ReleaseReason | null)[] = [null, 'exit', 'switch', 'lost'];

export class InputRecorder {
  frames = 0;
  /** Set once maxFrames frames are recorded; later frames are not. */
  full = false;
  readonly dt: Float64Array;
  readonly paused: Uint8Array;
  /** Per frame and hand: shadow present, capsules, bounds. Hand 0 is the left. */
  readonly active: Uint8Array;
  readonly capsules: Float32Array;
  readonly bounds: Float32Array;
  /** Per frame: event count, then per event: type, hand, shape, reason (indices) and t, margin, heldS. */
  readonly eventCount: Uint8Array;
  readonly eventCodes: Uint8Array;
  readonly eventNums: Float64Array;
  /** Events beyond EVENTS_PER_FRAME in a frame (should stay 0). */
  eventsDropped = 0;

  constructor(readonly maxFrames = 72 * 60) {
    this.dt = new Float64Array(maxFrames);
    this.paused = new Uint8Array(maxFrames);
    this.active = new Uint8Array(maxFrames * 2);
    this.capsules = new Float32Array(maxFrames * 2 * CAPS);
    this.bounds = new Float32Array(maxFrames * 2 * 4);
    this.eventCount = new Uint8Array(maxFrames);
    this.eventCodes = new Uint8Array(maxFrames * EVENTS_PER_FRAME * 4);
    this.eventNums = new Float64Array(maxFrames * EVENTS_PER_FRAME * 3);
  }

  /** Records one frame's input; call with the same object passed to game.frame(). */
  record(input: GameInput): void {
    if (this.frames === this.maxFrames) {
      this.full = true;
      return;
    }
    const f = this.frames++;
    this.dt[f] = input.dt;
    this.paused[f] = input.paused ? 1 : 0;
    this.hand(f, 0, input.left);
    this.hand(f, 1, input.right);
    const ev = input.shapeEvents;
    const n = ev ? ev.count : 0;
    const kept = n < EVENTS_PER_FRAME ? n : EVENTS_PER_FRAME;
    this.eventsDropped += n - kept;
    this.eventCount[f] = kept;
    for (let i = 0; i < kept; i++) {
      const e = ev!.at(i);
      const c = (f * EVENTS_PER_FRAME + i) * 4,
        m = (f * EVENTS_PER_FRAME + i) * 3;
      this.eventCodes[c] = EVENT_TYPES.indexOf(e.type);
      this.eventCodes[c + 1] = e.hand === 'left' ? 0 : 1;
      this.eventCodes[c + 2] = SHAPES.indexOf(e.shape);
      this.eventCodes[c + 3] = REASONS.indexOf(e.reason);
      this.eventNums[m] = e.t;
      this.eventNums[m + 1] = e.margin;
      this.eventNums[m + 2] = e.heldS;
    }
  }

  private hand(f: number, h: number, sh: HandShadow | null): void {
    const present = sh !== null && sh.active;
    this.active[f * 2 + h] = present ? 1 : 0;
    if (!present) return;
    this.capsules.set(sh.capsules, (f * 2 + h) * CAPS);
    this.bounds.set(sh.bounds, (f * 2 + h) * 4);
  }
}

/**
 * Plays a recording into `game` (which should be built with the same options as the recorded one),
 * frame by frame. `each` runs after every frame, e.g. to compare against expectations.
 */
export function replay(rec: InputRecorder, game: Game, each?: (frame: number) => void): void {
  const left = createHandShadow('left'),
    right = createHandShadow('right');
  const queue = new ShapeEventQueue(EVENTS_PER_FRAME);
  const input: GameInput = { dt: 0, paused: false, left, right, shapeEvents: queue };
  for (let f = 0; f < rec.frames; f++) {
    input.dt = rec.dt[f];
    input.paused = rec.paused[f] === 1;
    restoreHand(rec, f, 0, left);
    restoreHand(rec, f, 1, right);
    queue.clear();
    for (let i = 0; i < rec.eventCount[f]; i++) {
      const c = (f * EVENTS_PER_FRAME + i) * 4,
        m = (f * EVENTS_PER_FRAME + i) * 3;
      const hand: Handedness = rec.eventCodes[c + 1] === 0 ? 'left' : 'right';
      queue.push(
        EVENT_TYPES[rec.eventCodes[c]],
        hand,
        SHAPES[rec.eventCodes[c + 2]],
        rec.eventNums[m],
        rec.eventNums[m + 1],
        rec.eventNums[m + 2],
        REASONS[rec.eventCodes[c + 3]],
      );
    }
    game.frame(input);
    each?.(f);
  }
}

function restoreHand(rec: InputRecorder, f: number, h: number, sh: HandShadow): void {
  sh.active = rec.active[f * 2 + h] === 1;
  sh.onStage = sh.active;
  if (!sh.active) return;
  const o = (f * 2 + h) * CAPS;
  sh.capsules.set(rec.capsules.subarray(o, o + CAPS));
  const b = (f * 2 + h) * 4;
  sh.bounds.set(rec.bounds.subarray(b, b + 4));
}
