// Times the new pure parts (`npm run perf`): the Verlet rope behind the bunting and the quality governor.
// Both run every frame on the headset, so they should stay far under a tenth of a millisecond.
import { bench, describe } from 'vitest';
import { QualityGovernor } from './quality-governor';
import { VerletChain } from './verlet-chain';

describe('verlet rope', () => {
  const chain = new VerletChain(9, -0.7, 1.9, 0.7, 1.9, 1.7);
  bench('one frame of a rope in a fan wind (1/72 s)', () => {
    chain.advance(1 / 72, 9.8, 34);
  });
  bench('one frame of a rope in calm air', () => {
    chain.advance(1 / 72, 9.8, 4);
  });
});

describe('quality governor', () => {
  const governor = new QualityGovernor();
  let frame = 0;
  bench('one frame of the governor', () => {
    governor.update(12 + (frame++ % 7));
  });
});
