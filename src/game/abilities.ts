// Shape abilities (GDD "Shape vocabulary" and "How a shape is used"): a committed shape gives its
// hand's shadow a role in the world until the shape is released. Plain TypeScript; no allocation
// per step.
//
//   flat    → bridge   a plank the traveller, rocks and companions stand on; a roof that stops rain
//   fist    → rock     a heavy solid: pushes, blocks, presses weight plates, anchors the traveller
//   cup     → catcher  catches raindrops (absorbed, counted) and fireflies (carried until released)
//   spread  → wall     blocks wind (puzzles test `wallShelters`), rain, crows and walkers
//   rabbit, fox → companion: the creature breaks free (Companions); the shadow itself does nothing
//
// The shadow always mirrors the live hand; bridge and rock collide with its actual capsules, so a
// slightly imperfect shape still works (GDD). A hand with no role passes through everything, so a
// hand moving into place doesn't knock things about. Roles follow the classifier's events: a role
// starts on `commit` and ends on that shape's `release`; when one shape replaces another the new
// role starts on its own commit, so there is no gap.

import type { Handedness } from '../engine/hands/hand';
import type { HandShadow } from '../engine/hands/hand-shadow';
import type { ShapeEvent } from '../engine/hands/shape-events';
import type { Shape } from '../engine/hands/shapes';
import { Kind } from '../engine/sim/entity-kinds';
import { HAND_COUNT, LEFT, RIGHT, Touch, type HandCollider } from '../engine/sim/solver';
import type { GameContext } from './context';
import { GameFlag } from './flags';

export const Role = {
  None: 0,
  Bridge: 1,
  Rock: 2,
  Catcher: 3,
  Wall: 4,
  Companion: 5,
} as const;
export type RoleId = (typeof Role)[keyof typeof Role];

/** Role names, indexed by Role: the ids used in events and solution credit. */
export const ROLE_NAMES = ['none', 'bridge', 'rock', 'catcher', 'wall', 'companion'] as const;

export function roleOfShape(shape: Shape): RoleId {
  switch (shape) {
    case 'flat':
      return Role.Bridge;
    case 'fist':
      return Role.Rock;
    case 'cup':
      return Role.Catcher;
    case 'spread':
      return Role.Wall;
    default:
      return Role.Companion;
  }
}

const bit = (k: number) => 1 << k;
const WALKERS = bit(Kind.Traveller) | bit(Kind.Rock) | bit(Kind.Rabbit) | bit(Kind.Fox);
/** Per role: the kinds the hand's shadow is solid to (HandCollider.mask). */
export const ROLE_MASK: readonly number[] = [
  0,
  WALKERS | bit(Kind.Raindrop),
  WALKERS | bit(Kind.Raindrop) | bit(Kind.Crow),
  WALKERS | bit(Kind.Raindrop) | bit(Kind.Firefly),
  WALKERS | bit(Kind.Raindrop) | bit(Kind.Crow),
  0,
];

/** Raindrops a cup holds before it overflows (spilling them all). */
export const CUP_CAPACITY = 60;
/** Fastest a hand's shadow is taken to move, m/s (tracking glitches can jump further). */
const MAX_HAND_SPEED = 3;

export class HandAbility {
  role: RoleId = Role.None;
  /** The committed shape behind the role. */
  shape: Shape | null = null;
  /** Sim time the role started. */
  since = 0;
  /** Raindrops in the cup. */
  water = 0;
  /** Fireflies carried in the cup. */
  carried = 0;
  /** The shadow is present this frame. */
  active = false;
  /** Shadow centre on the stage and its velocity, m/s. */
  cx = 0;
  cy = 0;
  vx = 0;
  vy = 0;

  constructor(
    readonly hand: Handedness,
    readonly index: number,
  ) {}
}

export class Abilities {
  readonly hands: readonly [HandAbility, HandAbility] = [
    new HandAbility('left', LEFT),
    new HandAbility('right', RIGHT),
  ];

  /** The ability for a hand. */
  of(hand: Handedness): HandAbility {
    return this.hands[hand === 'left' ? LEFT : RIGHT];
  }

  /**
   * Once per display frame: copies both shadows into the solver's colliders and estimates each
   * hand's velocity from how far its shadow moved since the last frame.
   */
  setShadows(
    left: HandShadow | null,
    right: HandShadow | null,
    frameDt: number,
    colliders: readonly HandCollider[],
  ): void {
    for (let h = 0; h < HAND_COUNT; h++) {
      const sh = h === LEFT ? left : right;
      const a = this.hands[h];
      const c = colliders[h];
      if (sh !== null && sh.active) c.copyFrom(true, sh.capsules, sh.bounds);
      else c.active = false;
      if (!c.active || sh === null) {
        a.active = false;
        a.vx = 0;
        a.vy = 0;
        continue;
      }
      const cx = (sh.bounds[0] + sh.bounds[2]) / 2,
        cy = (sh.bounds[1] + sh.bounds[3]) / 2;
      if (a.active && frameDt > 0) {
        // Smoothed over about two frames: the capsules jitter a little even on a still hand.
        a.vx = 0.5 * a.vx + 0.5 * clampSpeed((cx - a.cx) / frameDt);
        a.vy = 0.5 * a.vy + 0.5 * clampSpeed((cy - a.cy) / frameDt);
      } else {
        a.vx = 0;
        a.vy = 0;
      }
      a.active = true;
      a.cx = cx;
      a.cy = cy;
    }
  }

  /** A classifier event (from the input latch), in order. */
  onShapeEvent(e: Readonly<ShapeEvent>, ctx: GameContext): void {
    const a = this.of(e.hand);
    if (e.type === 'commit') {
      if (a.role !== Role.None) this.end(a, ctx);
      a.role = roleOfShape(e.shape);
      a.shape = e.shape;
      a.since = ctx.time;
      ctx.events.push('ability-start', ROLE_NAMES[a.role], ctx.time, 0, a.cx, a.cy, a.hand);
      if (a.role === Role.Companion) ctx.companions.release(e.shape, a.cx, a.cy, ctx);
    } else if (e.type === 'release' && a.shape === e.shape && a.role !== Role.None) {
      this.end(a, ctx);
    }
  }

  /** Ends a hand's role: a cup spills its water and lets its fireflies go. */
  private end(a: HandAbility, ctx: GameContext): void {
    if (a.role === Role.Catcher) {
      const store = ctx.store;
      for (let s = store.kindStart[Kind.Firefly]; s < store.kindEnd[Kind.Firefly]; s++) {
        if (
          store.alive[s] &&
          store.flags[s] & GameFlag.Carried &&
          (store.flags[s] & HAND_BIT) >>> HAND_SHIFT === a.index
        )
          store.flags[s] &= ~(GameFlag.Carried | HAND_BIT);
      }
      a.water = 0;
      a.carried = 0;
    }
    ctx.events.push('ability-end', ROLE_NAMES[a.role], ctx.time, 0, a.cx, a.cy, a.hand);
    a.role = Role.None;
    a.shape = null;
  }

  /** Before the solver: each hand is solid to what its role says (nothing while the hand is away). */
  beforeSolve(ctx: GameContext): void {
    for (let h = 0; h < HAND_COUNT; h++) {
      const a = this.hands[h];
      const c = ctx.solver.hands[h];
      c.mask = a.active ? ROLE_MASK[a.role] : 0;
      c.vx = a.vx;
      c.vy = a.vy;
    }
  }

  /**
   * After the solver: raindrops that hit a hand burst (or are caught by a cup); fireflies that touch
   * a cup are carried; carried fireflies ride along in the cup.
   */
  afterSolve(ctx: GameContext): void {
    const { store, solver } = ctx;
    for (let i = 0; i < solver.contactCount; i++) {
      if (solver.contactType[i] !== Touch.Hand) continue;
      const s = solver.contactSlot[i];
      if (!store.alive[s]) continue;
      const a = this.hands[solver.contactId[i]];
      const kind = store.kind[s];
      if (kind === Kind.Raindrop) {
        if (a.role === Role.Catcher) {
          a.water++;
          ctx.events.push('caught', 'raindrop', ctx.time, a.water, store.x[s], store.y[s], a.hand);
          if (a.water > CUP_CAPACITY) {
            a.water = 0;
            ctx.events.push('puzzle-event', 'cup-overflow', ctx.time, 0, a.cx, a.cy, a.hand);
          }
        } else {
          ctx.events.push('splash', 'hand', ctx.time, a.role, store.x[s], store.y[s], a.hand);
        }
        store.destroy(store.handleAt(s));
      } else if (kind === Kind.Firefly && a.role === Role.Catcher && !(store.flags[s] & GameFlag.Carried)) {
        store.flags[s] = (store.flags[s] & ~HAND_BIT) | GameFlag.Carried | (a.index << HAND_SHIFT);
        a.carried++;
        ctx.events.push('caught', 'firefly', ctx.time, a.carried, store.x[s], store.y[s], a.hand);
      }
    }
    // A cup also scoops up fireflies inside its bowl, not just those touching its sides.
    for (let h = 0; h < HAND_COUNT; h++) {
      const a = this.hands[h];
      if (!a.active || a.role !== Role.Catcher) continue;
      const b = solver.hands[h].bounds;
      for (let s = store.kindStart[Kind.Firefly]; s < store.kindEnd[Kind.Firefly]; s++) {
        if (!store.alive[s] || store.flags[s] & GameFlag.Carried) continue;
        if (store.x[s] < b[0] || store.x[s] > b[2] || store.y[s] < b[1] || store.y[s] > b[3]) continue;
        store.flags[s] = (store.flags[s] & ~HAND_BIT) | GameFlag.Carried | (a.index << HAND_SHIFT);
        a.carried++;
        ctx.events.push('caught', 'firefly', ctx.time, a.carried, store.x[s], store.y[s], a.hand);
      }
    }
    // Carried fireflies hover in the cup's bowl, each at its own spot, and keep no speed of their own.
    for (let s = store.kindStart[Kind.Firefly]; s < store.kindEnd[Kind.Firefly]; s++) {
      if (!store.alive[s] || !(store.flags[s] & GameFlag.Carried)) continue;
      const a = this.hands[(store.flags[s] & HAND_BIT) >>> HAND_SHIFT];
      if (!a.active) continue;
      const k = s - store.kindStart[Kind.Firefly];
      const ang = k * 2.4 + ctx.time * 1.5;
      store.x[s] = a.cx + Math.cos(ang) * 0.04;
      store.y[s] = a.cy + 0.02 + Math.sin(ang) * 0.02;
      store.vx[s] = 0;
      store.vy[s] = 0;
    }
  }

  /** Whether hand `h` has role `role` and its shadow is present. */
  has(h: number, role: RoleId): boolean {
    const a = this.hands[h];
    return a.active && a.role === role;
  }

  /** The bounds of hand `h`'s shadow (minX, minY, maxX, maxY), from the solver's copy. */
  bounds(ctx: GameContext, h: number): Float32Array {
    return ctx.solver.hands[h].bounds;
  }

  /**
   * Whether a spread-hand wall stands between (x, y) and wind blowing from the side `fromSign`
   * (+1: wind from the right): the wall is on that side, close enough, and covers that height.
   */
  wallShelters(ctx: GameContext, x: number, y: number, r: number, fromSign: number, reach = 0.35): boolean {
    for (let h = 0; h < HAND_COUNT; h++) {
      if (!this.has(h, Role.Wall)) continue;
      const b = ctx.solver.hands[h].bounds;
      const near = fromSign > 0 ? b[2] > x && b[0] - x < reach : b[0] < x && x - b[2] < reach;
      // It must cover the body: reach down into its lower half and up past its head.
      if (near && b[1] <= y + r * 0.5 && b[3] >= y + r) return true;
    }
    return false;
  }

  /**
   * On a puzzle load: cups are emptied (the drops and fireflies are gone with the old puzzle), but
   * roles stay, because the classifier keeps its commits across a load and releases them later.
   */
  resetForPuzzle(): void {
    for (const a of this.hands) {
      a.water = 0;
      a.carried = 0;
    }
  }

  /** Forgets roles and cups entirely (a new game). */
  reset(): void {
    for (const a of this.hands) {
      a.role = Role.None;
      a.shape = null;
      a.water = 0;
      a.carried = 0;
    }
  }
}

// A carried firefly remembers which hand holds it in flag bit 11.
const HAND_SHIFT = 11;
const HAND_BIT = 1 << HAND_SHIFT;

function clampSpeed(v: number): number {
  return v > MAX_HAND_SPEED ? MAX_HAND_SPEED : v < -MAX_HAND_SPEED ? -MAX_HAND_SPEED : v;
}
