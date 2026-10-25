// Puzzle 5, crows: crows sit on the path and the traveller won't walk past them. Intended: catch
// fireflies in a cup and use their light to lure the crows off the path, then lift them away. Also
// works: shoo them with a spread hand swept quickly past them.
import { Kind } from '../../engine/sim/entity-kinds';
import { HAND_COUNT } from '../../engine/sim/solver';
import { Role } from '../abilities';
import type { GameContext } from '../context';
import { GameFlag } from '../flags';
import type { PuzzleDef } from '../puzzle';

/** The traveller won't walk within this distance of a crow on the path, metres. */
const WARY = 0.2;
/** A crow counts as on the path while it is lower than this above the ground. */
const ON_PATH = 0.15;
/** A spread hand moving at least this fast (m/s), its centre this close to a crow, scares it. */
export const SHOO_SPEED = 0.5;
const SHOO_REACH = 0.25;
/** A cup with at least this many fireflies, this close to a crow, lures it. */
const LURE_FIREFLIES = 3;
const LURE_REACH = 0.4;

/** The cup hand carrying enough fireflies to lure, or -1. */
function lantern(ctx: GameContext): number {
  for (let h = 0; h < HAND_COUNT; h++) {
    const a = ctx.abilities.hands[h];
    if (ctx.abilities.has(h, Role.Catcher) && a.carried >= LURE_FIREFLIES) return h;
  }
  return -1;
}

/** Whether a spread hand sweeping fast is close enough to scare the crow in slot `s`. */
function shooed(ctx: GameContext, s: number): boolean {
  const store = ctx.store;
  for (let h = 0; h < HAND_COUNT; h++) {
    if (!ctx.abilities.has(h, Role.Wall)) continue;
    const a = ctx.abilities.hands[h];
    if (a.vx * a.vx + a.vy * a.vy < SHOO_SPEED * SHOO_SPEED) continue;
    const dx = a.cx - store.x[s],
      dy = a.cy - store.y[s];
    if (dx * dx + dy * dy <= SHOO_REACH * SHOO_REACH) return true;
  }
  return false;
}

function anyLured(ctx: GameContext): boolean {
  const store = ctx.store;
  for (let s = store.kindStart[Kind.Crow]; s < store.kindEnd[Kind.Crow]; s++) {
    if (store.alive[s] && store.flags[s] & GameFlag.Lured && !(store.flags[s] & GameFlag.Scared)) return true;
  }
  return false;
}

/** A fresh puzzle with its own state: one per Game, so two games never share it. */
export function createCrowsPuzzle(): PuzzleDef {
  return {
    id: 'p5-crows',
    layoutId: 'puzzle-5',
    title: 'Crows',
    solutions: ['fireflies', 'shoo'],
    hintShape: 'cup',

    step(ctx) {
      const { store } = ctx;
      const cup = lantern(ctx);
      let scared = false;
      // Crows flock: once one follows the light, they all do.
      let lured = cup >= 0 && anyLured(ctx);
      for (let s = store.kindStart[Kind.Crow]; s < store.kindEnd[Kind.Crow]; s++) {
        if (!store.alive[s] || store.flags[s] & GameFlag.Scared) continue;
        if (shooed(ctx, s)) {
          store.flags[s] = (store.flags[s] & ~GameFlag.Lured) | GameFlag.Scared;
          scared = true;
          continue;
        }
        if (cup >= 0) {
          const a = ctx.abilities.hands[cup];
          const dx = a.cx - store.x[s],
            dy = a.cy - store.y[s];
          if (lured || store.flags[s] & GameFlag.Lured || dx * dx + dy * dy <= LURE_REACH * LURE_REACH) {
            store.flags[s] |= GameFlag.Lured;
            lured = true;
          }
        } else {
          store.flags[s] &= ~GameFlag.Lured;
        }
      }
      if (cup >= 0) {
        ctx.creatures.lureX = ctx.abilities.hands[cup].cx;
        ctx.creatures.lureY = ctx.abilities.hands[cup].cy;
      }
      if (scared) {
        ctx.events.push('puzzle-event', 'crows-flee', ctx.time);
        ctx.credit('shoo', 1);
      }
      if (lured) ctx.credit('fireflies', ctx.dt);

      // The traveller waits while a crow is on the path just ahead.
      const t = ctx.traveller;
      const ts = t.slot(ctx);
      if (ts < 0) return;
      for (let s = store.kindStart[Kind.Crow]; s < store.kindEnd[Kind.Crow]; s++) {
        if (!store.alive[s] || store.flags[s] & GameFlag.Scared) continue;
        const ahead = (store.x[s] - store.x[ts]) * t.dir;
        if (ahead > -0.02 && ahead < WARY && store.y[s] - ctx.groundY < ON_PATH) {
          t.hold('crows');
          return;
        }
      }
    },
  };
}
