import { describe, expect, it } from 'vitest';
import { FixedStepLoop } from './fixed-step';

describe('FixedStepLoop', () => {
  it('steps at the fixed rate regardless of display rate', () => {
    for (const displayHz of [72, 90, 120]) {
      const loop = new FixedStepLoop(60, () => {});
      for (let i = 0; i < displayHz * 10; i++) loop.advance(1 / displayHz);
      expect(Math.abs(loop.steps - 600)).toBeLessThanOrEqual(1);
    }
  });

  it('returns an interpolation factor in [0, 1)', () => {
    const loop = new FixedStepLoop(50, () => {});
    expect(loop.advance(0.03)).toBeCloseTo(0.5, 5);
  });

  it('caps a long stall instead of spiralling', () => {
    const loop = new FixedStepLoop(60, () => {});
    loop.advance(5);
    expect(loop.steps).toBe(15);
  });
});
