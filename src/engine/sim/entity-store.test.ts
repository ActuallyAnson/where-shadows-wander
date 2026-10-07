import { describe, expect, it } from 'vitest';
import { DEFAULT_CAPACITIES, Flag, KIND_COUNT, Kind, type KindId } from './entity-kinds';
import { EntityStore, MAX_SLOTS, NULL_HANDLE, type Handle } from './entity-store';

/** Small capacities, so the ranges are easy to read: traveller 0, rock 1-3, raindrop 4-7, the rest 0. */
const SMALL = [1, 3, 4, 0, 0, 0, 0];

function make(capacities: readonly number[] = SMALL): EntityStore {
  return new EntityStore(capacities);
}

function seeded(seed: number): () => number {
  return () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
}

/** Live (slot, handle) pairs in iteration order, the way the solver would walk them. */
function snapshot(store: EntityStore): string {
  const out: string[] = [];
  for (let s = 0; s < store.capacity; s++) {
    if (store.alive[s]) out.push(`${s}:${store.handleAt(s)}:${store.kind[s]}:${store.x[s]}`);
  }
  return out.join(' ');
}

describe('EntityStore layout', () => {
  it('reserves one contiguous slot range per kind', () => {
    const s = make();
    expect(s.capacity).toBe(8);
    expect(Array.from(s.kindStart)).toEqual([0, 1, 4, 8, 8, 8, 8]);
    expect(Array.from(s.kindEnd)).toEqual([1, 4, 8, 8, 8, 8, 8]);
  });

  it('rejects bad capacities', () => {
    expect(() => new EntityStore([1, 2])).toThrow(RangeError);
    expect(() => make([1, -1, 0, 0, 0, 0, 0])).toThrow(RangeError);
    expect(() => make([1.5, 0, 0, 0, 0, 0, 0])).toThrow(RangeError);
    expect(() => make([MAX_SLOTS + 1, 0, 0, 0, 0, 0, 0])).toThrow(RangeError);
  });

  it('numbers the kinds 0 to KIND_COUNT - 1 with no gaps, and has a default capacity for each', () => {
    expect(Object.values(Kind).sort((a, b) => a - b)).toEqual(Array.from({ length: KIND_COUNT }, (_, i) => i));
    expect(DEFAULT_CAPACITIES).toHaveLength(KIND_COUNT);
  });

  it('builds with the default capacities', () => {
    const s = new EntityStore(DEFAULT_CAPACITIES);
    expect(s.capacity).toBe(DEFAULT_CAPACITIES.reduce((a, b) => a + b, 0));
    expect(DEFAULT_CAPACITIES).toHaveLength(KIND_COUNT);
  });
});

describe('create', () => {
  it('stores the state and starts with the previous position equal to the current one', () => {
    const s = make();
    const h = s.create(Kind.Rock, 1.5, 0.25, 0.1, 2, -3, Flag.Static);
    const i = s.slotOf(h);
    expect(i).toBe(1);
    expect([s.x[i], s.y[i], s.px[i], s.py[i], s.vx[i], s.vy[i]]).toEqual([1.5, 0.25, 1.5, 0.25, 2, -3]);
    expect(s.radius[i]).toBeCloseTo(0.1, 6);
    expect(s.kind[i]).toBe(Kind.Rock);
    expect(s.flags[i]).toBe(Flag.Static);
    expect(s.count).toBe(1);
    expect(s.countOf(Kind.Rock)).toBe(1);
  });

  it('clears stale state when a slot is reused', () => {
    const s = make();
    const a = s.create(Kind.Rock, 9, 9, 1, 5, 5, Flag.Static | Flag.Grounded);
    s.destroy(a);
    const b = s.create(Kind.Rock, 0, 0, 0.2);
    const i = s.slotOf(b);
    expect([s.vx[i], s.vy[i], s.flags[i], s.px[i], s.py[i]]).toEqual([0, 0, 0, 0, 0]);
  });

  it('fills a kind from its lowest slot', () => {
    const s = make();
    const slots = [0, 1, 2].map(() => s.slotOf(s.create(Kind.Rock, 0, 0, 0.1)));
    expect(slots).toEqual([1, 2, 3]);
  });

  it('returns NULL_HANDLE when a kind is full, counts it, and leaves other kinds alone', () => {
    const s = make();
    for (let i = 0; i < 3; i++) expect(s.create(Kind.Rock, 0, 0, 0.1)).not.toBe(NULL_HANDLE);
    expect(s.create(Kind.Rock, 0, 0, 0.1)).toBe(NULL_HANDLE);
    expect(s.overflowCount).toBe(1);
    expect(s.count).toBe(3);
    expect(s.create(Kind.Raindrop, 0, 0, 0.02)).not.toBe(NULL_HANDLE);
    expect(s.create(Kind.Traveller, 0, 0, 0.1)).not.toBe(NULL_HANDLE);
  });

  it('refuses a kind with no slots without throwing', () => {
    const s = make();
    expect(s.create(Kind.Crow, 0, 0, 0.1)).toBe(NULL_HANDLE);
  });

  it('throws on an unknown kind', () => {
    const s = make();
    expect(() => s.create(KIND_COUNT as KindId, 0, 0, 0.1)).toThrow(RangeError);
    expect(() => s.create(-1 as KindId, 0, 0, 0.1)).toThrow(RangeError);
    expect(() => s.create(0.5 as KindId, 0, 0, 0.1)).toThrow(RangeError);
  });

  it('never hands out NULL_HANDLE for a live entity', () => {
    const s = make();
    expect(s.create(Kind.Traveller, 0, 0, 0.1)).not.toBe(NULL_HANDLE);
  });
});

describe('destroy and handles', () => {
  it('detects a stale handle after destroy', () => {
    const s = make();
    const h = s.create(Kind.Rock, 0, 0, 0.1);
    expect(s.isAlive(h)).toBe(true);
    expect(s.destroy(h)).toBe(true);
    expect(s.isAlive(h)).toBe(false);
    expect(s.slotOf(h)).toBe(-1);
    expect(s.count).toBe(0);
    expect(s.countOf(Kind.Rock)).toBe(0);
  });

  it('returns false when destroyed twice', () => {
    const s = make();
    const h = s.create(Kind.Rock, 0, 0, 0.1);
    expect(s.destroy(h)).toBe(true);
    expect(s.destroy(h)).toBe(false);
    expect(s.count).toBe(0);
  });

  it('reuses the slot with a new handle, and the old handle cannot touch the new occupant', () => {
    const s = make();
    const old = s.create(Kind.Rock, 1, 1, 0.1);
    const oldSlot = s.slotOf(old);
    s.destroy(old);
    const fresh = s.create(Kind.Rock, 2, 2, 0.1);
    expect(s.slotOf(fresh)).toBe(oldSlot);
    expect(fresh).not.toBe(old);
    expect(s.isAlive(old)).toBe(false);
    expect(s.destroy(old)).toBe(false);
    expect(s.isAlive(fresh)).toBe(true);
    expect(s.x[s.slotOf(fresh)]).toBe(2);
  });

  it('reuses the most recently freed slot first', () => {
    const s = make();
    const a = s.create(Kind.Raindrop, 0, 0, 0.02);
    const b = s.create(Kind.Raindrop, 0, 0, 0.02);
    const c = s.create(Kind.Raindrop, 0, 0, 0.02);
    const [sa, sb] = [s.slotOf(a), s.slotOf(b)];
    s.destroy(a);
    s.destroy(b);
    expect(s.slotOf(s.create(Kind.Raindrop, 0, 0, 0.02))).toBe(sb);
    expect(s.slotOf(s.create(Kind.Raindrop, 0, 0, 0.02))).toBe(sa);
    expect(s.isAlive(c)).toBe(true);
  });

  it('rejects handles that were never valid', () => {
    const s = make();
    for (const bad of [NULL_HANDLE, -1, 5, 1 << 12, 99999, NaN, 1.5] as Handle[]) {
      expect(s.isAlive(bad)).toBe(false);
      expect(s.slotOf(bad)).toBe(-1);
      expect(s.destroy(bad)).toBe(false);
    }
  });

  it('handleAt names a live slot and gives NULL_HANDLE for a dead or out-of-range one', () => {
    const s = make();
    const h = s.create(Kind.Rock, 0, 0, 0.1);
    expect(s.handleAt(s.slotOf(h))).toBe(h);
    s.destroy(h);
    expect(s.handleAt(1)).toBe(NULL_HANDLE);
    expect(s.handleAt(-1)).toBe(NULL_HANDLE);
    expect(s.handleAt(99)).toBe(NULL_HANDLE);
  });

  it('keeps every handle a small integer and stays correct as one slot cycles through its generations', () => {
    const s = make([0, 0, 1, 0, 0, 0, 0]);
    const LIMIT = 2 ** 30;
    let previous = NULL_HANDLE;
    let wrapped = false;
    let bad = 0; // plain counters: a quarter of a million expect() calls would time the test out
    for (let i = 0; i < (1 << 18) + 100; i++) {
      const h = s.create(Kind.Raindrop, i, 0, 0.02);
      if (!(h > 0 && h < LIMIT)) bad++;
      if (!s.isAlive(h)) bad++;
      if (previous !== NULL_HANDLE && s.isAlive(previous)) bad++;
      if (h < previous) wrapped = true;
      s.destroy(h);
      if (s.isAlive(h)) bad++;
      previous = h;
    }
    expect(bad).toBe(0);
    expect(wrapped).toBe(true);
  });
});

describe('clear', () => {
  it('removes everything and makes old handles stale', () => {
    const s = make();
    const hs = [Kind.Traveller, Kind.Rock, Kind.Raindrop].map((k) => s.create(k, 0, 0, 0.1));
    s.clear();
    expect(s.count).toBe(0);
    for (const h of hs) expect(s.isAlive(h)).toBe(false);
    for (let k = 0; k < KIND_COUNT; k++) expect(s.countOf(k)).toBe(0);
    for (let i = 0; i < s.capacity; i++) expect(s.alive[i]).toBe(0);
  });

  it('hands out slots in the same order as a new store', () => {
    const run = (s: EntityStore) => {
      const random = seeded(3);
      const live: Handle[] = [];
      const slots: number[] = [];
      for (let i = 0; i < 200; i++) {
        if (random() < 0.55 || live.length === 0) {
          const h = s.create(random() < 0.5 ? Kind.Rock : Kind.Raindrop, i, 0, 0.1);
          slots.push(h === NULL_HANDLE ? -1 : s.slotOf(h));
          if (h !== NULL_HANDLE) live.push(h);
        } else {
          s.destroy(live.splice(Math.floor(random() * live.length), 1)[0]);
        }
      }
      return slots;
    };
    const dirty = make();
    for (let i = 0; i < 3; i++) dirty.create(Kind.Rock, 0, 0, 0.1);
    dirty.destroy(dirty.handleAt(2));
    dirty.create(Kind.Raindrop, 0, 0, 0.1);
    dirty.clear();
    expect(run(dirty)).toEqual(run(make()));
  });
});

describe('iteration order', () => {
  it('walks slots ascending: kind order, then slot within the kind', () => {
    const s = make();
    s.create(Kind.Raindrop, 0, 0, 0.02);
    s.create(Kind.Rock, 0, 0, 0.1);
    s.create(Kind.Traveller, 0, 0, 0.1);
    s.create(Kind.Rock, 0, 0, 0.1);
    const seen: number[] = [];
    for (let i = 0; i < s.capacity; i++) if (s.alive[i]) seen.push(s.kind[i]);
    expect(seen).toEqual([Kind.Traveller, Kind.Rock, Kind.Rock, Kind.Raindrop]);
  });

  it('lets the renderer walk one kind through its range', () => {
    const s = make();
    for (let i = 0; i < 3; i++) s.create(Kind.Rock, i, 0, 0.1);
    s.create(Kind.Raindrop, 50, 0, 0.02);
    s.destroy(s.handleAt(2));
    const xs: number[] = [];
    for (let i = s.kindStart[Kind.Rock]; i < s.kindEnd[Kind.Rock]; i++) if (s.alive[i]) xs.push(s.x[i]);
    expect(xs).toEqual([0, 2]);
  });

  it('survives destroying entities while iterating', () => {
    const s = make();
    for (let i = 0; i < 3; i++) s.create(Kind.Rock, i, 0, 0.1);
    const seen: number[] = [];
    for (let i = 0; i < s.capacity; i++) {
      if (!s.alive[i]) continue;
      seen.push(s.x[i]);
      s.destroy(s.handleAt(i));
    }
    expect(seen).toEqual([0, 1, 2]);
    expect(s.count).toBe(0);
  });
});

describe('determinism', () => {
  const script = (store: EntityStore, seed: number) => {
    const random = seeded(seed);
    const live: Handle[] = [];
    for (let i = 0; i < 2000; i++) {
      const r = random();
      if (r < 0.5) {
        const h = store.create(Math.floor(random() * 3) as KindId, random(), random(), 0.05);
        if (h !== NULL_HANDLE) live.push(h);
      } else if (live.length > 0) {
        store.destroy(live.splice(Math.floor(random() * live.length), 1)[0]);
      }
      if (i % 7 === 0) store.beginStep();
    }
    return snapshot(store);
  };

  it('gives identical state, slots and handles for the same call sequence', () => {
    expect(script(make(), 11)).toBe(script(make(), 11));
    expect(script(make(), 11)).not.toBe(script(make(), 12));
  });
});

describe('interpolation support', () => {
  it('beginStep copies the current position into the previous one', () => {
    const s = make();
    const i = s.slotOf(s.create(Kind.Rock, 1, 2, 0.1));
    s.x[i] = 3;
    s.y[i] = 4;
    expect([s.px[i], s.py[i]]).toEqual([1, 2]);
    s.beginStep();
    expect([s.px[i], s.py[i]]).toEqual([3, 4]);
    s.x[i] = 5;
    const alpha = 0.5;
    expect(s.px[i] + (s.x[i] - s.px[i]) * alpha).toBe(4);
  });

  it('snapPrev removes the smear after a teleport', () => {
    const s = make();
    const i = s.slotOf(s.create(Kind.Rock, 1, 2, 0.1));
    s.x[i] = 100;
    s.y[i] = 100;
    s.snapPrev(i);
    expect([s.px[i], s.py[i]]).toEqual([100, 100]);
  });
});
