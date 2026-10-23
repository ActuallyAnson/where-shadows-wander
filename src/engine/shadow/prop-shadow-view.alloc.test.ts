// The per-frame call on the prop shadows, update(), must not allocate (setProps runs at load, not every frame).
// Needs `--expose-gc` (vitest.config.ts sets it); skipped without it.
import { describe, expect, it } from 'vitest';
import { bytesPerFrame, gc } from '../sim/alloc-measure';
import type { Prop } from './pure/prop-shadow';
import { createStagePlane } from './pure/stage-plane';
import { PropShadowView } from './prop-shadow-view';

const FRAMES = 3_000;
const BUDGET_BYTES_PER_FRAME = 64;

function makeStep(extra?: () => void) {
  const stage = createStagePlane();
  const view = new PropShadowView();
  const props: Prop[] = [{ shape: 'box', position: [0, 0.05, 0.3], size: [0.2, 0.1, 0.1], rotation: [0, 0, 0, 1] }];
  view.setProps(props, [0, 0, 0.6], stage, 0.9);
  let frame = 0;
  return () => {
    view.update(stage, 0.5 + (frame % 10) * 0.05);
    extra?.();
    frame++;
  };
}

describe.skipIf(!gc)('prop shadow view allocation', () => {
  it('update() stays under the allocation budget', () => {
    const bytes = bytesPerFrame(makeStep(), {
      frames: FRAMES,
      warmup: 200000,
      attempts: 6,
      goodBelow: BUDGET_BYTES_PER_FRAME / 2,
    });
    console.info(`PropShadowView.update allocates ${bytes.toFixed(1)} B a frame`);
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
