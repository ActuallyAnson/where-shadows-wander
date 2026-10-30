// Puzzle objects that are not entities: the drips' source, the fan's wind, a gate, a weight
// plate, the lit window. Puzzles add them on load and update them
// as they change; the renderer (Teammate B) draws them from this list. Plain TypeScript; a fixed
// pool of reused records, so updating them each step builds nothing.

export type FixtureKind = 'drip' | 'wind' | 'gate' | 'plate' | 'window';

export interface Fixture {
  kind: FixtureKind;
  /** Centre and size on the stage, metres. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Shown and in effect (a gate that is shut, wind that blows). */
  active: boolean;
  /** Kind-specific, 0..1 unless noted: wind strength, a gate open, a plate pressed... */
  value: number;
}

export class Fixtures {
  private readonly pool: Fixture[];
  count = 0;

  constructor(readonly capacity = 16) {
    this.pool = Array.from({ length: capacity }, () => ({
      kind: 'drip' as FixtureKind,
      x: 0,
      y: 0,
      w: 0,
      h: 0,
      active: false,
      value: 0,
    }));
  }

  /** Adds a fixture (on puzzle load). Throws if the pool is full: that is a puzzle authoring error. */
  add(kind: FixtureKind, x: number, y: number, w: number, h: number, active = true, value = 0): Fixture {
    if (this.count === this.capacity) throw new RangeError(`more than ${this.capacity} fixtures`);
    const f = this.pool[this.count++];
    f.kind = kind;
    f.x = x;
    f.y = y;
    f.w = w;
    f.h = h;
    f.active = active;
    f.value = value;
    return f;
  }

  at(i: number): Readonly<Fixture> {
    if (i < 0 || i >= this.count) throw new RangeError(`No fixture ${i} (${this.count})`);
    return this.pool[i];
  }

  /** The first fixture of a kind, or null. */
  find(kind: FixtureKind): Fixture | null {
    for (let i = 0; i < this.count; i++) if (this.pool[i].kind === kind) return this.pool[i];
    return null;
  }

  clear(): void {
    this.count = 0;
  }
}
