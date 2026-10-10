// The solver steps every frame: a busy step (rain on terrain, both hands solid, contacts, support
// queries) must build no objects or arrays. Same method as entity-store.alloc.test.ts. Needs
// `--expose-gc`. What remains (about 40 B a step, measured) is the engine boxing numbers across
// calls it didn't inline, mostly in this test's own scripted shadows; see the note in solver.ts.
import { describe, expect, it } from 'vitest';
import { createHandShadow } from '../hands/hand-shadow';
import { DEFAULT_CAPACITIES, Kind } from './entity-kinds';
import { EntityStore } from './entity-store';
import { Rng } from './rng';
import { cupShadow, flatShadow } from './shadow-shapes';
import { LEFT, RIGHT, Solver, Touch, type Support } from './solver';

// The project's TypeScript config has no Node types: reach the Node globals we need through globalThis.
const node = globalThis as unknown as {
  gc?: () => void;
  process: { memoryUsage(): { heapUsed: number }; env: Record<string, string | undefined> };
};
const gc = node.gc;

const FRAMES = 2_000;
const TIMEOUT_MS = 60_000;
const BUDGET_BYTES_PER_FRAME = 64;

function makeStep(extra?: () => void) {
  const store = new EntityStore(DEFAULT_CAPACITIES);
  const solver = new Solver(store.capacity);
  const rng = new Rng(11);
  const support: Support = { y: 0, type: Touch.None, id: -1 };
  const acc = new Float64Array(1);
  solver.terrain.add(-0.8, -0.35, -0.15, -0.35, 0.05);
  solver.terrain.add(0.15, -0.35, 0.8, -0.35, 0.05);
  const left = createHandShadow('left');
  const right = createHandShadow('right');
  store.create(Kind.Traveller, -0.6, -0.25, 0.04);
  let frame = 0;
  return () => {
    flatShadow(left, Math.sin(frame * 0.01) * 0.05, -0.32);
    cupShadow(right, 0.3, 0.1);
    solver.hands[LEFT].copyFrom(true, left.capsules, left.bounds);
    solver.hands[RIGHT].copyFrom(true, right.capsules, right.bounds);
    solver.hands[LEFT].mask = solver.hands[RIGHT].mask = 0xffff;
    store.beginStep();
    for (let s = store.kindStart[Kind.Raindrop]; s < store.kindEnd[Kind.Raindrop]; s++) {
      if (store.alive[s] && store.y[s] < -0.2) store.destroy(store.handleAt(s));
    }
    if (store.countOf(Kind.Raindrop) < 60) store.create(Kind.Raindrop, rng.range(-0.6, 0.6), 0.45, 0.01, 0, -0.6);
    solver.step(store, 1 / 60);
    solver.supportBelow(-0.5, 0, -0.5, 1, support);
    acc[0] += support.y + solver.contactCount + (solver.blocked(store, 0, 0, 0.04, 1) ? 1 : 0);
    extra?.();
    frame++;
  };
}

/** Heap growth over `frames` steps; fails if a collection ran in the window, which would hide the garbage. */
function measure(step: () => void, frames: number): number {
  for (let i = 0; i < 20000; i++) step();
  gc!();
  const before = node.process.memoryUsage().heapUsed;
  let last = before;
  for (let i = 0; i < frames; i++) {
    step();
    if (i % 100 === 99) {
      const now = node.process.memoryUsage().heapUsed;
      if (now < last)
        throw new Error(`a collection ran at frame ${i}: the young generation is too small for this window`);
      last = now;
    }
  }
  return node.process.memoryUsage().heapUsed - before;
}

it('has garbage collection exposed when running in CI', () => {
  expect(gc !== undefined || !node.process.env.CI).toBe(true);
});

describe.skipIf(!gc)('solver allocation', () => {
  it(
    'a busy step and the queries stay under the allocation budget',
    () => {
      const bytes = measure(makeStep(), FRAMES);
      console.info(`solver allocates ${(bytes / FRAMES).toFixed(1)} B a step`);
      expect(bytes / FRAMES).toBeLessThan(BUDGET_BYTES_PER_FRAME);
    },
    TIMEOUT_MS,
  );

  it(
    'catches a step that allocates (a control for the test itself)',
    () => {
      const bytes = measure(
        makeStep(() => void new Array(64).fill(0.5)),
        FRAMES,
      );
      expect(bytes / FRAMES).toBeGreaterThan(BUDGET_BYTES_PER_FRAME);
    },
    TIMEOUT_MS,
  );
});
