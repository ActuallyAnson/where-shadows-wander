// What the game tells the rest of the app (audio, saves, UI, the renderer's effects): a fixed queue
// of reused event objects, filled during Game.frame() and read after it. Plain TypeScript.
//
// Contract (ADR 0008): the queue holds the events of one display frame, from all the fixed steps
// that frame ran, oldest first. Game.frame() clears it at the start, so read it every frame after
// frame() returns. Event objects are reused: copy what you keep. `id` is always one of the game's
// constant strings (a puzzle, solution, role, state or creature name), never built per event.

import type { Handedness } from '../engine/hands/hand';

export type GameEventType =
  /** A puzzle began (id: puzzle id, value: its index). */
  | 'puzzle-start'
  /** The traveller reached the goal (id: the solution that was used, value: puzzle index). */
  | 'puzzle-solved'
  /** The last puzzle of the chapter was solved. */
  | 'chapter-complete'
  /** A committed shape took its role (id: role name, hand). */
  | 'ability-start'
  /** A role ended (id: role name, hand). */
  | 'ability-end'
  /** The traveller changed state (id: new state). */
  | 'traveller-state'
  /** The traveller fell and was put back at its start. */
  | 'traveller-fell'
  /** A companion broke free of the hand (id: rabbit or fox). */
  | 'companion-released'
  /** A companion faded away (id: rabbit or fox). */
  | 'companion-gone'
  /** A creature was found for the first time (id: rabbit or fox). */
  | 'creature-discovered'
  /** Show the ghost hint (id: the shape to make, x, y: where on the stage). */
  | 'hint-show'
  /** Hide the ghost hint. */
  | 'hint-hide'
  /** The cup caught something (id: raindrop or firefly, value: how many it holds, hand). */
  | 'caught'
  /** A raindrop hit something and burst (id: ground, hand or traveller). */
  | 'splash'
  /** A puzzle object changed (id: gate-open, gate-close, rope-lowered, dig, crows-flee, lantern-out, ...). */
  | 'puzzle-event';

export interface GameEvent {
  type: GameEventType;
  /** A constant string whose meaning depends on the type (see above); '' when unused. */
  id: string;
  /** The hand involved, if any. */
  hand: Handedness | null;
  value: number;
  /** Stage position, metres, where it makes sense. */
  x: number;
  y: number;
  /** Simulation time, seconds since the game started. */
  t: number;
}

export class GameEventQueue {
  private readonly events: GameEvent[];
  private size = 0;
  /** Events dropped because the queue was full this frame. */
  dropped = 0;

  constructor(readonly capacity = 64) {
    this.events = Array.from({ length: capacity }, () => ({
      type: 'puzzle-event' as GameEventType,
      id: '',
      hand: null,
      value: 0,
      x: 0,
      y: 0,
      t: 0,
    }));
  }

  get count(): number {
    return this.size;
  }

  /** The i-th event this frame, oldest first. */
  at(i: number): Readonly<GameEvent> {
    if (i < 0 || i >= this.size) throw new RangeError(`No event ${i} (${this.size} queued)`);
    return this.events[i];
  }

  clear(): void {
    this.size = 0;
  }

  /** Adds an event; once full, later ones are dropped (and counted) so the oldest survive. */
  push(type: GameEventType, id: string, t: number, value = 0, x = 0, y = 0, hand: Handedness | null = null): void {
    if (this.size === this.capacity) {
      this.dropped++;
      return;
    }
    const e = this.events[this.size++];
    e.type = type;
    e.id = id;
    e.hand = hand;
    e.value = value;
    e.x = x;
    e.y = y;
    e.t = t;
  }

  /** Whether an event of this type (and id, if given) is queued: for tests and simple listeners. */
  has(type: GameEventType, id?: string): boolean {
    for (let i = 0; i < this.size; i++) {
      const e = this.events[i];
      if (e.type === type && (id === undefined || e.id === id)) return true;
    }
    return false;
  }
}
