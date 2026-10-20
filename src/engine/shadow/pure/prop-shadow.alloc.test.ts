// Projecting props must not allocate: a moving prop is re-projected every frame, and the garbage
// collector's pauses show up as dropped frames on a headset. Cycles box, sphere and cylinder with a
// moving light and checks the heap, as frame-pipeline.alloc.test.ts does for the hand pipeline.
// Needs `--expose-gc` (vitest.config.ts sets it); skipped without it.
import { describe, expect, it } from 'vitest';
import { bytesPerFrame, gc, inCI } from '../../sim/alloc-measure';
import { createSilhouette, projectProp, type Prop } from './prop-shadow';
import { createStagePlane } from './stage-plane';

const FRAMES = 3_000;
const BUDGET_BYTES_PER_FRAME = 64;

function makeStep(extra?: () => void) {
  const stage = createStagePlane();
  stage.origin.set([0, 0, -2]);
  const props: Prop[] = [
    { shape: 'box', position: [0, 0, -1], size: [0.2, 0.3, 0.1], rotation: [0.2, 0.3, 0.1, 0.9273618] },
    { shape: 'sphere', position: [0.2, 0, -1], size: [0.1], rotation: [0, 0, 0, 1] },
    { shape: 'cylinder', position: [-0.2, 0, -1], size: [0.1, 0.3], rotation: [0.3, 0.1, 0.2, 0.9273618] },
  ];
  const light = new Float64Array(3);
  const out = createSilhouette();
  let frame = 0;
  return () => {
    light[0] = Math.sin(frame * 0.01) * 0.1;
    light[1] = 0.05;
    projectProp(props[frame % 3], light, stage, 0.65, out);
    extra?.();
    frame++;
  };
}

it('has garbage collection exposed when running in CI', () => {
  expect(gc !== undefined || !inCI).toBe(true);
});

describe.skipIf(!gc)('prop shadow allocation', () => {
  it('projecting a box, a sphere and a cylinder stays under the allocation budget', () => {
    const bytes = bytesPerFrame(makeStep(), {
      frames: FRAMES,
      warmup: 200000,
      attempts: 6,
      goodBelow: BUDGET_BYTES_PER_FRAME / 2,
    });
    console.info(`projectProp allocates ${bytes.toFixed(1)} B a frame`);
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
