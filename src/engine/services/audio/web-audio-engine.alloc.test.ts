// AudioEngine.update and moveLoop run every frame, so they must not allocate (see frame-pipeline.alloc.test.ts
// for why). Needs `--expose-gc` (vitest.config.ts sets it).
import { describe, expect, it } from 'vitest';
import { FakeContext } from './fake-audio';
import { Bus, Mixer } from './mixer';
import { Sound } from './sounds';
import { AudioEngine } from './web-audio-engine';

const node = globalThis as unknown as {
  gc?: () => void;
  process: { memoryUsage(): { heapUsed: number }; env: Record<string, string | undefined> };
};
const gc = node.gc;
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

function measure(step: () => void, frames: number): number {
  for (let i = 0; i < 60000; i++) step();
  gc!();
  const before = node.process.memoryUsage().heapUsed;
  let last = before;
  for (let i = 0; i < frames; i++) {
    step();
    if (i % 100 === 99) {
      const now = node.process.memoryUsage().heapUsed;
      if (now < last)
        throw new Error(`a collection ran at frame ${i}: the young generation is too small for this window`);
      last = now;
    }
  }
  return node.process.memoryUsage().heapUsed - before;
}

it('has garbage collection exposed when running in CI', () => {
  expect(gc !== undefined || !node.process.env.CI).toBe(true);
});

describe.skipIf(!gc)('audio engine allocation', () => {
  it('stays under the allocation budget', () => {
    const bytes = measure(makeStep(), FRAMES);
    console.info(`audio engine allocates ${(bytes / FRAMES).toFixed(1)} B a frame`);
    expect(bytes / FRAMES).toBeLessThan(BUDGET_BYTES_PER_FRAME);
  });

  it('catches a step that allocates and throws it away (a control for the test itself)', () => {
    const bytes = measure(
      makeStep(() => void new Array(64).fill(0.5)),
      FRAMES,
    );
    expect(bytes / FRAMES).toBeGreaterThan(BUDGET_BYTES_PER_FRAME);
  });
});
