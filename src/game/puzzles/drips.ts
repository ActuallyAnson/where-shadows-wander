// Drips from a plant on the shelf above (the dripping plant's hazard, shared by every puzzle with
// drips in it): drops fall from a strip, the traveller waits while drops land just ahead of it (or
// hit it) and walks on once its path is dry, and a cup or a flat hand over it is credited as the
// cover ('cup' or 'roof'). A strip may sway from side to side (a hanging plant), so the dry spots
// move. Drops are seeded, so a restart drips the same. Plain TypeScript; no allocation per step.
import { Kind } from '../../engine/sim/entity-kinds';
import { HAND_COUNT, Touch } from '../../engine/sim/solver';
import { Role } from '../abilities';
import type { GameContext } from '../context';
import type { Fixture } from '../fixtures';

/** Where drops fall from: a strip from `left` to `right` at height `y`, `rate` drops a second. */
export interface DripStrip {
  readonly left: number;
  readonly right: number;
  readonly y: number;
  readonly rate: number;
  /** How far the strip swings to each side, metres (0: it hangs still). */
  readonly sway?: number;
  /** Seconds for one swing there and back. */
  readonly swayS?: number;
}

/** The share of the drops still falling once the hint ladder eases the puzzle. */
export const EASED_DRIP_SHARE = 1 / 3;
const DROP_R = 0.01;
const DROP_VY = -0.9;
/** The traveller waits if a drop landed in this window around it within the last RECENT_S. */
const AHEAD = 0.12;
const BEHIND = 0.03;
const RECENT_S = 0.5;
/** A cover counts this far past its edge (a hand is never placed to the centimetre). */
const COVER_SLACK = 0.03;
/** Landings remembered (a ring of positions and times). */
const RING = 32;

export class Drips {
  /** 1, or EASED_DRIP_SHARE once eased. */
  share = 1;
  /** Where the strip hangs now (it moves when it sways). */
  left: number;
  right: number;
  private acc = 0;
  private readonly landX = new Float64Array(RING);
  private readonly landT = new Float64Array(RING).fill(-Infinity);
  private head = 0;
  private lastHitT = -Infinity;
  private fixture: Fixture | null = null;

  constructor(readonly strip: DripStrip) {
    this.left = strip.left;
    this.right = strip.right;
  }

  /** On puzzle load: starts dry and adds the drip fixture the renderer draws. */
  setup(ctx: GameContext): void {
    this.acc = 0;
    this.share = 1;
    this.left = this.strip.left;
    this.right = this.strip.right;
    this.landT.fill(-Infinity);
    this.head = 0;
    this.lastHitT = -Infinity;
    const s = this.strip;
    this.fixture = ctx.fixtures.add('drip', (s.left + s.right) / 2, s.y + 0.02, s.right - s.left, 0.04);
  }

  /** Before the solver: sways, drips, holds the traveller out of the wet and credits its cover. */
  step(ctx: GameContext): void {
    const st = this.strip;
    if (st.sway) {
      const off = st.sway * Math.sin((2 * Math.PI * ctx.puzzleTime) / (st.swayS ?? 6));
      this.left = st.left + off;
      this.right = st.right + off;
      if (this.fixture) this.fixture.x = (this.left + this.right) / 2;
    }
    this.acc += st.rate * this.share * ctx.dt;
    while (this.acc >= 1) {
      this.acc -= 1;
      const x = ctx.rng.range(this.left + DROP_R, this.right - DROP_R);
      ctx.store.create(Kind.Raindrop, x, st.y, DROP_R, 0, DROP_VY);
    }
    const t = ctx.traveller;
    const s = t.slot(ctx);
    if (s < 0) return;
    const x = ctx.store.x[s];
    // It will not step under the leaves unless the spot just ahead is covered (so where it stops
    // does not depend on where the last drops happened to land). Once eased, the drops are sparse
    // enough to walk between, so only the landings stop it.
    const ahead = x + t.dir * AHEAD;
    const exposed = this.share === 1 && this.over(ahead) && !this.covered(ctx, ahead, ctx.store.y[s]);
    if (exposed || ctx.time - this.lastHitT <= RECENT_S || this.wetNear(ctx.time, x, t.dir)) t.hold('drips');
    this.creditCover(ctx, s);
  }

  /** Whether a cup or a flat hand is over stage x, above height y. */
  private covered(ctx: GameContext, x: number, y: number): boolean {
    for (let h = 0; h < HAND_COUNT; h++) {
      if (!ctx.abilities.has(h, Role.Catcher) && !ctx.abilities.has(h, Role.Bridge)) continue;
      const b = ctx.solver.hands[h].bounds;
      if (b[0] - COVER_SLACK <= x && b[2] + COVER_SLACK >= x && b[1] > y) return true;
    }
    return false;
  }

  /** After the solver: drops that landed splash (and are remembered), drops that hit the traveller wet it. */
  afterStep(ctx: GameContext): void {
    const { store, solver } = ctx;
    const trav = ctx.traveller.slot(ctx);
    for (let i = 0; i < solver.contactCount; i++) {
      const s = solver.contactSlot[i];
      const type = solver.contactType[i];
      const other = solver.contactId[i];
      if (type === Touch.Terrain && store.alive[s] && store.kind[s] === Kind.Raindrop) {
        this.land(store.x[s], ctx.time);
        ctx.events.push('splash', 'ground', ctx.time, 0, store.x[s], store.y[s]);
        store.destroy(store.handleAt(s));
      } else if (type === Touch.Entity && s === trav && store.alive[other] && store.kind[other] === Kind.Raindrop) {
        this.lastHitT = ctx.time;
        ctx.events.push('splash', 'traveller', ctx.time, 0, store.x[other], store.y[other]);
        store.destroy(store.handleAt(other));
      }
    }
    // Drops that missed everything (off the shelf, down a gap, off the stage).
    for (let s = store.kindStart[Kind.Raindrop]; s < store.kindEnd[Kind.Raindrop]; s++) {
      if (store.alive[s] && store.y[s] < ctx.groundY - 0.3) store.destroy(store.handleAt(s));
    }
  }

  /** The ladder's last rung: the dripping slows, so a cover held still is enough. */
  ease(): void {
    this.share = EASED_DRIP_SHARE;
  }

  /** Whether stage x is under the strip, or within `margin` of it. */
  over(x: number, margin = 0): boolean {
    return x >= this.left - margin && x <= this.right + margin;
  }

  private land(x: number, t: number): void {
    this.landX[this.head] = x;
    this.landT[this.head] = t;
    this.head = (this.head + 1) % RING;
  }

  private wetNear(now: number, x: number, dir: number): boolean {
    const lo = dir > 0 ? x - BEHIND : x - AHEAD,
      hi = dir > 0 ? x + AHEAD : x + BEHIND;
    for (let i = 0; i < RING; i++) {
      if (now - this.landT[i] <= RECENT_S && this.landX[i] >= lo && this.landX[i] <= hi) return true;
    }
    return false;
  }

  /** Credits the cover (cup or roof) over the traveller while it is under the drips. */
  private creditCover(ctx: GameContext, s: number): void {
    const x = ctx.store.x[s];
    if (!this.over(x, 0.05)) return;
    for (let h = 0; h < HAND_COUNT; h++) {
      const cup = ctx.abilities.has(h, Role.Catcher);
      if (!cup && !ctx.abilities.has(h, Role.Bridge)) continue;
      const b = ctx.solver.hands[h].bounds;
      if (b[0] <= x + 0.05 && b[2] >= x - 0.05 && b[1] > ctx.store.y[s]) ctx.credit(cup ? 'cup' : 'roof', ctx.dt);
    }
  }
}
