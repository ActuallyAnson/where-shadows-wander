// The solver steps every frame: a busy step (rain on terrain, both hands solid, contacts, support
// queries) must build no objects or arrays. Same method as entity-store.alloc.test.ts. Needs
// `--expose-gc`. What remains (a few bytes a step, measured) is the engine boxing numbers across
// calls it didn't inline; see the note in solver.ts.
import { describe, expect, it } from 'vitest';
import { bytesPerFrame, gc, inCI } from './alloc-measure';
import { createHandShadow } from '../hands/hand-shadow';
import { DEFAULT_CAPACITIES, Kind } from './entity-kinds';
import { EntityStore } from './entity-store';
import { Rng } from './rng';
import { cupShadow, flatShadow } from './shadow-shapes';
import { LEFT, RIGHT, Solver, Touch, type Support } from './solver';

const FRAMES = 2_000;
const TIMEOUT_MS = 60_000;
const BUDGET_BYTES_PER_FRAME = 64;
/** The left hand sways through this many prebuilt poses, so the solver sees a moving hand. */
const LEFT_POSES = 64;

function makeStep(extra?: () => void) {
  const store = new EntityStore(DEFAULT_CAPACITIES);
  const solver = new Solver(store.capacity);
  const rng = new Rng(11);
  const support: Support = { y: 0, type: Touch.None, id: -1 };
  const acc = new Float64Array(1);
  solver.terrain.add(-0.8, -0.35, -0.15, -0.35, 0.05);
  solver.terrain.add(0.15, -0.35, 0.8, -0.35, 0.05);
  // The scripted shadows are built up front, so only the solver is measured: unoptimised, the
  // shadow helpers box hundreds of bytes a call, and on a slow CI runner they are optimised late.
  const lefts = Array.from({ length: LEFT_POSES }, (_, k) => {
    const sh = createHandShadow('left');
    flatShadow(sh, Math.sin((k / LEFT_POSES) * Math.PI * 2) * 0.05, -0.32);
    return sh;
  });
  const right = createHandShadow('right');
  cupShadow(right, 0.3, 0.1);
  store.create(Kind.Traveller, -0.6, -0.25, 0.04);
  let frame = 0;
  return () => {
    const left = lefts[frame % LEFT_POSES];
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

it('has garbage collection exposed when running in CI', () => {
  expect(gc !== undefined || !inCI).toBe(true);
});

describe.skipIf(!gc)('solver allocation', () => {
  it(
    'a busy step and the queries stay under the allocation budget',
    () => {
      const bytes = bytesPerFrame(makeStep(), { frames: FRAMES, goodBelow: BUDGET_BYTES_PER_FRAME / 2 });
      console.info(`solver allocates ${bytes.toFixed(1)} B a step`);
      expect(bytes).toBeLessThan(BUDGET_BYTES_PER_FRAME);
    },
    TIMEOUT_MS,
  );

  it(
    'catches a step that allocates (a control for the test itself)',
    () => {
      const bytes = bytesPerFrame(
        makeStep(() => void new Array(64).fill(0.5)),
        { frames: FRAMES, attempts: 1 },
      );
      expect(bytes).toBeGreaterThan(BUDGET_BYTES_PER_FRAME);
    },
    TIMEOUT_MS,
  );
});
