// CapsuleHandVisual.update runs every XR frame, so it must not allocate (see frame-pipeline.alloc.test.ts
// for why). Needs `--expose-gc` (vitest.config.ts sets it).
import { describe, expect, it } from 'vitest';
import { createHandFrame } from '../hands/hand';
import { PRESETS, writeHandPose } from '../hands/synthetic-hand';
import { CapsuleHandVisual } from './hand-visual';

const node = globalThis as unknown as {
  gc?: () => void;
  process: { memoryUsage(): { heapUsed: number }; env: Record<string, string | undefined> };
};
const gc = node.gc;
const FRAMES = 3_000;
const BUDGET_BYTES_PER_FRAME = 64;

function makeStep(extra?: () => void) {
  const visual = new CapsuleHandVisual();
  const left = createHandFrame('left');
  const right = createHandFrame('right');
  writeHandPose(PRESETS.flat, [-0.2, 1, -0.4], left);
  writeHandPose(PRESETS.fist, [0.2, 1, -0.4], right);
  left.tracked = right.tracked = true;
  const hands = [left, right];
  const flame = new Float64Array([0, 0.9, -0.3]);
  let frame = 0;
  return () => {
    right.tracked = Math.floor(frame / 300) % 2 === 0; // fades in and out too
    visual.update(hands, 1 / 72, flame);
    extra?.();
    frame++;
  };
}

function measure(step: () => void, frames: number): number {
  for (let i = 0; i < 60000; i++) step();
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

describe.skipIf(!gc)('hand visual allocation', () => {
  it('stays under the allocation budget', () => {
    const bytes = measure(makeStep(), FRAMES);
    console.info(`hand visual allocates ${(bytes / FRAMES).toFixed(1)} B a frame`);
    expect(bytes / FRAMES).toBeLessThan(BUDGET_BYTES_PER_FRAME);
  });

  it('catches a step that allocates and throws it away (a control for the test itself)', () => {
    const bytes = measure(
      makeStep(() => void new Array(64).fill(0.5)),
      FRAMES,
    );
    expect(bytes / FRAMES).toBeGreaterThan(BUDGET_BYTES_PER_FRAME);
  });
});
