// The 2D collision solver for the stage (ADR 0007: a small custom solver, not a library).
// Plain TypeScript: no IWSDK, no three.js. Everything is allocated in the constructor; step() and
// the queries build no objects or arrays.
//
// What collides, all in stage space (metres, +y up the wall):
//   entities  circles in the EntityStore. `Static` ones never move; `Sensor` ones are never pushed
//             and push nothing, but their overlaps are reported as contacts.
//   terrain   fixed capsules (ground, gates, ropes), each with a tag for gameplay and an on/off switch.
//   hands     the hand shadows' capsules (HandShadow.capsules), copied in by gameplay each frame into
//             a HandCollider with a mask of the entity kinds that hand is solid to. A hand with no
//             role has mask 0 and passes through everything.
//
// One step: gravity → integrate → `iterations` passes of push-out (terrain, hands, entity pairs),
// removing the velocity into each surface (inelastic, with friction along a surface the entity
// stands on). `Grounded` is set for an entity resting on something whose normal points up enough,
// and what it stands on is kept in groundType/groundId. Contacts from the first pass are listed in
// fixed arrays for gameplay (a raindrop hit the ground, the cup, the traveller...).
//
// Entity pairs go through a uniform grid (rebuilt each pass by counting sort), so a step costs
// about the number of entities, not its square.
//
// Performance note: the hot paths pass circles, normals and depths through small typed arrays
// (`circ`, `hit`) instead of number arguments and return values. V8 boxes a double into a fresh heap
// number whenever it crosses a call it didn't inline, and the solver makes thousands of such calls
// a step; this keeps it near zero garbage.
//
// Iteration is in ascending slot order and the maths is plain double precision, so a step is
// deterministic for the same inputs.

import { CAPSULE_STRIDE, CAPSULES_PER_HAND } from '../hands/hand-shadow';
import { Flag, KIND_COUNT } from './entity-kinds';
import type { EntityStore } from './entity-store';

/** What an entity touched or stands on. */
export const Touch = {
  None: -1,
  Terrain: 0,
  Hand: 1,
  Entity: 2,
} as const;
export type TouchType = (typeof Touch)[keyof typeof Touch];

/** Two hands: index 0 is the left, 1 the right. */
export const HAND_COUNT = 2;
export const LEFT = 0;
export const RIGHT = 1;

/** A contact normal with y above this counts as standing on the surface. */
const GROUND_NORMAL_Y = 0.6;
/** Samples along each capsule when `supportBelow` looks for its top surface. */
const SUPPORT_SAMPLES = 6;
/** Broad-phase grid: cells across and down, and the smallest cell, metres. */
const GRID_COLS = 64;
const GRID_ROWS = 48;
const MIN_CELL = 0.05;
const EPS = 1e-9;

/** One hand shadow as a collider. Gameplay fills it each frame from the HandShadow. */
export class HandCollider {
  active = false;
  /** CAPSULES_PER_HAND capsules: ax, ay, bx, by, radius (the HandShadow layout). */
  readonly capsules = new Float32Array(CAPSULES_PER_HAND * CAPSULE_STRIDE);
  /** minX, minY, maxX, maxY, radii included. */
  readonly bounds = new Float32Array(4);
  /** The hand's velocity on the stage, m/s, so a moving hand carries and shoves what it touches. */
  vx = 0;
  vy = 0;
  /** Bit `1 << kind` set for each kind this hand is solid to. 0: passes through everything. */
  mask = 0;

  /** Copies a HandShadow-shaped source in (capsules and bounds); leaves velocity and mask alone. */
  copyFrom(active: boolean, capsules: ArrayLike<number>, bounds: ArrayLike<number>): void {
    this.active = active;
    if (!active) return;
    for (let i = 0; i < this.capsules.length; i++) this.capsules[i] = capsules[i];
    for (let i = 0; i < 4; i++) this.bounds[i] = bounds[i];
  }
}

/** Fixed capsules: the ground, walls, gates and ropes of a puzzle. */
export class Terrain {
  readonly data: Float32Array;
  /** Gameplay's label per capsule (e.g. ground, gate, rope, soft ground). */
  readonly tag: Uint8Array;
  /** 0 switches a capsule off (an open gate, a rope not yet lowered) without removing it. */
  readonly enabled: Uint8Array;
  count = 0;

  constructor(readonly capacity = 64) {
    this.data = new Float32Array(capacity * CAPSULE_STRIDE);
    this.tag = new Uint8Array(capacity);
    this.enabled = new Uint8Array(capacity);
  }

  /** @returns the capsule's index, or -1 if full. */
  add(ax: number, ay: number, bx: number, by: number, radius: number, tag = 0, enabled = true): number {
    if (this.count === this.capacity) return -1;
    const i = this.count++;
    const o = i * CAPSULE_STRIDE;
    this.data[o] = ax;
    this.data[o + 1] = ay;
    this.data[o + 2] = bx;
    this.data[o + 3] = by;
    this.data[o + 4] = radius;
    this.tag[i] = tag;
    this.enabled[i] = enabled ? 1 : 0;
    return i;
  }

  clear(): void {
    this.count = 0;
  }
}

export interface SolverConfig {
  /** Downward acceleration on the stage, m/s². */
  gravity: number;
  /** Per kind: multiplies gravity (0 for things that fly). */
  kindGravity: Float32Array;
  /** Per kind: bitmask of kinds it collides with (keep it symmetric). */
  kindCollides: Uint32Array;
  /** Bitmask of kinds that collide with terrain. */
  terrainMask: number;
  /** Fraction of sliding speed kept per step on a surface an entity stands on (0..1). */
  groundFriction: number;
  /** Push-out passes per step. */
  iterations: number;
  /** Contacts kept per step. */
  contactCapacity: number;
}

/** Usable defaults: every kind collides with every kind and the terrain, normal gravity. */
export function defaultSolverConfig(): SolverConfig {
  return {
    gravity: 2.5,
    kindGravity: new Float32Array(KIND_COUNT).fill(1),
    kindCollides: new Uint32Array(KIND_COUNT).fill((1 << KIND_COUNT) - 1),
    terrainMask: (1 << KIND_COUNT) - 1,
    groundFriction: 0.85,
    iterations: 2,
    contactCapacity: 512,
  };
}

/** Result of `supportBelow`: the highest surface found, and what it was. */
export interface Support {
  y: number;
  type: TouchType;
  id: number;
}

export class Solver {
  readonly terrain: Terrain;
  readonly hands: readonly [HandCollider, HandCollider] = [new HandCollider(), new HandCollider()];

  /** Per slot: what the entity stands on (Touch), and which terrain capsule / hand / slot. */
  readonly groundType: Int8Array;
  readonly groundId: Int32Array;

  /** This step's contacts (first pass only): entity slot, what it touched, which, and the push normal. */
  readonly contactSlot: Int32Array;
  readonly contactType: Int8Array;
  readonly contactId: Int32Array;
  readonly contactNx: Float32Array;
  readonly contactNy: Float32Array;
  contactCount = 0;
  /** Contacts not recorded because the list was full (a number for the profiler). */
  contactsDropped = 0;

  /** The circle being tested: x, y, radius. */
  private readonly circ = new Float64Array(3);
  /** The last overlap found: normal x, y (to push the circle out), depth, and the surface's velocity x, y. */
  private readonly hit = new Float64Array(5);
  private recording = false;

  // Broad phase: a uniform grid rebuilt each pass by counting sort. Cells are at least as wide as
  // the largest colliding pair, so a pair is always in the same or a neighbouring cell. Positions
  // are clamped into the grid, which keeps neighbours neighbours, so the grid never misses a pair.
  private readonly cellStart = new Int32Array(GRID_COLS * GRID_ROWS + 1);
  private readonly cellFill = new Int32Array(GRID_COLS * GRID_ROWS);
  private readonly cellItems: Int32Array;
  private readonly cellOf: Int32Array;
  private readonly cellSize = new Float64Array(1);

  constructor(
    capacity: number,
    readonly config: SolverConfig = defaultSolverConfig(),
    terrainCapacity = 64,
  ) {
    this.terrain = new Terrain(terrainCapacity);
    this.groundType = new Int8Array(capacity).fill(Touch.None);
    this.groundId = new Int32Array(capacity);
    const c = config.contactCapacity;
    this.contactSlot = new Int32Array(c);
    this.contactType = new Int8Array(c);
    this.contactId = new Int32Array(c);
    this.contactNx = new Float32Array(c);
    this.contactNy = new Float32Array(c);
    this.cellItems = new Int32Array(capacity);
    this.cellOf = new Int32Array(capacity);
  }

  /** One fixed step. Call after `store.beginStep()` and after gameplay has set velocities. */
  step(store: EntityStore, dt: number): void {
    const cfg = this.config;
    this.contactCount = 0;
    const cap = store.capacity;
    const g = cfg.gravity * dt;
    for (let s = 0; s < cap; s++) {
      this.groundType[s] = Touch.None;
      if (!store.alive[s]) continue;
      store.flags[s] &= ~Flag.Grounded;
      if (store.flags[s] & Flag.Static) continue;
      store.vy[s] -= g * cfg.kindGravity[store.kind[s]];
      store.x[s] += store.vx[s] * dt;
      store.y[s] += store.vy[s] * dt;
    }
    for (let it = 0; it < cfg.iterations; it++) {
      this.recording = it === 0;
      this.buildGrid(store);
      for (let s = 0; s < cap; s++) {
        if (!store.alive[s] || store.flags[s] & Flag.Static) continue;
        this.collideTerrain(store, s);
        this.collideHands(store, s);
        this.collideEntities(store, s);
      }
    }
    this.recording = false;
  }

  private loadCircle(store: EntityStore, s: number): void {
    this.circ[0] = store.x[s];
    this.circ[1] = store.y[s];
    this.circ[2] = store.radius[s];
  }

  private collideTerrain(store: EntityStore, s: number): void {
    if (!(this.config.terrainMask & (1 << store.kind[s]))) return;
    const t = this.terrain;
    for (let i = 0; i < t.count; i++) {
      if (!t.enabled[i]) continue;
      this.loadCircle(store, s);
      if (!circleCapsule(this.circ, t.data, i * CAPSULE_STRIDE, this.hit)) continue;
      this.hit[3] = 0;
      this.hit[4] = 0;
      this.resolve(store, s, Touch.Terrain, i);
    }
  }

  private collideHands(store: EntityStore, s: number): void {
    const bit = 1 << store.kind[s];
    for (let h = 0; h < HAND_COUNT; h++) {
      const hand = this.hands[h];
      if (!hand.active || !(hand.mask & bit)) continue;
      this.loadCircle(store, s);
      if (!overlapsBounds(this.circ, hand.bounds)) continue;
      // Push out of the deepest capsule only and let the next pass re-test: resolving every capsule
      // in turn would shove a circle wedged between fingers back and forth.
      if (!deepestCapsule(this.circ, hand.capsules, this.hit)) continue;
      this.hit[3] = hand.vx;
      this.hit[4] = hand.vy;
      this.resolve(store, s, Touch.Hand, h);
    }
  }

  /** Sorts every alive entity that can collide with another into the grid. */
  private buildGrid(store: EntityStore): void {
    const kc = this.config.kindCollides;
    let maxR = 0;
    for (let s = 0; s < store.capacity; s++) {
      if (store.alive[s] && kc[store.kind[s]] !== 0 && store.radius[s] > maxR) maxR = store.radius[s];
    }
    this.cellSize[0] = maxR * 2 > MIN_CELL ? maxR * 2 : MIN_CELL;
    const start = this.cellStart,
      fill = this.cellFill;
    start.fill(0);
    for (let s = 0; s < store.capacity; s++) {
      if (!store.alive[s] || kc[store.kind[s]] === 0) {
        this.cellOf[s] = -1;
        continue;
      }
      const c = this.cellIndex(store, s);
      this.cellOf[s] = c;
      start[c + 1]++;
    }
    for (let c = 0; c < GRID_COLS * GRID_ROWS; c++) {
      start[c + 1] += start[c];
      fill[c] = start[c];
    }
    for (let s = 0; s < store.capacity; s++) {
      const c = this.cellOf[s];
      if (c >= 0) this.cellItems[fill[c]++] = s;
    }
  }

  private cellIndex(store: EntityStore, s: number): number {
    let cx = Math.floor(store.x[s] / this.cellSize[0]) + (GRID_COLS >> 1);
    let cy = Math.floor(store.y[s] / this.cellSize[0]) + (GRID_ROWS >> 1);
    cx = cx < 0 ? 0 : cx >= GRID_COLS ? GRID_COLS - 1 : cx;
    cy = cy < 0 ? 0 : cy >= GRID_ROWS ? GRID_ROWS - 1 : cy;
    return cy * GRID_COLS + cx;
  }

  private collideEntities(store: EntityStore, s: number): void {
    const home = this.cellOf[s];
    if (home < 0) return;
    const hx = home % GRID_COLS,
      hy = (home - hx) / GRID_COLS;
    for (let cy = hy - 1; cy <= hy + 1; cy++) {
      if (cy < 0 || cy >= GRID_ROWS) continue;
      for (let cx = hx - 1; cx <= hx + 1; cx++) {
        if (cx < 0 || cx >= GRID_COLS) continue;
        const c = cy * GRID_COLS + cx;
        for (let i = this.cellStart[c]; i < this.cellStart[c + 1]; i++) this.collidePair(store, s, this.cellItems[i]);
      }
    }
  }

  private collidePair(store: EntityStore, s: number, j: number): void {
    if (j === s || !store.alive[j] || !(this.config.kindCollides[store.kind[s]] & (1 << store.kind[j]))) return;
    const staticJ = (store.flags[j] & Flag.Static) !== 0;
    // A dynamic pair is handled once, from its lower slot; a static partner from the dynamic side.
    if (!staticJ && j < s) return;
    const dx = store.x[s] - store.x[j],
      dy = store.y[s] - store.y[j];
    const rr = store.radius[s] + store.radius[j];
    const d2 = dx * dx + dy * dy;
    if (d2 >= rr * rr) return;
    const dist = Math.sqrt(d2);
    const hit = this.hit;
    if (dist > EPS) {
      hit[0] = dx / dist;
      hit[1] = dy / dist;
    } else {
      hit[0] = 0;
      hit[1] = 1;
    }
    hit[2] = rr - dist;
    if ((store.flags[s] | store.flags[j]) & Flag.Sensor) {
      // A sensor on either side reports the overlap; nothing is pushed.
      this.record(s, Touch.Entity, j);
      return;
    }
    if (staticJ) {
      hit[3] = 0;
      hit[4] = 0;
      this.resolve(store, s, Touch.Entity, j);
      return;
    }
    // Two dynamic bodies: each moves half, and they trade the closing speed.
    const nx = hit[0],
      ny = hit[1];
    const half = hit[2] / 2;
    store.x[s] += nx * half;
    store.y[s] += ny * half;
    store.x[j] -= nx * half;
    store.y[j] -= ny * half;
    const rvn = (store.vx[s] - store.vx[j]) * nx + (store.vy[s] - store.vy[j]) * ny;
    if (rvn < 0) {
      store.vx[s] -= (rvn / 2) * nx;
      store.vy[s] -= (rvn / 2) * ny;
      store.vx[j] += (rvn / 2) * nx;
      store.vy[j] += (rvn / 2) * ny;
    }
    if (ny > GROUND_NORMAL_Y) this.ground(store, s, Touch.Entity, j);
    else if (-ny > GROUND_NORMAL_Y) this.ground(store, j, Touch.Entity, s);
    this.record(s, Touch.Entity, j);
  }

  /**
   * Pushes slot `s` out along hit's normal by hit's depth, and removes its velocity into the surface
   * (which moves at hit[3], hit[4]).
   */
  private resolve(store: EntityStore, s: number, type: TouchType, id: number): void {
    this.record(s, type, id);
    if (store.flags[s] & Flag.Sensor) return;
    const hit = this.hit;
    const nx = hit[0],
      ny = hit[1],
      sx = hit[3],
      sy = hit[4];
    store.x[s] += nx * hit[2];
    store.y[s] += ny * hit[2];
    const rvn = (store.vx[s] - sx) * nx + (store.vy[s] - sy) * ny;
    if (rvn < 0) {
      store.vx[s] -= rvn * nx;
      store.vy[s] -= rvn * ny;
    }
    if (ny > GROUND_NORMAL_Y) {
      // Friction along the surface, relative to it: a hand moving sideways carries what stands on it.
      const tx = -ny,
        ty = nx;
      const rvt = (store.vx[s] - sx) * tx + (store.vy[s] - sy) * ty;
      const lose = 1 - this.config.groundFriction;
      store.vx[s] -= rvt * lose * tx;
      store.vy[s] -= rvt * lose * ty;
      this.ground(store, s, type, id);
    }
  }

  private ground(store: EntityStore, s: number, type: TouchType, id: number): void {
    store.flags[s] |= Flag.Grounded;
    this.groundType[s] = type;
    this.groundId[s] = id;
  }

  private record(s: number, type: TouchType, id: number): void {
    if (!this.recording) return;
    if (this.contactCount === this.contactSlot.length) {
      this.contactsDropped++;
      return;
    }
    const i = this.contactCount++;
    this.contactSlot[i] = s;
    this.contactType[i] = type;
    this.contactId[i] = id;
    this.contactNx[i] = this.hit[0];
    this.contactNy[i] = this.hit[1];
  }

  /**
   * The highest walkable surface under stage x, between `top` and `bottom` (top > bottom): terrain,
   * and hands solid to `kindBit`. Writes it into `out` and returns true, or returns false if none.
   * The traveller and companions use it to look for ground ahead before stepping.
   */
  supportBelow(x: number, top: number, bottom: number, kindBit: number, out: Support): boolean {
    out.y = -Infinity;
    out.type = Touch.None;
    out.id = -1;
    const q = this.circ;
    q[0] = x;
    const t = this.terrain;
    for (let i = 0; i < t.count; i++) {
      if (!t.enabled[i] || !capsuleTopAt(t.data, i * CAPSULE_STRIDE, q, this.hit)) continue;
      const sy = this.hit[2];
      if (sy <= top && sy >= bottom && sy > out.y) {
        out.y = sy;
        out.type = Touch.Terrain;
        out.id = i;
      }
    }
    for (let h = 0; h < HAND_COUNT; h++) {
      const hand = this.hands[h];
      if (!hand.active || !(hand.mask & kindBit)) continue;
      const b = hand.bounds;
      if (x < b[0] || x > b[2] || b[1] > top || b[3] < bottom) continue;
      for (let k = 0; k < CAPSULES_PER_HAND; k++) {
        if (!capsuleTopAt(hand.capsules, k * CAPSULE_STRIDE, q, this.hit)) continue;
        const sy = this.hit[2];
        if (sy <= top && sy >= bottom && sy > out.y) {
          out.y = sy;
          out.type = Touch.Hand;
          out.id = h;
        }
      }
    }
    return out.type !== Touch.None;
  }

  /**
   * Whether a circle overlaps solid terrain, a hand solid to `kindBit`, or a static non-sensor entity
   * (except slot `ignore`). The traveller uses it to look for a wall ahead.
   */
  blocked(store: EntityStore, x: number, y: number, r: number, kindBit: number, ignore = -1): boolean {
    const q = this.circ;
    q[0] = x;
    q[1] = y;
    q[2] = r;
    const t = this.terrain;
    for (let i = 0; i < t.count; i++) {
      if (t.enabled[i] && circleCapsule(q, t.data, i * CAPSULE_STRIDE, this.hit)) return true;
    }
    for (let h = 0; h < HAND_COUNT; h++) {
      const hand = this.hands[h];
      if (
        hand.active &&
        hand.mask & kindBit &&
        overlapsBounds(q, hand.bounds) &&
        deepestCapsule(q, hand.capsules, this.hit)
      )
        return true;
    }
    for (let j = 0; j < store.capacity; j++) {
      if (j === ignore || !store.alive[j]) continue;
      const f = store.flags[j];
      if (!(f & Flag.Static) || f & Flag.Sensor) continue;
      const dx = x - store.x[j],
        dy = y - store.y[j],
        rr = r + store.radius[j];
      if (dx * dx + dy * dy < rr * rr) return true;
    }
    return false;
  }

  /** Forgets terrain and hands, e.g. when a new puzzle loads. */
  reset(): void {
    this.terrain.clear();
    for (let h = 0; h < HAND_COUNT; h++) {
      const hand = this.hands[h];
      hand.active = false;
      hand.mask = 0;
      hand.vx = 0;
      hand.vy = 0;
    }
    this.groundType.fill(Touch.None);
    this.contactCount = 0;
  }
}

/** Whether circle `c` (x, y, r) overlaps the box `b` (minX, minY, maxX, maxY). */
function overlapsBounds(c: Float64Array, b: Float32Array): boolean {
  return !(c[0] + c[2] < b[0] || c[0] - c[2] > b[2] || c[1] + c[2] < b[1] || c[1] - c[2] > b[3]);
}

/**
 * Circle `c` (x, y, r) against capsule `o` in `d` (ax, ay, bx, by, radius). On overlap writes the
 * push-out normal and depth into hit[0..2] and returns true. The same rule as vec2.circleVsCapsule
 * (a centre exactly on the segment is pushed to its left-hand side), written for the solver's
 * scratch arrays.
 */
function circleCapsule(c: Float64Array, d: Float32Array, o: number, hit: Float64Array): boolean {
  const ax = d[o],
    ay = d[o + 1],
    abx = d[o + 2] - ax,
    aby = d[o + 3] - ay;
  const px = c[0],
    py = c[1];
  const len2 = abx * abx + aby * aby;
  let t = len2 < EPS ? 0 : ((px - ax) * abx + (py - ay) * aby) / len2;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const dx = px - (ax + abx * t),
    dy = py - (ay + aby * t);
  const rr = c[2] + d[o + 4];
  const d2 = dx * dx + dy * dy;
  if (d2 >= rr * rr) return false;
  const dist = Math.sqrt(d2);
  if (dist > 1e-6) {
    hit[0] = dx / dist;
    hit[1] = dy / dist;
  } else {
    const len = Math.sqrt(len2);
    if (len < 1e-6) {
      hit[0] = 0;
      hit[1] = 1;
    } else {
      hit[0] = 0 - aby / len;
      hit[1] = abx / len;
    }
  }
  hit[2] = rr - dist;
  return true;
}

/** The deepest overlap of circle `c` with any of a hand's capsules, into hit[0..2]. */
function deepestCapsule(c: Float64Array, caps: Float32Array, hit: Float64Array): boolean {
  let found = false;
  let bestNx = 0,
    bestNy = 0,
    best = 0;
  for (let k = 0; k < CAPSULES_PER_HAND; k++) {
    if (!circleCapsule(c, caps, k * CAPSULE_STRIDE, hit) || hit[2] <= best) continue;
    found = true;
    best = hit[2];
    bestNx = hit[0];
    bestNy = hit[1];
  }
  if (!found) return false;
  hit[0] = bestNx;
  hit[1] = bestNy;
  hit[2] = best;
  return true;
}

/**
 * The top surface of capsule `o` in `d` at stage x = q[0], into hit[2]; false if x is outside it.
 * Exact for the end caps and the straight sides; the sides are capped at the higher end cap.
 */
function capsuleTopAt(d: Float32Array, o: number, q: Float64Array, hit: Float64Array): boolean {
  const ax = d[o],
    ay = d[o + 1],
    bx = d[o + 2],
    by = d[o + 3],
    r = d[o + 4],
    x = q[0];
  let best = -Infinity;
  for (let i = 0; i <= SUPPORT_SAMPLES; i++) {
    const t = i / SUPPORT_SAMPLES;
    const dx = ax + (bx - ax) * t - x;
    if (dx > r || dx < -r) continue;
    const top = ay + (by - ay) * t + Math.sqrt(r * r - dx * dx);
    if (top > best) best = top;
  }
  // The straight side, at x itself: offset r perpendicular to it is r / cos(slope) vertically.
  const lo = ax < bx ? ax : bx,
    hi = ax < bx ? bx : ax;
  if (x >= lo && x <= hi && hi - lo > EPS) {
    const py = ay + ((by - ay) * (x - ax)) / (bx - ax);
    const len = Math.sqrt((bx - ax) * (bx - ax) + (by - ay) * (by - ay));
    const cap = (ay > by ? ay : by) + r;
    let top = py + (r * len) / (hi - lo);
    if (top > cap) top = cap;
    if (top > best) best = top;
  }
  if (best === -Infinity) return false;
  hit[2] = best;
  return true;
}
