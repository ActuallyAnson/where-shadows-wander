// The per-frame calls on the hand trail and the room's bunting must not allocate.
// Needs `--expose-gc` (vitest.config.ts sets it); skipped without it.
import { describe, expect, it } from 'vitest';
import { createHandShadow } from '../hands/hand-shadow';
import { bytesPerFrame, gc } from '../testing/alloc-measure';
import { BuntingView } from './bunting-view';
import { HandTrailView } from './hand-trail-view';
import { createStagePlane } from './pure/stage-plane';

const FRAMES = 3_000;
const BUDGET_BYTES_PER_FRAME = 64;
const DT = 1 / 72;
const options = { frames: FRAMES, warmup: 100000, attempts: 6, goodBelow: BUDGET_BYTES_PER_FRAME / 2 };

function stagePlane() {
  const stage = createStagePlane();
  stage.origin.set([0, 1.2, -2]);
  stage.right.set([1, 0, 0]);
  stage.up.set([0, 1, 0]);
  stage.normal.set([0, 0, 1]);
  stage.width = 1.6;
  stage.height = 1;
  return stage;
}

describe.skipIf(!gc)('hand trail and bunting allocation', () => {
  it('HandTrailView.update() allocates nothing with a hand moving', () => {
    const stage = stagePlane();
    const view = new HandTrailView();
    const shadows = { left: createHandShadow('left'), right: createHandShadow('right') };
    const sh = shadows.right;
    sh.active = true;
    sh.onStage = true;
    let frame = 0;
    const bytes = bytesPerFrame(() => {
      const x = Math.sin(frame * 0.05) * 0.3;
      sh.bounds[0] = x - 0.05;
      sh.bounds[1] = -0.05;
      sh.bounds[2] = x + 0.05;
      sh.bounds[3] = 0.05;
      view.update(DT, stage, shadows, 1);
      frame++;
    }, options);
    console.info(`HandTrailView.update allocates ${bytes.toFixed(1)} B a frame`);
    expect(bytes).toBeLessThan(BUDGET_BYTES_PER_FRAME);
  }, 60_000);

  it('BuntingView.update() allocates nothing in a fan wind with ripples', () => {
    const view = new BuntingView();
    view.setWind(34);
    let frame = 0;
    const bytes = bytesPerFrame(() => {
      if (frame % 120 === 0) view.ripple(0.2, 1.5);
      view.update(DT);
      frame++;
    }, options);
    console.info(`BuntingView.update allocates ${bytes.toFixed(1)} B a frame`);
    expect(bytes).toBeLessThan(BUDGET_BYTES_PER_FRAME);
  }, 60_000);
});
