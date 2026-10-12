// The entity store must not allocate per frame: create, destroy, beginStep and a solver-style scan
// run every step. This churns the store the way a chapter would (rain drops spawning and dying,
// rocks and crows coming and going) for thousands of frames and checks the heap, as
// frame-pipeline.alloc.test.ts does for the hand pipeline. Needs `--expose-gc` (vitest.config.ts sets it).
import { describe, expect, it } from 'vitest';
import { bytesPerFrame, gc, inCI } from './alloc-measure';
import { DEFAULT_CAPACITIES, Kind } from './entity-kinds';
import { EntityStore, NULL_HANDLE, type Handle } from './entity-store';
import { circleVsCapsule, normalize, type Vec2 } from './vec2';

const DROPS = 40;
const FRAMES = 3_000;
const BUDGET_BYTES_PER_FRAME = 64;

/** One frame of churn: spawn some drops, kill the oldest, a fixed step's worth of reads and writes. */
function makeStep(extra?: () => void) {
  const store = new EntityStore(DEFAULT_CAPACITIES);
  // Ring of live handles in a typed array, so the test's own bookkeeping builds nothing.
  const ring = new Int32Array(DROPS);
  let head = 0;
  let frame = 0;
  const scratch: Vec2 = { x: 0, y: 0 };
  store.create(Kind.Traveller, 0, 0, 0.1);
  return () => {
    store.beginStep();
    const old = ring[head] as Handle;
    if (old !== NULL_HANDLE) store.destroy(old);
    ring[head] = store.create(Kind.Raindrop, (frame % 100) * 0.01, 1, 0.02, 0, -1);
    head = (head + 1) % DROPS;
    if (frame % 90 === 0) store.destroy(store.handleAt(store.kindStart[Kind.Crow]));
    if (frame % 90 === 45) store.create(Kind.Crow, 1, 0.5, 0.08);
    let sum = 0;
    for (let s = 0; s < store.capacity; s++) {
      if (!store.alive[s]) continue;
      store.x[s] += store.vx[s] / 60;
      store.y[s] += store.vy[s] / 60;
      sum += circleVsCapsule(store.x[s], store.y[s], store.radius[s], 0, 0, 1, 0, 0.05, scratch);
      sum += normalize(store.vx[s], store.vy[s], scratch);
      sum += store.px[s] + (store.x[s] - store.px[s]) * 0.5;
    }
    if (sum === Infinity) throw new Error('unreachable');
    extra?.();
    frame++;
  };
}

it('has garbage collection exposed when running in CI', () => {
  expect(gc !== undefined || !inCI).toBe(true);
});

describe.skipIf(!gc)('entity store allocation', () => {
  it('create, destroy, beginStep and a full scan stay under the allocation budget', () => {
    const bytes = bytesPerFrame(makeStep(), { frames: FRAMES, goodBelow: BUDGET_BYTES_PER_FRAME / 2 });
    console.info(`entity store allocates ${bytes.toFixed(1)} B a frame`);
    expect(bytes).toBeLessThan(BUDGET_BYTES_PER_FRAME);
  }, 60_000);

  it('catches a step that allocates and throws it away (a control for the test itself)', () => {
    const bytes = bytesPerFrame(
      makeStep(() => void new Array(256).fill(0.5)),
      { frames: FRAMES, attempts: 1 },
    );
    expect(bytes).toBeGreaterThan(BUDGET_BYTES_PER_FRAME);
  }, 60_000);
});
