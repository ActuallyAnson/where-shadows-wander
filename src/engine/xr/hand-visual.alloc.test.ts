// CapsuleHandVisual.update runs every XR frame, so it must not allocate (see frame-pipeline.alloc.test.ts
// for why). Needs `--expose-gc` (vitest.config.ts sets it).
import { describe, expect, it } from 'vitest';
import { bytesPerFrame, gc, inCI } from '../sim/alloc-measure';
import { createHandFrame } from '../hands/hand';
import { PRESETS, writeHandPose } from '../hands/synthetic-hand';
import { CapsuleHandVisual } from './hand-visual';

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

it('has garbage collection exposed when running in CI', () => {
  expect(gc !== undefined || !inCI).toBe(true);
});

describe.skipIf(!gc)('hand visual allocation', () => {
  it('stays under the allocation budget', () => {
    const bytes = bytesPerFrame(makeStep(), { frames: FRAMES, goodBelow: BUDGET_BYTES_PER_FRAME / 2 });
    console.info(`hand visual allocates ${bytes.toFixed(1)} B a frame`);
    expect(bytes).toBeLessThan(BUDGET_BYTES_PER_FRAME);
  }, 60_000);

  it('catches a step that allocates and throws it away (a control for the test itself)', () => {
    const bytes = bytesPerFrame(
      makeStep(() => void new Array(64).fill(0.5)),
      { frames: FRAMES, attempts: 1 },
    );
    expect(bytes).toBeGreaterThan(BUDGET_BYTES_PER_FRAME);
  }, 60_000);
});
