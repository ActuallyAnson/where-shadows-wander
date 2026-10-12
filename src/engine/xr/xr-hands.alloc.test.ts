// XRHandReader.update runs every XR frame, so it must not allocate (see frame-pipeline.alloc.test.ts for why).
// It had allocated about 160 B a frame on the fast path and about 960 B on the Pico's getJointPose path (a new
// array of sources, a second pose lookup for each radius). The fake frame reuses its pose object, so this
// measures the reader. Needs `--expose-gc` (vitest.config.ts sets it).
import { describe, expect, it } from 'vitest';
import { bytesPerFrame, gc, inCI } from '../sim/alloc-measure';
import { makeFakeXr } from './fake-xr-hands';
import { XRHandReader } from './xr-hands';

const BUDGET_BYTES_PER_FRAME = 64;
const ref = {} as XRReferenceSpace;

it('has garbage collection exposed when running in CI', () => {
  expect(gc !== undefined || !inCI).toBe(true);
});

describe.skipIf(!gc)('hand reader allocation', () => {
  for (const [name, fast] of [
    ['the fast path (fillPoses)', true],
    ['the getJointPose path (the Pico’s)', false],
  ] as const) {
    it(`stays under the allocation budget on ${name}`, () => {
      const xr = makeFakeXr({ fast });
      const reader = new XRHandReader();
      const bytes = bytesPerFrame(() => reader.update(xr.frame, ref, xr.origin), {
        goodBelow: BUDGET_BYTES_PER_FRAME / 2,
      });
      console.info(`hand reader allocates ${bytes.toFixed(1)} B a frame on ${name}`);
      expect(bytes).toBeLessThan(BUDGET_BYTES_PER_FRAME);
    }, 60_000);
  }

  it('catches a reader that allocates and throws it away (a control for the test itself)', () => {
    const xr = makeFakeXr({ fast: true });
    const reader = new XRHandReader();
    const bytes = bytesPerFrame(
      () => {
        reader.update(xr.frame, ref, xr.origin);
        void new Array(64).fill(0.5);
      },
      { goodBelow: 0 },
    );
    expect(bytes).toBeGreaterThan(BUDGET_BYTES_PER_FRAME);
  }, 60_000);
});
