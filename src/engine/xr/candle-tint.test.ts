import { describe, expect, it } from 'vitest';
import { LIT_RADIUS_M, litAmount } from './candle-tint';

describe('litAmount', () => {
  it('is 1 at the flame, 0 at and beyond the radius, linear between', () => {
    expect(litAmount(1, 2, 3, 1, 2, 3)).toBe(1);
    expect(litAmount(0, 0, 0, LIT_RADIUS_M, 0, 0)).toBe(0);
    expect(litAmount(0, 0, 0, 5, 5, 5)).toBe(0);
    expect(litAmount(0, 0, 0, 0, LIT_RADIUS_M / 2, 0)).toBeCloseTo(0.5, 12);
  });

  it('uses 3D distance', () => {
    const d = LIT_RADIUS_M / 2 / Math.sqrt(3);
    expect(litAmount(0, 0, 0, d, d, d)).toBeCloseTo(0.5, 12);
  });
});
