// AudioEngine.update and moveLoop run every frame, so they must not allocate (see frame-pipeline.alloc.test.ts
// for why). Needs `--expose-gc` (vitest.config.ts sets it).
import { describe, expect, it } from 'vitest';
import { bytesPerFrame, gc, inCI } from '../../testing/alloc-measure';
import { FakeContext } from './fake-audio';
import { Bus, Mixer } from './mixer';
import { Sound } from './sounds';
import { AudioEngine } from './web-audio-engine';

const FRAMES = 3_000;
const BUDGET_BYTES_PER_FRAME = 64;

function makeStep(extra?: () => void) {
  const mixer = new Mixer();
  const ctx = new FakeContext();
  const engine = new AudioEngine({ mixer, contextFactory: () => ctx as unknown as AudioContext });
  engine.unlock();
  engine.setLoop(Sound.Crackle, true, 0, 1, 0);
  // A head that turns and sways and a flame that flickers sideways, worked out beforehand, as the game does by
  // reading the camera's matrix into one typed array.
  const N = 628;
  const poses = Array.from({ length: N }, (_, i) =>
    Float64Array.of(Math.sin(i * 0.01) * 0.05, 1.2, 0.3, Math.sin(i * 0.01), 0, -Math.cos(i * 0.01), 0, 1, 0),
  );
  const flicker = new Float64Array(N);
  for (let i = 0; i < N; i++) flicker[i] = Math.sin(i * 0.03) * 0.01;
  let frame = 0;
  return () => {
    const i = frame % N;
    engine.update(poses[i]);
    engine.setPaused(frame % 1000 > 990);
    engine.moveLoop(Sound.Crackle, flicker[i], 0.9, 0);
    if (frame % 200 === 0) mixer.setVolume(Bus.Effects, (frame % 400) / 400);
    extra?.();
    frame++;
  };
}

it('has garbage collection exposed when running in CI', () => {
  expect(gc !== undefined || !inCI).toBe(true);
});

describe.skipIf(!gc)('audio engine allocation', () => {
  it('stays under the allocation budget', () => {
    const bytes = bytesPerFrame(makeStep(), { frames: FRAMES, goodBelow: BUDGET_BYTES_PER_FRAME / 2 });
    console.info(`audio engine allocates ${bytes.toFixed(1)} B a frame`);
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
