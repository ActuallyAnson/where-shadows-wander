// The traveller (GDD "The traveller"): a small figure that walks on its own toward the goal, stops at
// obstacles, waits and looks back at the player. The player never controls it; they change the world
// around it. Plain TypeScript; no allocation per step.
//
// States (`state`, with `stateT` seconds in it, for the animation and audio):
//   walk       ground ahead and nothing in the way: walks at WALK_SPEED toward the goal
//   blocked    a gap or a wall ahead: stands still
//   look-back  blocked for LOOK_BACK_S: turns to look at the player (the cue to help)
//   held       a puzzle hazard stops it (rain on its lantern, crows on the path): waits
//   pushed     wind pushes it backward faster than it can walk
//   falling    nothing under it
//   goal       reached the goal marker: done
//
// No fail state (a design call, see docs/SIMULATION.md): if the ground vanishes under it (a bridge
// hand pulled away mid-crossing) it falls, and is put back at its start with a `traveller-fell`
// event, never hurt.
//
// Each step: think() before the solver sets its speed from what is ahead; after() reads the solver's
// result (falling, the goal, falling off the stage). Puzzles steer it only through `hold(reason)` and
// `push` (a horizontal speed added by wind).

import { Flag, Kind } from '../engine/sim/entity-kinds';
import { NULL_HANDLE, type EntityStore, type Handle } from '../engine/sim/entity-store';
import type { LayoutMarker } from '../engine/sim/scene-layout';
import { Touch, type Support } from '../engine/sim/solver';
import type { GameContext } from './context';

export type TravellerState = 'walk' | 'blocked' | 'look-back' | 'held' | 'pushed' | 'falling' | 'goal';

/** Walking speed, stage metres per second (the 1.6 m stage takes about 13 s). */
export const WALK_SPEED = 0.12;
/** Seconds blocked before it looks back at the player. */
export const LOOK_BACK_S = 3;
/** Highest step up it takes in its stride, and the furthest step down, metres. */
const STEP_UP = 0.03;
const STEP_DOWN = 0.05;
/** How far ahead of its edge it looks for ground, metres. */
const LOOK_AHEAD = 0.03;
/** Seconds without ground before it counts as falling (not every bump). */
const FALL_AFTER_S = 0.15;
/** Below the ground by this much it has fallen off the stage. */
const FELL_BELOW = 0.35;

const TRAVELLER_BIT = 1 << Kind.Traveller;

export class Traveller {
  handle: Handle = NULL_HANDLE;
  state: TravellerState = 'walk';
  /** Seconds in the current state. */
  stateT = 0;
  /** +1 walks right, -1 left. */
  dir = 1;
  /** A horizontal speed puzzles add this step (wind), m/s; cleared after each step. */
  push = 0;
  /** What stopped it this step, set by a puzzle through hold(); cleared after each step. */
  holdReason = '';
  /** Seconds since it last had ground under it. */
  private airT = 0;
  private startX = 0;
  private startY = 0;
  private goal: LayoutMarker | null = null;
  private readonly support: Support = { y: 0, type: Touch.None, id: -1 };

  /** Takes charge of the traveller entity the layout spawned, and the goal it walks to. */
  spawn(ctx: GameContext, goal: LayoutMarker | null): void {
    const store = ctx.store;
    const s = store.kindStart[Kind.Traveller];
    this.handle = store.handleAt(s);
    this.goal = goal;
    this.startX = store.x[s];
    this.startY = store.y[s];
    this.dir = goal && goal.x < this.startX ? -1 : 1;
    this.state = 'walk';
    this.stateT = 0;
    this.airT = 0;
    this.push = 0;
    this.holdReason = '';
  }

  /** The traveller's slot, or -1 if there is none. */
  slot(ctx: GameContext): number {
    return ctx.store.slotOf(this.handle);
  }

  /** Called by a puzzle each step it wants the traveller to wait (e.g. 'rain', 'crows'). */
  hold(reason: string): void {
    this.holdReason = reason;
  }

  /** Before the solver: decides where it is going this step. */
  think(ctx: GameContext): void {
    const s = this.slot(ctx);
    if (s < 0) return;
    const { store, solver } = ctx;
    if (this.state === 'goal') {
      store.vx[s] = 0;
      return;
    }
    const x = store.x[s],
      y = store.y[s],
      r = store.radius[s];
    const grounded = (store.flags[s] & Flag.Grounded) !== 0;
    let next: TravellerState;
    let vx: number;
    if (!grounded && this.airT > FALL_AFTER_S) {
      next = 'falling';
      vx = store.vx[s];
    } else if (this.holdReason !== '') {
      next = 'held';
      vx = 0;
    } else {
      const ahead = x + this.dir * (r + LOOK_AHEAD);
      const feet = y - r;
      const ground = solver.supportBelow(ahead, feet + STEP_UP, feet - STEP_DOWN, TRAVELLER_BIT, this.support);
      // A circle above stride height just ahead: anything there is a wall, not a step.
      const px = x + this.dir * (r * 0.5 + 0.02),
        py = y + 0.025,
        pr = r * 0.75;
      // A wall, or a rock standing in the way: it waits rather than shoving it along.
      const wall = solver.blocked(store, px, py, pr, TRAVELLER_BIT, s) || bodyAhead(store, px, y, pr);
      if (ground && !wall) {
        next = 'walk';
        vx = this.dir * WALK_SPEED;
      } else {
        next = this.state === 'blocked' || this.state === 'look-back' ? this.state : 'blocked';
        if (next === 'blocked' && this.stateT >= LOOK_BACK_S) next = 'look-back';
        vx = 0;
      }
    }
    vx += this.push;
    if (next === 'walk' && this.push !== 0 && vx * this.dir <= 0) next = 'pushed';
    else if (
      (next === 'blocked' || next === 'look-back' || next === 'held') &&
      this.push * this.dir < -WALK_SPEED * 0.5
    )
      next = 'pushed';
    store.vx[s] = vx;
    this.setState(next, ctx);
  }

  /** After the solver: ground, the goal, and falling off the stage. Clears the step's hold and push. */
  after(ctx: GameContext): void {
    const s = this.slot(ctx);
    this.holdReason = '';
    this.push = 0;
    if (s < 0) return;
    const store = ctx.store;
    if (store.flags[s] & Flag.Grounded) this.airT = 0;
    else this.airT += ctx.dt;
    if (this.state !== 'goal' && this.goal && this.atGoal(store.x[s], store.y[s], store.radius[s])) {
      store.vx[s] = 0;
      this.setState('goal', ctx);
      return;
    }
    if (store.y[s] < ctx.groundY - FELL_BELOW) {
      store.x[s] = this.startX;
      store.y[s] = this.startY;
      store.vx[s] = 0;
      store.vy[s] = 0;
      store.snapPrev(s);
      this.airT = 0;
      ctx.events.push('traveller-fell', '', ctx.time, 0, this.startX, this.startY);
      this.setState('walk', ctx);
    }
  }

  /** What the traveller stands on this step (a Touch), and which one (terrain index, hand, slot). */
  standingOn(ctx: GameContext): number {
    const s = this.slot(ctx);
    return s < 0 ? Touch.None : ctx.solver.groundType[s];
  }

  standingOnId(ctx: GameContext): number {
    const s = this.slot(ctx);
    return s < 0 ? -1 : ctx.solver.groundId[s];
  }

  private atGoal(x: number, y: number, r: number): boolean {
    const g = this.goal!;
    return Math.abs(x - g.x) <= g.params.width / 2 + r && Math.abs(y - g.y) <= g.params.height / 2 + r;
  }

  private setState(next: TravellerState, ctx: GameContext): void {
    if (next === this.state) {
      this.stateT += ctx.dt;
      return;
    }
    this.state = next;
    this.stateT = 0;
    ctx.events.push('traveller-state', next, ctx.time);
  }
}

/** Kinds the traveller will not walk into: it stops for them as for a wall. */
const STOPS_FOR = [Kind.Rock] as const;

/** Whether a rock overlaps the probe circle ahead (at body height). */
function bodyAhead(store: EntityStore, x: number, y: number, r: number): boolean {
  for (let k = 0; k < STOPS_FOR.length; k++) {
    const kind = STOPS_FOR[k];
    for (let s = store.kindStart[kind]; s < store.kindEnd[kind]; s++) {
      if (!store.alive[s]) continue;
      const dx = store.x[s] - x,
        dy = store.y[s] - y,
        rr = store.radius[s] + r;
      if (dx * dx + dy * dy < rr * rr) return true;
    }
  }
  return false;
}
