// The whole frame, with the stages that touch engine objects added to the pure pipeline: the shadow renderer's uniform
// packing, the prop shadows' update, the game audio's shape-event handling, the kindred and its sparkles, the glows and
// the air (shaft and dust). None may allocate: the garbage
// collector's pauses show up as dropped frames on a headset. Needs `--expose-gc` (vitest.config.ts sets it).
import { describe, expect, it } from 'vitest';
import { GameAudio, type SoundPlayer } from '../services/audio/game-audio';
import { gc, makePipeline, measure } from './pure/frame-pipeline-fixture';
import { AirView } from './air-view';
import { Hopper } from './pure/hopper';
import { Follower, nearMissLevel, SolveBloom } from './pure/glow';
import { Kindred, shadowSpot } from './pure/kindred';
import { createSparkleOut, Sparkles } from './pure/sparkles';
import { PropShadowView } from './prop-shadow-view';
import { ShadowRenderer } from './shadow-renderer';

const FRAMES = 3_000;
/** The pure pipeline alone measures about 480 B a frame and the whole frame about 820 B with the kindred, sparkles, glows and air (boxed doubles, no objects or arrays): 1.5 times the latter. */
const WHOLE_FRAME_BUDGET_BYTES_PER_FRAME = 1200;

function wholeFrame(extra?: () => void) {
  const silent: SoundPlayer = { playAt: () => true, setLoop: () => undefined, moveLoop: () => undefined };
  const audio = new GameAudio(silent);
  const renderer = new ShadowRenderer();
  const props = new PropShadowView();
  const flame = [0, 0.65, -0.2];
  const air = new AirView();
  const kindred = new Kindred(3);
  const sparkles = new Sparkles(5);
  const motes = createSparkleOut();
  const bloom = new SolveBloom();
  const hopper = new Hopper();
  const near = new Follower();
  const spot = new Float64Array(2);
  let tick = 0;
  return makePipeline((p) => {
    audio.onShapeEvents(p.shapes.events, p.projector.shadows, p.stage);
    audio.setFlame(true, flame);
    renderer.update(p.projector.shadows, p.stage, p.sharpen.look, 1);
    props.update(p.stage, 0.5 + (tick++ % 10) * 0.05);
    kindred.update(1 / 72, p.stage.width / 2, p.stage.height / 2, 0, 0, true);
    if (tick % 200 === 0) sparkles.burst(kindred.x, kindred.y, 12);
    sparkles.update(1 / 72, kindred.x, kindred.y, 30);
    sparkles.fill(motes);
    if (tick % 400 === 0) bloom.trigger();
    if (tick % 300 === 0) hopper.spawn(0, 0, 1);
    hopper.update(1 / 72, 0.8);
    bloom.update(1 / 72);
    near.update(nearMissLevel(-0.3 + 0.4 * Math.sin(tick * 0.05)), 1 / 72);
    shadowSpot(p.stage, 0, 0.65, 0.5, 0.05, 0.4, 0.2, spot);
    air.update(p.stage, flame, 0.9, 1 / 72, true);
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
