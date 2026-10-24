// The whole frame, with the stages that touch engine objects added to the pure pipeline: the shadow renderer's uniform
// packing, the prop shadows' update and the game audio's shape-event handling. None may allocate: the garbage
// collector's pauses show up as dropped frames on a headset. Needs `--expose-gc` (vitest.config.ts sets it).
import { describe, expect, it } from 'vitest';
import { GameAudio, type SoundPlayer } from '../services/audio/game-audio';
import { gc, makePipeline, measure } from './pure/frame-pipeline-fixture';
import { PropShadowView } from './prop-shadow-view';
import { ShadowRenderer } from './shadow-renderer';

const FRAMES = 3_000;
/** The pure pipeline alone measures about 480 B a frame and the whole frame about 600 B (boxed doubles, no objects or arrays): 1.5 times the latter. */
const WHOLE_FRAME_BUDGET_BYTES_PER_FRAME = 900;

function wholeFrame(extra?: () => void) {
  const silent: SoundPlayer = { playAt: () => true, setLoop: () => undefined, moveLoop: () => undefined };
  const audio = new GameAudio(silent);
  const renderer = new ShadowRenderer();
  const props = new PropShadowView();
  const flame = [0, 0.65, -0.2];
  let tick = 0;
  return makePipeline((p) => {
    audio.onShapeEvents(p.shapes.events, p.projector.shadows, p.stage);
    audio.setFlame(true, flame);
    renderer.update(p.projector.shadows, p.stage, p.sharpen.look, 1);
    props.update(p.stage, 0.5 + (tick++ % 10) * 0.05);
    extra?.();
  });
}

describe.skipIf(!gc)('whole frame allocation', () => {
  it('the shadow renderer, the prop shadows and the game audio stay under the allocation budget', () => {
    const { heapBytes } = measure(wholeFrame(), FRAMES);
    console.info(`whole frame allocates ${(heapBytes / FRAMES).toFixed(0)} B a frame`);
    expect(heapBytes / FRAMES).toBeLessThan(WHOLE_FRAME_BUDGET_BYTES_PER_FRAME);
  }, 60_000);

  it('catches a stage that allocates and throws it away (a control for the test itself)', () => {
    const { heapBytes } = measure(
      wholeFrame(() => void new Array(256).fill(0.5)), // about 2 KB of garbage a frame, never retained
      FRAMES,
    );
    expect(heapBytes / FRAMES).toBeGreaterThan(WHOLE_FRAME_BUDGET_BYTES_PER_FRAME);
  }, 60_000);
});
