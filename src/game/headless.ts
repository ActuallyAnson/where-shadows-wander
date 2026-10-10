// Plays the game with no headset: scripted hand poses stand in for tracked hands, and a stand-in
// classifier turns them into shape events with the GDD's hold times. Used by the puzzle tests (each
// puzzle is solved both ways here) and handy for trying a puzzle idea from a script.
// Plain TypeScript. Test and tooling code: it allocates freely (the event log).

import type { Handedness } from '../engine/hands/hand';
import { createHandShadow, type HandShadow } from '../engine/hands/hand-shadow';
import { ShapeEventQueue } from '../engine/hands/shape-events';
import { COMPANION_SHAPES, type Shape } from '../engine/hands/shapes';
import { hideShadow, shapeShadow } from '../engine/sim/shadow-shapes';
import { Game, type GameInput, type GameOptions } from './game';
import type { InputRecorder } from './replay';

/** Classifier hold times (GDD): a shape commits after 0.4 s, a companion shape after about 1 s. */
export const HOLD_S = 0.4;
export const COMPANION_HOLD_S = 1.0;

interface ScriptedHand {
  shape: Shape | null;
  x: number;
  y: number;
  committed: Shape | null;
  /** The shape being held toward a commit, and for how long. */
  holding: Shape | null;
  heldS: number;
}

export class Headless {
  readonly game: Game;
  readonly shadows: Record<Handedness, HandShadow> = {
    left: createHandShadow('left'),
    right: createHandShadow('right'),
  };
  /** Every game event so far, as "type:id" (and the sim time), for assertions. */
  readonly log: { t: number; what: string }[] = [];
  /** Seconds of display time run so far. */
  t = 0;
  private readonly queue = new ShapeEventQueue(16);
  private readonly hands: Record<Handedness, ScriptedHand> = {
    left: { shape: null, x: 0, y: 0, committed: null, holding: null, heldS: 0 },
    right: { shape: null, x: 0, y: 0, committed: null, holding: null, heldS: 0 },
  };
  paused = false;
  /** When set, every frame's input is recorded (for replay tests and bug reports). */
  recorder: InputRecorder | null = null;

  constructor(
    opts: GameOptions,
    readonly displayHz = 72,
  ) {
    this.game = new Game(opts);
    this.record();
  }

  /** Holds `shape` with `hand`, its shadow centred on (x, y) on the stage. */
  pose(hand: Handedness, shape: Shape, x: number, y: number): this {
    const h = this.hands[hand];
    h.shape = shape;
    h.x = x;
    h.y = y;
    return this;
  }

  /** Moves a hand without changing its shape. */
  move(hand: Handedness, x: number, y: number): this {
    this.hands[hand].x = x;
    this.hands[hand].y = y;
    return this;
  }

  /** Takes a hand out of the light. */
  hide(hand: Handedness): this {
    this.hands[hand].shape = null;
    return this;
  }

  /** Runs `seconds` of display frames; `each` runs before every frame (to move hands smoothly). */
  run(seconds: number, each?: (t: number) => void): this {
    const n = Math.round(seconds * this.displayHz);
    for (let i = 0; i < n; i++) {
      each?.(this.t);
      this.frame();
    }
    return this;
  }

  /** Runs until `done()` (checked each frame) or `maxSeconds`. @returns whether it happened. */
  runUntil(done: () => boolean, maxSeconds: number, each?: (t: number) => void): boolean {
    const n = Math.round(maxSeconds * this.displayHz);
    for (let i = 0; i < n; i++) {
      if (done()) return true;
      each?.(this.t);
      this.frame();
    }
    return done();
  }

  /** Whether an event of this type (and id) has happened. */
  saw(type: string, id?: string): boolean {
    const want = id === undefined ? `${type}:` : `${type}:${id}`;
    return this.log.some((e) => (id === undefined ? e.what.startsWith(want) : e.what === want));
  }

  private frame(): void {
    const dt = 1 / this.displayHz;
    this.queue.clear();
    for (const hand of ['left', 'right'] as const) this.classify(hand, dt);
    const input: GameInput = {
      dt,
      paused: this.paused,
      left: this.shadows.left,
      right: this.shadows.right,
      shapeEvents: this.queue,
    };
    this.recorder?.record(input);
    this.game.frame(input);
    this.t += dt;
    this.record();
  }

  /** The stand-in classifier: candidate, then commit after the hold; release on exit or switch. */
  private classify(hand: Handedness, dt: number): void {
    const h = this.hands[hand];
    const sh = this.shadows[hand];
    if (h.shape === null) {
      hideShadow(sh);
      if (h.committed) this.queue.push('release', hand, h.committed, this.t, 0, 0, 'exit');
      h.committed = null;
      h.holding = null;
      h.heldS = 0;
      return;
    }
    shapeShadow(sh, h.shape, h.x, h.y);
    if (h.shape === h.committed) return;
    if (h.holding !== h.shape) {
      h.holding = h.shape;
      h.heldS = 0;
      this.queue.push('candidate', hand, h.shape, this.t, 0.5, 0);
    }
    h.heldS += dt;
    const need = COMPANION_SHAPES.includes(h.shape) ? COMPANION_HOLD_S : HOLD_S;
    if (h.heldS >= need) {
      if (h.committed) this.queue.push('release', hand, h.committed, this.t, 0, h.heldS, 'switch');
      this.queue.push('commit', hand, h.shape, this.t, 0.5, h.heldS);
      h.committed = h.shape;
      h.holding = null;
    }
  }

  private record(): void {
    const ev = this.game.events;
    for (let i = 0; i < ev.count; i++) {
      const e = ev.at(i);
      this.log.push({ t: e.t, what: `${e.type}:${e.id}` });
    }
  }
}
