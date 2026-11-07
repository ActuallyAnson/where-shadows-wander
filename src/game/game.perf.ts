// Times whole game frames (`npm run perf`) in the night's busiest scenes. The sim and gameplay
// together get 2.0 ms a frame on the headset (docs/ARCHITECTURE.md), about 0.5 ms on a desktop.
// game.budget.test.ts checks the same scenes against that budget in CI.
import { bench, describe } from 'vitest';
import { busyScene } from './busy-scenes';

describe('game frame', () => {
  bench('dripping plant: drops, a cup, a roof', busyScene('drip'));
  bench('hanging plant: a long strip of drops, swaying', busyScene('hanging'));
  bench('fan: wind, a windbreak, a fist anchor', busyScene('fan'));
  bench('two fans: two winds, a windbreak, a fist anchor', busyScene('two-fans'));
  bench('castle: the counterweight and a bridge', busyScene('castle'));
});
