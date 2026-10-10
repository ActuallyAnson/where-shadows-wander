// Puzzle 2, rain: a cloud rains on the path, and rain would put out the traveller's lantern, so it
// will not walk into it. Intended: a cup catches the rain over the traveller as it walks under.
// Also works: a flat hand held high as a roof.
//
// The traveller waits while drops are landing just ahead of it (or hitting it), and walks on as
// soon as its path is dry. Drops are seeded, so a restart rains the same.
import { Kind } from '../../engine/sim/entity-kinds';
import { HAND_COUNT, Touch } from '../../engine/sim/solver';
import { Role } from '../abilities';
import type { GameContext } from '../context';
import type { PuzzleDef } from '../puzzle';

/** The cloud's span on the stage, and where drops start. */
export const CLOUD_LEFT = -0.1;
export const CLOUD_RIGHT = 0.2;
const CLOUD_Y = 0.42;
/** Drops a second, their size and starting speed. */
const RAIN_RATE = 14;
const DROP_R = 0.01;
const DROP_VY = -0.9;
/** The traveller waits if a drop landed in this window around it within the last RECENT_S. */
const AHEAD = 0.12;
const BEHIND = 0.03;
const RECENT_S = 0.5;
/** Landings remembered (a ring of positions and times). */
const RING = 32;

/** One game's rain: drops owed, recent landings, and when the traveller was last hit. */
class RainState {
  acc = 0;
  readonly landX = new Float64Array(RING);
  readonly landT = new Float64Array(RING).fill(-Infinity);
  head = 0;
  readonly lastHitT = new Float64Array(1);

  reset(): void {
    this.acc = 0;
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

/** Credits the cover (cup or roof) over the traveller while it is under the cloud. */
function creditCover(ctx: GameContext, s: number): void {
  const x = ctx.store.x[s];
  if (x < CLOUD_LEFT - 0.05 || x > CLOUD_RIGHT + 0.05) return;
  for (let h = 0; h < HAND_COUNT; h++) {
    const cup = ctx.abilities.has(h, Role.Catcher);
    if (!cup && !ctx.abilities.has(h, Role.Bridge)) continue;
    const b = ctx.solver.hands[h].bounds;
    if (b[0] <= x + 0.05 && b[2] >= x - 0.05 && b[1] > ctx.store.y[s]) ctx.credit(cup ? 'cup' : 'roof', ctx.dt);
  }
}

/** A fresh puzzle with its own state: one per Game, so two games never share it. */
export function createRainPuzzle(): PuzzleDef {
  const rain = new RainState();
  return {
    id: 'p2-rain',
    layoutId: 'puzzle-2',
    title: 'Rain',
    solutions: ['cup', 'roof'],
    hintShape: 'cup',

    setup(ctx) {
      rain.reset();
      ctx.fixtures.add('cloud', (CLOUD_LEFT + CLOUD_RIGHT) / 2, CLOUD_Y + 0.04, CLOUD_RIGHT - CLOUD_LEFT + 0.06, 0.1);
    },

    step(ctx) {
      rain.acc += RAIN_RATE * ctx.dt;
      while (rain.acc >= 1) {
        rain.acc -= 1;
        const x = ctx.rng.range(CLOUD_LEFT + DROP_R, CLOUD_RIGHT - DROP_R);
        ctx.store.create(Kind.Raindrop, x, CLOUD_Y, DROP_R, 0, DROP_VY);
      }
      const t = ctx.traveller;
      const s = t.slot(ctx);
      if (s < 0) return;
      if (ctx.time - rain.lastHitT[0] <= RECENT_S || rain.wetNear(ctx.time, ctx.store.x[s], t.dir)) t.hold('rain');
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
          rain.land(store.x[s], ctx.time);
          ctx.events.push('splash', 'ground', ctx.time, 0, store.x[s], store.y[s]);
          store.destroy(store.handleAt(s));
        } else if (type === Touch.Entity && s === trav && store.alive[other] && store.kind[other] === Kind.Raindrop) {
          rain.lastHitT[0] = ctx.time;
          ctx.events.push('splash', 'traveller', ctx.time, 0, store.x[other], store.y[other]);
          store.destroy(store.handleAt(other));
        }
      }
      // Drops that missed everything (through a gap, off the stage).
      for (let s = store.kindStart[Kind.Raindrop]; s < store.kindEnd[Kind.Raindrop]; s++) {
        if (store.alive[s] && store.y[s] < ctx.groundY - 0.3) store.destroy(store.handleAt(s));
      }
    },

    hintAt(ctx, out) {
      out[0] = CLOUD_LEFT - 0.05;
      out[1] = ctx.groundY + 0.2;
    },
  };
}
