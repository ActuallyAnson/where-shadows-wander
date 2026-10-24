// The per-frame hand pipeline must not allocate: the garbage collector's pauses
// show up as dropped frames on a headset. This runs the same stages as the
// frame loop (shape recognizer, gesture detector, shadow projector) on
// synthetic hands cycling through shapes and checks the heap and the GC log.
// Needs `--expose-gc` (vitest.config.ts sets it); skipped without it.
import { describe, expect, it } from 'vitest';
import { gc, makePipeline, measure, node } from './frame-pipeline-fixture';

const FRAMES = 3_000;
/**
 * The stages build no objects or arrays per frame: they write into reused structs. V8 still boxes some
 * doubles that small helper functions return (about 530 B a frame measured with the sharpen and lantern models included). Math.hypot used to add
 * another 6.4 KB a frame and was replaced with Math.sqrt. The budget is 1.5 times the baseline, so a
 * stage that starts allocating real structures fails it (two copied 75-float joint arrays add about 380 B).
 */
const BUDGET_BYTES_PER_FRAME = 700;

// Running without --expose-gc skips the checks below; in CI that must be an error, not a silent pass.
it('has garbage collection exposed when running in CI', () => {
  expect(gc !== undefined || !node.process.env.CI).toBe(true);
});

describe.skipIf(!gc)('frame pipeline allocation', () => {
  it('recognizer, gestures and shadow projector stay under the allocation budget', () => {
    const { heapBytes } = measure(makePipeline(), FRAMES);
    console.info(`pipeline allocates ${(heapBytes / FRAMES).toFixed(0)} B a frame`);
    expect(heapBytes / FRAMES).toBeLessThan(BUDGET_BYTES_PER_FRAME);
  }, 60_000);

  it('catches a stage that allocates and throws it away (a control for the test itself)', () => {
    const { heapBytes } = measure(
      makePipeline(() => void new Array(256).fill(0.5)), // about 2 KB of garbage a frame, never retained
      FRAMES,
    );
    expect(heapBytes / FRAMES).toBeGreaterThan(BUDGET_BYTES_PER_FRAME);
  }, 60_000);

  it('catches the regression the docs name: a joint array copied per hand per frame', () => {
    const joints = new Float32Array(75);
    const { heapBytes } = measure(
      makePipeline(() => {
        void Float32Array.from(joints);
        void Float32Array.from(joints);
      }),
      FRAMES,
    );
    expect(heapBytes / FRAMES).toBeGreaterThan(BUDGET_BYTES_PER_FRAME);
  }, 60_000);
});
