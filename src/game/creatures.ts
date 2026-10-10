// The small creatures that live on the stage without the player's help: fireflies drifting around
// where they were placed, and crows perched on the path that fly off when frightened or follow a
// light that lures them. Puzzles decide when a crow is scared or lured (GameFlag.Scared / Lured);
// this moves them. Plain TypeScript; no allocation per step.

import { Kind } from '../engine/sim/entity-kinds';
import type { EntityStore } from '../engine/sim/entity-store';
import { WALL_HEIGHT_M, WALL_WIDTH_M } from '../engine/stage/stage-frame';
import type { GameContext } from './context';
import { GameFlag } from './flags';

/** How far fireflies wander from home, metres, and how quickly they settle back. */
const FIREFLY_WANDER = 0.04;
const FIREFLY_PULL = 2;
/** Crow flight speeds, m/s. */
const CROW_FLEE_VX = 0.7;
const CROW_FLEE_VY = 0.6;
const CROW_LURE_SPEED = 0.3;

export class Creatures {
  /** Where each firefly was placed (per slot), so it drifts around that spot. */
  private readonly homeX: Float64Array;
  private readonly homeY: Float64Array;
  /** Where lured crows head (set by the puzzle, e.g. the cup of fireflies). */
  lureX = 0;
  lureY = 0;

  constructor(capacity: number) {
    this.homeX = new Float64Array(capacity);
    this.homeY = new Float64Array(capacity);
  }

  /** On puzzle load, after spawning: remembers where the fireflies start. */
  settle(store: EntityStore): void {
    for (let s = store.kindStart[Kind.Firefly]; s < store.kindEnd[Kind.Firefly]; s++) {
      this.homeX[s] = store.x[s];
      this.homeY[s] = store.y[s];
    }
  }

  /** Before the solver: sets the creatures' speeds. */
  think(ctx: GameContext): void {
    const store = ctx.store;
    const t = ctx.time;
    for (let s = store.kindStart[Kind.Firefly]; s < store.kindEnd[Kind.Firefly]; s++) {
      if (!store.alive[s] || store.flags[s] & GameFlag.Carried) continue;
      // A slow loop around home, each firefly on its own phase.
      const k = s - store.kindStart[Kind.Firefly];
      const tx = this.homeX[s] + Math.cos(t * 0.9 + k * 1.7) * FIREFLY_WANDER;
      const ty = this.homeY[s] + Math.sin(t * 1.3 + k * 2.3) * FIREFLY_WANDER;
      store.vx[s] = (tx - store.x[s]) * FIREFLY_PULL;
      store.vy[s] = (ty - store.y[s]) * FIREFLY_PULL;
    }
    for (let s = store.kindStart[Kind.Crow]; s < store.kindEnd[Kind.Crow]; s++) {
      if (!store.alive[s]) continue;
      const f = store.flags[s];
      if (f & GameFlag.Scared) {
        // Away from the middle of the stage and up.
        store.vx[s] = store.x[s] >= 0 ? CROW_FLEE_VX : -CROW_FLEE_VX;
        store.vy[s] = CROW_FLEE_VY;
      } else if (f & GameFlag.Lured) {
        const dx = this.lureX - store.x[s],
          dy = this.lureY - store.y[s];
        const d = Math.sqrt(dx * dx + dy * dy);
        const v = d > 0.05 ? CROW_LURE_SPEED / d : 0;
        store.vx[s] = dx * v;
        store.vy[s] = dy * v;
      } else {
        store.vx[s] = 0;
        store.vy[s] = 0;
      }
    }
  }

  /** After the solver: crows that have flown off the stage are gone. */
  after(ctx: GameContext): void {
    const store = ctx.store;
    for (let s = store.kindStart[Kind.Crow]; s < store.kindEnd[Kind.Crow]; s++) {
      if (!store.alive[s]) continue;
      if (Math.abs(store.x[s]) > WALL_WIDTH_M / 2 + 0.1 || store.y[s] > WALL_HEIGHT_M / 2 + 0.1)
        store.destroy(store.handleAt(s));
    }
  }
}
