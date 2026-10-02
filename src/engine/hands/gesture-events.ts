// The lantern gestures (GDD "The lantern"; issue #10) for Teammate B's lantern
// flow. Plain TypeScript: no IWSDK, no three.js.
//   pinch-release: a thumb-index pinch held at least 150 ms, then let go; the
//     position is where the fingertips met (place or relight the lantern there).
//   cover-flame: a closed hand held over the lantern for 0.5 s (pause).
import type { Handedness, Vec3 } from './hand';

export type GestureType = 'pinch-release' | 'cover-flame';

export interface GestureEvent {
  type: GestureType;
  hand: Handedness;
  /** The caller's clock, seconds. */
  t: number;
  /** pinch-release: the thumb-index midpoint just before the fingers opened. cover-flame: the palm centre. Scene space, metres. */
  readonly position: Vec3;
  /** How long the pinch or cover was held, seconds. */
  heldS: number;
}

/** Live per-hand gesture state, for feedback (e.g. the lantern following a pinch). */
export interface GestureState {
  readonly hand: Handedness;
  pinching: boolean;
  pinchHeldS: number;
  /** Where the fingertips meet while pinching (scene space). */
  readonly pinchPoint: Vec3;
  /** 0..1 of the cover-flame hold; 1 once it has fired, until the hand leaves. */
  coverProgress: number;
  /** The palm is within the cover radius (plus its exit margin) of the lantern. */
  nearLantern: boolean;
  lanternDistM: number;
  /** Tracking is partial: gestures wait rather than guess. */
  paused: boolean;
}

export function createGestureState(hand: Handedness): GestureState {
  return {
    hand,
    pinching: false,
    pinchHeldS: 0,
    pinchPoint: [0, 0, 0],
    coverProgress: 0,
    nearLantern: false,
    lanternDistM: Infinity,
    paused: false,
  };
}

/**
 * This update's gesture events, oldest first. The event objects are reused:
 * read them before the next update and copy what you keep. Over capacity, the
 * oldest are dropped and counted.
 */
export class GestureEventQueue {
  private readonly events: GestureEvent[];
  private start = 0;
  private size = 0;
  dropped = 0;

  constructor(readonly capacity = 8) {
    this.events = Array.from({ length: capacity }, () => ({
      type: 'pinch-release' as GestureType,
      hand: 'right' as Handedness,
      t: 0,
      position: [0, 0, 0] as Vec3,
      heldS: 0,
    }));
  }

  get count(): number {
    return this.size;
  }

  at(i: number): Readonly<GestureEvent> {
    if (i < 0 || i >= this.size) throw new RangeError(`No event ${i} (${this.size} queued)`);
    return this.events[(this.start + i) % this.capacity];
  }

  clear(): void {
    this.start = 0;
    this.size = 0;
  }

  push(type: GestureType, hand: Handedness, t: number, x: number, y: number, z: number, heldS: number): void {
    if (this.size === this.capacity) {
      this.start = (this.start + 1) % this.capacity;
      this.size--;
      this.dropped++;
    }
    const e = this.events[(this.start + this.size) % this.capacity];
    this.size++;
    e.type = type;
    e.hand = hand;
    e.t = t;
    e.position[0] = x;
    e.position[1] = y;
    e.position[2] = z;
    e.heldS = heldS;
  }
}
