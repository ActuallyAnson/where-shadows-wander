import { describe, expect, it } from 'vitest';
import { writeCoverHand } from './cover-hand';
import { createHandFrame, derivePalm, JOINT } from './hand';

describe('writeCoverHand', () => {
  it('centres the palm over the flame, facing down', () => {
    const hand = writeCoverHand([1, 0.8, -2], 0.1, 0, -1, createHandFrame('right'));
    const palm = derivePalm(hand)!;
    expect(palm.position[0]).toBeCloseTo(1);
    expect(palm.position[1]).toBeCloseTo(0.9);
    expect(palm.position[2]).toBeCloseTo(-2);
    expect(palm.normal[1]).toBeLessThan(-0.9);
  });

  it('points the fingers the way asked', () => {
    for (const [dx, dz] of [
      [0, -1],
      [1, 0],
      [-0.6, 0.8],
    ]) {
      const hand = writeCoverHand([0, 0, 0], 0.1, dx * 3, dz * 3, createHandFrame('right'));
      const palm = derivePalm(hand)!;
      expect(palm.forward[0]).toBeCloseTo(dx, 1);
      expect(palm.forward[2]).toBeCloseTo(dz, 1);
      // A right hand: its thumb is to the left of the fingers' direction (seen from above, palm down).
      const p = hand.positions;
      const t = JOINT['thumb-tip'] * 3;
      const left = [dz, -dx]; // the fingers' direction turned a quarter to the left
      expect((p[t] - palm.position[0]) * left[0] + (p[t + 2] - palm.position[2]) * left[1]).toBeGreaterThan(0);
    }
  });
});
