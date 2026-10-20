// The time control runs every frame the debug tools are on, in the simulation's path: it must build nothing, in any
// of its modes. Same method as fixed-step.alloc.test.ts. Needs `--expose-gc` (vitest.config.ts sets it).
import { describe, expect, it } from 'vitest';
import { bytesPerFrame, gc, inCI } from '../engine/sim/alloc-measure';
import { FixedStepLoop } from '../engine/sim/fixed-step';
import { TimeControl } from './time-control';

const FRAMES = 3_000;
const BUDGET_BYTES_PER_FRAME = 64;

function makeFrame() {
  const sum = new Float64Array(1);
  const loop = new FixedStepLoop(60, () => void (sum[0] += 1), 5);
  const time = new TimeControl();
  let frame = 0;
  return () => {
    // Round the modes: running, slow, paused with steps requested, running again.
    const phase = Math.floor(frame / 50) % 4;
    if (frame % 50 === 0) {
      if (phase === 0) time.reset();
      else if (phase === 1) time.slower();
      else if (phase === 2) time.togglePause();
      else time.togglePause();
    }
    if (time.paused && frame % 7 === 0) time.stepOnce();
    sum[0] += time.advance(loop, 1 / 90);
    if (sum[0] === Infinity) throw new Error('unreachable');
    frame++;
  };
}

it('has garbage collection exposed when running in CI', () => {
  expect(gc !== undefined || !inCI).toBe(true);
});

describe.skipIf(!gc)('time control allocation', () => {
  it('running, slow, paused and stepping stay under the allocation budget', () => {
    const bytes = bytesPerFrame(makeFrame(), { frames: FRAMES, warmup: 60000, goodBelow: BUDGET_BYTES_PER_FRAME / 2 });
    console.info(`time control allocates ${bytes.toFixed(1)} B a frame`);
    expect(bytes).toBeLessThan(BUDGET_BYTES_PER_FRAME);
  });
});
