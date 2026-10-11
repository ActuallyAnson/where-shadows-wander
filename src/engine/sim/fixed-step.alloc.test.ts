// The loop, the input latch and the RNG run every frame: together they must build nothing.
// Same method as entity-store.alloc.test.ts. Needs `--expose-gc` (vitest.config.ts sets it).
import { describe, expect, it } from 'vitest';
import { GestureEventQueue } from '../hands/gesture-events';
import { ShapeEventQueue } from '../hands/shape-events';
import { FixedStepLoop } from './fixed-step';
import { InputLatch } from './input-latch';
import { Rng } from './rng';

// The project's TypeScript config has no Node types: reach the Node globals we need through globalThis.
const node = globalThis as unknown as {
  gc?: () => void;
  process: { memoryUsage(): { heapUsed: number }; env: Record<string, string | undefined> };
};
const gc = node.gc;

const FRAMES = 3_000;
const BUDGET_BYTES_PER_FRAME = 64;

/** One 90 Hz display frame: hand events arrive, are latched, and the loop steps 0 or 1 times. */
function makeFrame(extra?: () => void) {
  const shapes = new ShapeEventQueue();
  const gestures = new GestureEventQueue();
  const latch = new InputLatch();
  const rng = new Rng(5);
  // A typed-array accumulator: a captured `let` double would box a new heap number every add.
  const sum = new Float64Array(1);
  let frame = 0;
  const loop = new FixedStepLoop(
    60,
    () => {
      for (let i = 0; i < latch.shapes.count; i++) sum[0] += latch.shapes.at(i).heldS;
      for (let i = 0; i < latch.gestures.count; i++) sum[0] += latch.gestures.at(i).position[0];
      latch.consume();
      sum[0] += rng.range(0, 1) + rng.int(4);
      extra?.();
    },
    5,
  );
  return () => {
    shapes.clear();
    gestures.clear();
    if (frame % 5 === 0) shapes.push('commit', 'left', 'flat', frame, 0.2, 0.4);
    if (frame % 11 === 0) gestures.push('pinch-release', 'right', frame, 0.1, 0.2, 0.3, 0.2);
    latch.capture(shapes, gestures);
    sum[0] += loop.advance(1 / 90);
    if (sum[0] === Infinity) throw new Error('unreachable');
    frame++;
  };
}

/** Heap growth over `frames` frames; fails if a collection ran in the window, which would hide the garbage. */
function measure(frameFn: () => void, frames: number): number {
  for (let i = 0; i < 60000; i++) frameFn();
  gc!();
  const before = node.process.memoryUsage().heapUsed;
  let last = before;
  for (let i = 0; i < frames; i++) {
    frameFn();
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

describe.skipIf(!gc)('loop, latch and rng allocation', () => {
  it('a frame of latching and stepping stays under the allocation budget', () => {
    const bytes = measure(makeFrame(), FRAMES);
    console.info(`loop + latch + rng allocate ${(bytes / FRAMES).toFixed(1)} B a frame`);
    expect(bytes / FRAMES).toBeLessThan(BUDGET_BYTES_PER_FRAME);
  });

  it('catches a step that allocates (a control for the test itself)', () => {
    const bytes = measure(
      makeFrame(() => void new Array(64).fill(0.5)),
      FRAMES,
    );
    expect(bytes / FRAMES).toBeGreaterThan(BUDGET_BYTES_PER_FRAME);
  });
});
