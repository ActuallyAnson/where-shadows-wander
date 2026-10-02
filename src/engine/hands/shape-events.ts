// What the shape classifier tells the game. Teammate A's simulation imports
// these (src/engine/hands is pure, so pure code may). Plain TypeScript.
//
// For one hand and shape the events go: candidate (recognised: start
// sharpening the shadow, GDD "How a shape is used"), then either cancel (it
// stopped matching before the hold finished: un-sharpen) or commit (held long
// enough: the shape takes its role), and later release (the role ends).
// Hold progress for the sharpen effect is polled from ShapeState each frame.
import type { Handedness } from './hand';
import type { Shape } from './shapes';

export type ShapeEventType = 'candidate' | 'cancel' | 'commit' | 'release';
/** exit: the hand left the shape. switch: another shape committed. lost: tracking was lost too long. */
export type ReleaseReason = 'exit' | 'switch' | 'lost';

export interface ShapeEvent {
  type: ShapeEventType;
  hand: Handedness;
  shape: Shape;
  /** The caller's clock, seconds. */
  t: number;
  /** How far inside the shape's ranges the hand was, in tolerance units (0 = on the edge). */
  margin: number;
  /** Seconds the shape had been held (at commit: the hold time). */
  heldS: number;
  /** Set on release only. */
  reason: ReleaseReason | null;
}

/** Where one hand's classifier is, for the UI and the sharpen effect. */
export interface ShapeState {
  hand: Handedness;
  /** paused: tracking is partial, so recognition waits rather than guessing. */
  phase: 'idle' | 'candidate' | 'committed' | 'paused';
  /** The shape being held toward a commit, if any. */
  candidate: Shape | null;
  committed: Shape | null;
  /** 0..1 of the candidate's hold time. */
  progress: number;
  /** The candidate's (or else the committed shape's) margin. */
  margin: number;
  validJoints: number;
}

export function createShapeState(hand: Handedness): ShapeState {
  return { hand, phase: 'idle', candidate: null, committed: null, progress: 0, margin: 0, validJoints: 0 };
}

/**
 * The events from one update, in order. The event objects are reused: read
 * them before the next update, and copy any you keep. If more than `capacity`
 * events arrive in one update, the oldest are dropped and counted.
 */
export class ShapeEventQueue {
  private readonly events: ShapeEvent[];
  private start = 0;
  private size = 0;
  /** Events dropped because the queue was full. */
  dropped = 0;

  constructor(readonly capacity = 16) {
    this.events = Array.from({ length: capacity }, () => ({
      type: 'candidate' as ShapeEventType,
      hand: 'right' as Handedness,
      shape: 'flat' as Shape,
      t: 0,
      margin: 0,
      heldS: 0,
      reason: null,
    }));
  }

  get count(): number {
    return this.size;
  }

  /** The i-th event, oldest first. */
  at(i: number): Readonly<ShapeEvent> {
    if (i < 0 || i >= this.size) throw new RangeError(`No event ${i} (${this.size} queued)`);
    return this.events[(this.start + i) % this.capacity];
  }

  clear(): void {
    this.start = 0;
    this.size = 0;
  }

  push(
    type: ShapeEventType,
    hand: Handedness,
    shape: Shape,
    t: number,
    margin: number,
    heldS: number,
    reason: ReleaseReason | null = null,
  ): void {
    if (this.size === this.capacity) {
      this.start = (this.start + 1) % this.capacity;
      this.size--;
      this.dropped++;
    }
    const e = this.events[(this.start + this.size) % this.capacity];
    this.size++;
    e.type = type;
    e.hand = hand;
    e.shape = shape;
    e.t = t;
    e.margin = margin;
    e.heldS = heldS;
    e.reason = reason;
  }
}
