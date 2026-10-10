// Puzzle 5, crows: crows sit on the path and the traveller won't walk past them. Intended: the fox
// (found from the hint in puzzle 4) trots up and scares them away. Also works: catch fireflies in a
// cup and use their light to lure the crows off the path, then lift them away.
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
/** The fox frightens crows within this distance. */
const FOX_SCARE = 0.3;
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
    solutions: ['fox', 'fireflies'],
    hintShape: 'fox',

    step(ctx) {
      const { store } = ctx;
      const fox = ctx.companions.slotOf(ctx.companions.fox, ctx);
      const cup = lantern(ctx);
      let scared = false;
      // Crows flock: once one follows the light, they all do.
      let lured = cup >= 0 && anyLured(ctx);
      for (let s = store.kindStart[Kind.Crow]; s < store.kindEnd[Kind.Crow]; s++) {
        if (!store.alive[s] || store.flags[s] & GameFlag.Scared) continue;
        if (fox >= 0) {
          const dx = store.x[fox] - store.x[s],
            dy = store.y[fox] - store.y[s];
          if (dx * dx + dy * dy <= FOX_SCARE * FOX_SCARE) {
            store.flags[s] = (store.flags[s] & ~GameFlag.Lured) | GameFlag.Scared;
            scared = true;
            continue;
          }
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
        ctx.credit('fox', 1);
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
