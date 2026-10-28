// Frame time in CI: whole game frames in the night's busiest scenes (busy-scenes.ts) must stay
// inside the desktop share of the headset budget. The sim and gameplay get 2.0 ms a frame on the
// headset (docs/ARCHITECTURE.md), about 0.5 ms on a desktop; today's frames take about 0.02 ms, so
// this fails only on a real regression, not on a slow or busy runner. `npm run perf` gives the
// detailed numbers.
import { describe, expect, it } from 'vitest';
import { busyScene, type BusySceneName } from './busy-scenes';

const BUDGET_MS = 0.5;
const FRAMES = 2_000;
const WARMUP = 2_000;
const WINDOWS = 3;

// The project's TypeScript config has no Node types, and pure code may not use `performance`: reach
// Node's clock through globalThis, as alloc-measure.ts does.
const clock = (globalThis as unknown as { process: { hrtime: { bigint(): bigint } } }).process.hrtime;

/** The mean time of a frame in milliseconds: the best of a few windows, so a busy runner's stalls drop out. */
function msPerFrame(frame: () => void): number {
  for (let i = 0; i < WARMUP; i++) frame();
  let best = Infinity;
  for (let w = 0; w < WINDOWS; w++) {
    const start = clock.bigint();
    for (let i = 0; i < FRAMES; i++) frame();
    best = Math.min(best, Number(clock.bigint() - start) / 1e6 / FRAMES);
  }
  return best;
}

describe('game frame time', () => {
  for (const name of ['drip', 'fan', 'castle'] as BusySceneName[]) {
    it(`stays inside the budget in the busiest scene: ${name}`, () => {
      const ms = msPerFrame(busyScene(name));
      console.info(`game frame (${name}): ${(ms * 1000).toFixed(1)} µs`);
      expect(ms).toBeLessThan(BUDGET_MS);
    }, 60_000);
  }
});
