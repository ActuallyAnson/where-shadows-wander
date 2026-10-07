// HandsStatus.update and the SessionVisibility getters run every XR frame, so they must not allocate
// (see frame-pipeline.alloc.test.ts for why). Needs `--expose-gc` (vitest.config.ts sets it).
import { describe, expect, it } from 'vitest';
import { HandsStatus } from './hands-status';
import { SessionVisibility } from './session-visibility';

const node = globalThis as unknown as {
  gc?: () => void;
  process: { memoryUsage(): { heapUsed: number }; env: Record<string, string | undefined> };
};
const gc = node.gc;
const FRAMES = 3_000;
const BUDGET_BYTES_PER_FRAME = 64;

function makeStep(extra?: () => void) {
  const status = new HandsStatus();
  status.start();
  const visibility = new SessionVisibility();
  let frame = 0;
  return () => {
    // Cycle through tracking, a dropout long enough for the message, and no hand sources at all.
    const phase = Math.floor(frame / 400) % 3;
    status.update(1 / 72, phase === 0, phase === 2 ? 0 : 2);
    if (status.showMessage && status.message.length === 0) throw new Error('unreachable');
    if (visibility.paused) throw new Error('unreachable');
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

describe.skipIf(!gc)('hands status allocation', () => {
  it('stays under the allocation budget', () => {
    const bytes = measure(makeStep(), FRAMES);
    console.info(`hands status allocates ${(bytes / FRAMES).toFixed(1)} B a frame`);
    expect(bytes / FRAMES).toBeLessThan(BUDGET_BYTES_PER_FRAME);
  });

  it('catches a step that allocates and throws it away (a control for the test itself)', () => {
    const bytes = measure(
      makeStep(() => void new Array(256).fill(0.5)),
      FRAMES,
    );
    expect(bytes / FRAMES).toBeGreaterThan(BUDGET_BYTES_PER_FRAME);
  });
});
