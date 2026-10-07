// Fixed-capacity entity store: struct-of-arrays typed columns, a slot range reserved per kind,
// generational handles. Everything is allocated in the constructor; create, destroy and the
// per-step calls build no objects or arrays. Plain TypeScript: no IWSDK, no three.js.
//
// Stage space is metres. `x`/`y` is the current step's position and `px`/`py` the previous step's,
// so the renderer draws at `px + (x - px) * alpha` with the factor FixedStepLoop.advance() returns.
//
// Slots are reused (most recently freed first). Anything you keep per entity outside the store, such
// as animation state, must be tagged with `generation[slot]` when made and reset when it changes,
// or a new entity inherits its predecessor's state.
//
// Iteration is by ascending slot (kind order, then slot within the kind), skipping `alive[s] === 0`:
//   solver:   for (let s = 0; s < store.capacity; s++) if (store.alive[s]) ...
//   renderer: for (let s = store.kindStart[k]; s < store.kindEnd[k]; s++) if (store.alive[s]) ...

import { KIND_COUNT, type KindId } from './entity-kinds';

/** A handle names one life of one slot. Never store a slot index across frames; store the handle. */
export type Handle = number & { readonly __handle: unique symbol };

/** Never a live handle (generations start at 1). */
export const NULL_HANDLE = 0 as Handle;

const SLOT_BITS = 12;
const SLOT_MASK = (1 << SLOT_BITS) - 1;
/** At most 4096 slots in total. */
export const MAX_SLOTS = 1 << SLOT_BITS;
// Handles stay below 2^30 so they are small integers (no heap boxing) on every engine and
// bitwise operators never truncate them. The generation wraps back to 1 after 2^18 - 1 lives of
// one slot; a handle that old and still held would be mistaken for the slot's current life.
const GEN_MAX = (1 << 18) - 1;

export class EntityStore {
  /** Total slots: the sum of the per-kind capacities. */
  readonly capacity: number;
  /** First slot of each kind, indexed by `Kind`. */
  readonly kindStart: Int32Array;
  /** One past the last slot of each kind. */
  readonly kindEnd: Int32Array;

  readonly alive: Uint8Array;
  readonly kind: Uint8Array;
  readonly flags: Uint16Array;
  readonly x: Float64Array;
  readonly y: Float64Array;
  /** Position at the start of the current step (set by `beginStep`). */
  readonly px: Float64Array;
  readonly py: Float64Array;
  readonly vx: Float64Array;
  readonly vy: Float64Array;
  readonly radius: Float32Array;
  readonly generation: Uint32Array;

  /** Live entities, all kinds. */
  count = 0;
  /** Creates refused because the kind was full (a number for the profiler; callers must still check the handle). */
  overflowCount = 0;

  private readonly counts: Int32Array;
  /** Free slots, one stack per kind laid out in that kind's own range. */
  private readonly freeSlots: Int32Array;
  private readonly freeTop: Int32Array;

  constructor(capacities: readonly number[]) {
    if (capacities.length !== KIND_COUNT) {
      throw new RangeError(`expected ${KIND_COUNT} capacities, got ${capacities.length}`);
    }
    this.kindStart = new Int32Array(KIND_COUNT);
    this.kindEnd = new Int32Array(KIND_COUNT);
    let total = 0;
    for (let k = 0; k < KIND_COUNT; k++) {
      const c = capacities[k];
      if (!Number.isInteger(c) || c < 0) throw new RangeError(`capacity of kind ${k} must be a whole number, got ${c}`);
      this.kindStart[k] = total;
      total += c;
      this.kindEnd[k] = total;
    }
    if (total > MAX_SLOTS) throw new RangeError(`total capacity ${total} exceeds ${MAX_SLOTS}`);
    this.capacity = total;

    this.alive = new Uint8Array(total);
    this.kind = new Uint8Array(total);
    this.flags = new Uint16Array(total);
    this.x = new Float64Array(total);
    this.y = new Float64Array(total);
    this.px = new Float64Array(total);
    this.py = new Float64Array(total);
    this.vx = new Float64Array(total);
    this.vy = new Float64Array(total);
    this.radius = new Float32Array(total);
    this.generation = new Uint32Array(total).fill(1);
    this.counts = new Int32Array(KIND_COUNT);
    this.freeSlots = new Int32Array(total);
    this.freeTop = new Int32Array(KIND_COUNT);
    this.resetFreeStacks();
  }

  /** Live entities of one kind. */
  countOf(kind: number): number {
    return this.counts[kind];
  }

  /**
   * Makes an entity in the lowest-numbered free slot the kind most recently gave back.
   * @returns its handle, or `NULL_HANDLE` if the kind is full. Always check it.
   */
  create(kind: KindId, x: number, y: number, radius: number, vx = 0, vy = 0, flags = 0): Handle {
    if (!(kind >= 0 && kind < KIND_COUNT) || kind !== (kind | 0)) throw new RangeError(`unknown kind ${kind}`);
    const top = this.freeTop[kind];
    if (top === 0) {
      this.overflowCount++;
      return NULL_HANDLE;
    }
    this.freeTop[kind] = top - 1;
    const s = this.freeSlots[this.kindStart[kind] + top - 1];
    this.alive[s] = 1;
    this.kind[s] = kind;
    this.flags[s] = flags;
    this.x[s] = x;
    this.y[s] = y;
    this.px[s] = x;
    this.py[s] = y;
    this.vx[s] = vx;
    this.vy[s] = vy;
    this.radius[s] = radius;
    this.counts[kind]++;
    this.count++;
    return ((this.generation[s] << SLOT_BITS) | s) as Handle;
  }

  /** @returns false if the handle was stale (already destroyed, or from before `clear`). */
  destroy(h: Handle): boolean {
    const s = this.slotOf(h);
    if (s < 0) return false;
    this.release(s);
    return true;
  }

  isAlive(h: Handle): boolean {
    return this.slotOf(h) >= 0;
  }

  /** The handle's slot, or -1 if it is stale or was never valid. */
  slotOf(h: Handle): number {
    const s = h & SLOT_MASK;
    if (h <= 0 || s >= this.capacity) return -1;
    return this.alive[s] === 1 && this.generation[s] === h >>> SLOT_BITS ? s : -1;
  }

  /** The live handle for a slot (for a solver event that must name an entity), or `NULL_HANDLE` if the slot is dead. */
  handleAt(slot: number): Handle {
    if (!(slot >= 0 && slot < this.capacity) || this.alive[slot] !== 1) return NULL_HANDLE;
    return ((this.generation[slot] << SLOT_BITS) | slot) as Handle;
  }

  /** Removes everything. A cleared store hands out slots in the same order as a new one, and old handles are stale. */
  clear(): void {
    for (let s = 0; s < this.capacity; s++) if (this.alive[s] === 1) this.retire(s);
    this.counts.fill(0);
    this.count = 0;
    this.resetFreeStacks();
  }

  /** Call first in every fixed step: remembers this step's starting positions for the renderer. */
  beginStep(): void {
    this.px.set(this.x);
    this.py.set(this.y);
  }

  /** After a teleport: makes the previous position equal the current one so the renderer does not smear it. */
  snapPrev(slot: number): void {
    this.px[slot] = this.x[slot];
    this.py[slot] = this.y[slot];
  }

  private release(s: number): void {
    const k = this.kind[s];
    this.retire(s);
    this.counts[k]--;
    this.count--;
    this.freeSlots[this.kindStart[k] + this.freeTop[k]++] = s;
  }

  /** Marks a slot dead and moves it to its next generation (never 0, which `NULL_HANDLE` uses). */
  private retire(s: number): void {
    this.alive[s] = 0;
    const g = this.generation[s];
    this.generation[s] = g >= GEN_MAX ? 1 : g + 1;
  }

  /** Every kind's stack holds all its slots, lowest on top. */
  private resetFreeStacks(): void {
    for (let k = 0; k < KIND_COUNT; k++) {
      const start = this.kindStart[k];
      const n = this.kindEnd[k] - start;
      for (let i = 0; i < n; i++) this.freeSlots[start + i] = start + n - 1 - i;
      this.freeTop[k] = n;
    }
  }
}
