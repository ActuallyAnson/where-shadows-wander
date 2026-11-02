// The per-frame calls on the views added for the night's polish (spark, hand trail, rewards, bunting) must not allocate.
// Needs `--expose-gc` (vitest.config.ts sets it); skipped without it.
import { describe, expect, it } from 'vitest';
import { createHandShadow } from '../hands/hand-shadow';
import { bytesPerFrame, gc } from '../sim/alloc-measure';
import { BuntingView } from './bunting-view';
import { HandTrailView } from './hand-trail-view';
import { createStagePlane } from './pure/stage-plane';
import { RewardBurstView, REWARDS } from './reward-burst-view';
import { SparkFlightView } from './spark-flight-view';

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

const land = () => undefined;
const from = { x: 0, y: 1, z: -1 };
const to = { x: 1, y: 1.5, z: -3 };

describe.skipIf(!gc)('story views allocation', () => {
  it('SparkFlightView.update() allocates nothing while a spark flies, lands and is launched again', () => {
    const view = new SparkFlightView();
    let frame = 0;
    const bytes = bytesPerFrame(() => {
      if (frame % 200 === 0) view.launch(from, to, land, 1.2);
      view.update(DT);
      frame++;
    }, options);
    console.info(`SparkFlightView.update allocates ${bytes.toFixed(1)} B a frame`);
    expect(bytes).toBeLessThan(BUDGET_BYTES_PER_FRAME);
  }, 60_000);

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

  it('RewardBurstView play() and update() allocate nothing', () => {
    const stage = stagePlane();
    const view = new RewardBurstView();
    let frame = 0;
    const bytes = bytesPerFrame(() => {
      if (frame % 90 === 0) view.play(REWARDS[((frame / 90) % REWARDS.length) | 0], 0.1, 0.2);
      view.update(DT, stage, 1);
      frame++;
    }, options);
    console.info(`RewardBurstView allocates ${bytes.toFixed(1)} B a frame`);
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
