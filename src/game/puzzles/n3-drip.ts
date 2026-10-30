// Puzzle 3, the dripping plant: a freshly watered plant on the shelf above drips onto the path, and
// the drips would put out the traveller's lantern, so it will not walk into them. Intended: a cup
// catches the drips over the traveller as it walks under. Also works: a flat hand held high as a roof.
//
// The traveller waits while drops are landing just ahead of it (or hitting it), and walks on as
// soon as its path is dry. Drops are seeded, so a restart drips the same. Eased (the hint ladder's
// last rung), a third of the drops fall.
import { Kind } from '../../engine/sim/entity-kinds';
import { HAND_COUNT, Touch } from '../../engine/sim/solver';
import { Role } from '../abilities';
import type { GameContext } from '../context';
import type { PuzzleDef } from '../puzzle';
import { goalOn, LEDGE_TOP, ledge, PROP_DEPTH, startOn } from './bedroom';

/** Where the drips fall (the plant's leaves), and where drops start. */
export const DRIP_LEFT = -0.1;
export const DRIP_RIGHT = 0.2;
const DRIP_Y = 0.3;
/** Drops a second, their size and starting speed. */
const DRIP_RATE = 14;
/** The share of the drops still falling once the hint ladder eases the puzzle. */
export const EASED_DRIP_SHARE = 1 / 3;
const DROP_R = 0.01;
const DROP_VY = -0.9;
/** The traveller waits if a drop landed in this window around it within the last RECENT_S. */
const AHEAD = 0.12;
const BEHIND = 0.03;
const RECENT_S = 0.5;
/** Landings remembered (a ring of positions and times). */
const RING = 32;

/** One game's drips: drops owed, recent landings, and when the traveller was last hit. */
class DripState {
  acc = 0;
  /** 1, or EASED_DRIP_SHARE once eased. */
  rate = 1;
  readonly landX = new Float64Array(RING);
  readonly landT = new Float64Array(RING).fill(-Infinity);
  head = 0;
  readonly lastHitT = new Float64Array(1);

  reset(): void {
    this.acc = 0;
    this.rate = 1;
    this.landT.fill(-Infinity);
    this.head = 0;
    this.lastHitT[0] = -Infinity;
  }

  land(x: number, t: number): void {
    this.landX[this.head] = x;
    this.landT[this.head] = t;
    this.head = (this.head + 1) % RING;
  }

  wetNear(now: number, x: number, dir: number): boolean {
    const lo = dir > 0 ? x - BEHIND : x - AHEAD,
      hi = dir > 0 ? x + AHEAD : x + BEHIND;
    for (let i = 0; i < RING; i++) {
      if (now - this.landT[i] <= RECENT_S && this.landX[i] >= lo && this.landX[i] <= hi) return true;
    }
    return false;
  }
}

/** Credits the cover (cup or roof) over the traveller while it is under the drips. */
function creditCover(ctx: GameContext, s: number): void {
  const x = ctx.store.x[s];
  if (x < DRIP_LEFT - 0.05 || x > DRIP_RIGHT + 0.05) return;
  for (let h = 0; h < HAND_COUNT; h++) {
    const cup = ctx.abilities.has(h, Role.Catcher);
    if (!cup && !ctx.abilities.has(h, Role.Bridge)) continue;
    const b = ctx.solver.hands[h].bounds;
    if (b[0] <= x + 0.05 && b[2] >= x - 0.05 && b[1] > ctx.store.y[s]) ctx.credit(cup ? 'cup' : 'roof', ctx.dt);
  }
}

/** A fresh puzzle with its own state: one per Game, so two games never share it. */
export function createDripPuzzle(): PuzzleDef {
  const drip = new DripState();
  return {
    id: 'n3-drip',
    title: 'The dripping plant',
    layout: { traveller: startOn(-0.7), goal: goalOn(0.7) },
    props: [
      ledge('shelf', -0.81, 0.81),
      // The plant is scenery: its shadow is drawn, never walked on.
      { id: 'plant', shape: 'cylinder', x: 0.05, y: 0.38, size: [0.07, 0.12, PROP_DEPTH], solid: false },
    ],
    ground: false,
    groundY: LEDGE_TOP,
    solutions: ['cup', 'roof'],
    hintShape: 'cup',

    setup(ctx) {
      drip.reset();
      ctx.fixtures.add('drip', (DRIP_LEFT + DRIP_RIGHT) / 2, DRIP_Y + 0.02, DRIP_RIGHT - DRIP_LEFT, 0.04);
    },

    step(ctx) {
      drip.acc += DRIP_RATE * drip.rate * ctx.dt;
      while (drip.acc >= 1) {
        drip.acc -= 1;
        const x = ctx.rng.range(DRIP_LEFT + DROP_R, DRIP_RIGHT - DROP_R);
        ctx.store.create(Kind.Raindrop, x, DRIP_Y, DROP_R, 0, DROP_VY);
      }
      const t = ctx.traveller;
      const s = t.slot(ctx);
      if (s < 0) return;
      if (ctx.time - drip.lastHitT[0] <= RECENT_S || drip.wetNear(ctx.time, ctx.store.x[s], t.dir)) t.hold('drips');
      creditCover(ctx, s);
    },

    afterStep(ctx) {
      const { store, solver } = ctx;
      const trav = ctx.traveller.slot(ctx);
      for (let i = 0; i < solver.contactCount; i++) {
        const s = solver.contactSlot[i];
        const type = solver.contactType[i];
        const other = solver.contactId[i];
        if (type === Touch.Terrain && store.alive[s] && store.kind[s] === Kind.Raindrop) {
          drip.land(store.x[s], ctx.time);
          ctx.events.push('splash', 'ground', ctx.time, 0, store.x[s], store.y[s]);
          store.destroy(store.handleAt(s));
        } else if (type === Touch.Entity && s === trav && store.alive[other] && store.kind[other] === Kind.Raindrop) {
          drip.lastHitT[0] = ctx.time;
          ctx.events.push('splash', 'traveller', ctx.time, 0, store.x[other], store.y[other]);
          store.destroy(store.handleAt(other));
        }
      }
      // Drops that missed everything (off the shelf, off the stage).
      for (let s = store.kindStart[Kind.Raindrop]; s < store.kindEnd[Kind.Raindrop]; s++) {
        if (store.alive[s] && store.y[s] < ctx.groundY - 0.3) store.destroy(store.handleAt(s));
      }
    },

    // The ladder's last rung: the dripping slows, so a cup or a roof held still is enough.
    ease() {
      drip.rate = EASED_DRIP_SHARE;
    },

    hintAt(ctx, out) {
      out[0] = DRIP_LEFT - 0.05;
      out[1] = ctx.groundY + 0.2;
    },
  };
}
