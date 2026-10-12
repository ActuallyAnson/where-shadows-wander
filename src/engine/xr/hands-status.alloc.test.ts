// HandsStatus.update and the SessionVisibility getters run every XR frame, so they must not allocate
// (see frame-pipeline.alloc.test.ts for why). Needs `--expose-gc` (vitest.config.ts sets it).
import { describe, expect, it } from 'vitest';
import { bytesPerFrame, gc, inCI } from '../sim/alloc-measure';
import { HandsStatus } from './hands-status';
import { SessionVisibility } from './session-visibility';

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

it('has garbage collection exposed when running in CI', () => {
  expect(gc !== undefined || !inCI).toBe(true);
});

describe.skipIf(!gc)('hands status allocation', () => {
  it('stays under the allocation budget', () => {
    const bytes = bytesPerFrame(makeStep(), { frames: FRAMES, goodBelow: BUDGET_BYTES_PER_FRAME / 2 });
    console.info(`hands status allocates ${bytes.toFixed(1)} B a frame`);
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
