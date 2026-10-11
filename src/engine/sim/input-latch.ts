// Carries one display frame's hand events into the fixed-step sim. Plain TypeScript.
//
// The shape and gesture queues (src/engine/hands) hold one *display frame's* events and are cleared
// on the next update. The sim steps 0..N times a frame, so reading those queues from every step
// would see a commit twice when a frame takes two steps, and miss it entirely when a frame takes
// none (half the frames at 120 Hz display, 60 Hz sim). So, once per frame, capture() copies the
// events into this latch; the next sim step reads them and calls consume(). Events wait across
// frames until a step takes them, in order.
//
// The copies reuse the queues' own pooled event objects: capture and consume build nothing.
import { GestureEventQueue, type GestureEvent } from '../hands/gesture-events';
import { ShapeEventQueue, type ShapeEvent } from '../hands/shape-events';

/** The parts of the hand queues the latch reads (ShapeEventQueue and GestureEventQueue fit). */
type Readable<E> = { readonly count: number; at(i: number): Readonly<E> };

export class InputLatch {
  /** Shape events not yet taken by a sim step, oldest first. */
  readonly shapes: ShapeEventQueue;
  /** Gesture events not yet taken by a sim step, oldest first. */
  readonly gestures: GestureEventQueue;

  /**
   * Capacities cover several frames without a step (a stall or a paused sim); beyond that the
   * oldest events drop, counted in `shapes.dropped` / `gestures.dropped`.
   */
  constructor(shapeCapacity = 64, gestureCapacity = 32) {
    this.shapes = new ShapeEventQueue(shapeCapacity);
    this.gestures = new GestureEventQueue(gestureCapacity);
  }

  /** Once per display frame, after the classifier and gesture detector have updated. */
  capture(shapes: Readable<ShapeEvent> | null, gestures: Readable<GestureEvent> | null): void {
    if (shapes) {
      for (let i = 0; i < shapes.count; i++) {
        const e = shapes.at(i);
        this.shapes.push(e.type, e.hand, e.shape, e.t, e.margin, e.heldS, e.reason);
      }
    }
    if (gestures) {
      for (let i = 0; i < gestures.count; i++) {
        const e = gestures.at(i);
        this.gestures.push(e.type, e.hand, e.t, e.position[0], e.position[1], e.position[2], e.heldS);
      }
    }
  }

  /** Called by the sim step that has read the pending events. */
  consume(): void {
    this.shapes.clear();
    this.gestures.clear();
  }

  /** Drops everything pending, e.g. on a puzzle reset. */
  clear(): void {
    this.consume();
  }
}
