// Companions (GDD "Animal companions"): holding the rabbit or fox shape for about a second (the
// classifier's longer companion hold) lets the creature break free from the hand and become an
// independent helper for a while. Plain TypeScript; no allocation per step.
//
//   rabbit  hops: walks toward the goal and leaps any gap ahead (about 0.68 m), so it can cross a
//           chasm the traveller can't and pull a rope across (puzzle 4 watches `rabbit.crossedAt`).
//   fox     digs and scares: walks toward the goal; at a gate it digs under it (`fox.dugGate`) and
//           goes on through; crows near it take fright (puzzle 5 reads the fox's position). It
//           waits at a gap it can't cross.
//
// One of each at a time; making the shape again while one is out calls it back to the hand. Each
// fades after LIFETIME_S, or when it walks off the stage.

import { CAPSULE_STRIDE } from '../engine/hands/hand-shadow';
import type { Shape } from '../engine/hands/shapes';
import { Flag, Kind, type KindId } from '../engine/sim/entity-kinds';
import { NULL_HANDLE, type Handle } from '../engine/sim/entity-store';
import { Touch, type Support } from '../engine/sim/solver';
import { WALL_WIDTH_M } from '../engine/stage/stage-frame';
import type { GameContext } from './context';
import { TerrainTag } from './level';

export type CompanionName = 'rabbit' | 'fox';
export type CompanionState = 'away' | 'walk' | 'hop' | 'dig' | 'wait';

/** Seconds a companion stays before fading. */
export const LIFETIME_S = 15;
export const COMPANION_RADIUS = 0.035;
const RABBIT_SPEED = 0.18;
const FOX_SPEED = 0.15;
/** A rabbit's leap: launch speeds, m/s (about 0.68 m long and 0.34 m high under the stage's gravity). */
const HOP_VX = 0.65;
const HOP_VY = 1.3;
/** Seconds of digging to get under a gate. */
export const DIG_S = 1.5;

export class Companion {
  handle: Handle = NULL_HANDLE;
  state: CompanionState = 'away';
  stateT = 0;
  age = 0;
  dir = 1;
  /** Rabbit: stage x where it last landed after a leap over a gap, or NaN. */
  crossedAt = NaN;
  /** Fox: the terrain index of the gate it dug under, or -1. */
  dugGate = -1;
  /** Where the current leap started (internal). */
  hopFromX = 0;
  /** Scratch for ground queries (internal). */
  readonly support: Support = { y: 0, type: Touch.None, id: -1 };

  constructor(
    readonly name: CompanionName,
    readonly kind: KindId,
  ) {}

  get out(): boolean {
    return this.state !== 'away';
  }

  setState(next: CompanionState): void {
    if (next !== this.state) {
      this.state = next;
      this.stateT = 0;
    }
  }
}

export class Companions {
  readonly rabbit = new Companion('rabbit', Kind.Rabbit);
  readonly fox = new Companion('fox', Kind.Fox);

  /** A companion shape committed at (x, y): the creature breaks free there. */
  release(shape: Shape, x: number, y: number, ctx: GameContext): void {
    const c = shape === 'rabbit' ? this.rabbit : shape === 'fox' ? this.fox : null;
    if (!c) return;
    if (c.out) this.dismiss(c, ctx, false);
    const half = WALL_WIDTH_M / 2 - COMPANION_RADIUS;
    const sx = x < -half ? -half : x > half ? half : x;
    c.handle = ctx.store.create(c.kind, sx, y, COMPANION_RADIUS);
    if (c.handle === NULL_HANDLE) return;
    c.setState('walk');
    c.age = 0;
    c.crossedAt = NaN;
    c.dugGate = -1;
    // Toward the goal, which is the way the traveller walks.
    c.dir = ctx.traveller.dir;
    ctx.events.push('companion-released', c.name, ctx.time, 0, sx, y);
  }

  /** Before the solver. */
  think(ctx: GameContext): void {
    this.thinkOne(this.rabbit, ctx);
    this.thinkOne(this.fox, ctx);
  }

  /** After the solver: landings, the stage edge and age. */
  after(ctx: GameContext): void {
    this.afterOne(this.rabbit, ctx);
    this.afterOne(this.fox, ctx);
  }

  /** Slot of a companion that is out, or -1. */
  slotOf(c: Companion, ctx: GameContext): number {
    return c.out ? ctx.store.slotOf(c.handle) : -1;
  }

  /** Takes both companions off the stage without events (a puzzle reload clears the store anyway). */
  reset(): void {
    for (let i = 0; i < 2; i++) {
      const c = i === 0 ? this.rabbit : this.fox;
      c.state = 'away';
      c.handle = NULL_HANDLE;
      c.stateT = 0;
      c.age = 0;
      // What a companion did in the last puzzle must not count in the next (or a restart).
      c.crossedAt = NaN;
      c.dugGate = -1;
    }
  }

  private thinkOne(c: Companion, ctx: GameContext): void {
    const s = this.slotOf(c, ctx);
    if (s < 0) return;
    const { store, solver } = ctx;
    c.stateT += ctx.dt;
    const grounded = (store.flags[s] & Flag.Grounded) !== 0;
    if (!grounded) return; // In the air: the leap or a fall carries on.
    if (c.state === 'hop') {
      c.setState('walk');
      if (Math.abs(store.x[s] - c.hopFromX) > 0.3) c.crossedAt = store.x[s];
    }
    const x = store.x[s],
      y = store.y[s],
      r = store.radius[s];
    const bit = 1 << c.kind;
    const ahead = x + c.dir * (r + 0.03);
    const ground = solver.supportBelow(ahead, y - r + 0.03, y - r - 0.05, bit, c.support);
    if (c.name === 'fox') {
      const gate = gateAhead(ctx, x + c.dir * (r + 0.02), y, r);
      if (gate >= 0 && c.dugGate < 0) {
        c.setState('dig');
        store.vx[s] = 0;
        if (c.stateT >= DIG_S) {
          c.dugGate = gate;
          ctx.events.push('puzzle-event', 'dig', ctx.time, gate, x, y);
          // Through the tunnel and on: the puzzle opens the way when it sees dugGate.
          c.setState('walk');
        }
        return;
      }
      // Walk while there is ground ahead; wait at a gap, and walk on once it is bridged (or the
      // gate it was digging at opened by itself).
      store.vx[s] = ground ? c.dir * FOX_SPEED : 0;
      c.setState(ground ? 'walk' : 'wait');
      return;
    }
    // Rabbit: leap any gap ahead; turn back from a wall. Standing on another creature (it landed on
    // the traveller's head) is not the edge of a gap: it just walks off.
    if (!ground && solver.groundType[s] !== Touch.Entity) {
      c.hopFromX = x;
      store.vx[s] = c.dir * HOP_VX;
      store.vy[s] = HOP_VY;
      c.setState('hop');
      return;
    }
    if (solver.blocked(store, x + c.dir * (r * 0.5 + 0.02), y + 0.02, r * 0.75, bit, s)) c.dir = -c.dir;
    store.vx[s] = c.dir * RABBIT_SPEED;
  }

  private afterOne(c: Companion, ctx: GameContext): void {
    const s = this.slotOf(c, ctx);
    if (s < 0) {
      if (c.out) c.setState('away');
      return;
    }
    c.age += ctx.dt;
    const store = ctx.store;
    const offStage = Math.abs(store.x[s]) > WALL_WIDTH_M / 2 + 0.1 || store.y[s] < ctx.groundY - 0.35;
    if (c.age >= LIFETIME_S || offStage) this.dismiss(c, ctx, true);
  }

  private dismiss(c: Companion, ctx: GameContext, announce: boolean): void {
    ctx.store.destroy(c.handle);
    c.handle = NULL_HANDLE;
    c.setState('away');
    if (announce) ctx.events.push('companion-gone', c.name, ctx.time);
  }
}

/** The gate capsule (TerrainTag.Gate) a circle at (x, y, r) touches, or -1. */
function gateAhead(ctx: GameContext, x: number, y: number, r: number): number {
  const t = ctx.solver.terrain;
  for (let i = 0; i < t.count; i++) {
    if (!t.enabled[i] || t.tag[i] !== TerrainTag.Gate) continue;
    const o = i * CAPSULE_STRIDE;
    const d = t.data;
    // Gates stand upright: compare x against the post and y against its span.
    const gx = d[o],
      top = Math.max(d[o + 1], d[o + 3]) + d[o + 4],
      bottom = Math.min(d[o + 1], d[o + 3]) - d[o + 4];
    if (Math.abs(x - gx) <= r + d[o + 4] && y <= top && y >= bottom) return i;
  }
  return -1;
}
