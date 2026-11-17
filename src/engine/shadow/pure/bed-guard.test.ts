import { describe, expect, it } from 'vitest';
import { RISE_BLACK_M, STRAY_BLACK_M, STRAY_START_M, strayDarkness } from './bed-guard';

describe('strayDarkness', () => {
  it('is clear while seated, with a little sway', () => {
    expect(strayDarkness(1, 1.2, 1, 1, 1.2, 1)).toBe(0);
    expect(strayDarkness(1.2, 1.25, 0.9, 1, 1.2, 1)).toBe(0);
  });
  it('darkens as the head leaves the bed spot, to black', () => {
    const mid = strayDarkness((STRAY_START_M + STRAY_BLACK_M) / 2, 1.2, 0, 0, 1.2, 0);
    expect(mid).toBeGreaterThan(0.3);
    expect(mid).toBeLessThan(0.7);
    expect(strayDarkness(STRAY_BLACK_M, 1.2, 0, 0, 1.2, 0)).toBe(1);
    expect(strayDarkness(0, 1.2, -3, 0, 1.2, 0)).toBe(1);
  });
  it('goes black when standing up, but not when leaning down', () => {
    expect(strayDarkness(0, 1.2 + RISE_BLACK_M, 0, 0, 1.2, 0)).toBe(1);
    expect(strayDarkness(0, 0.9, 0, 0, 1.2, 0)).toBe(0);
  });
  it('ignores a head pose that is not finite', () => {
    expect(strayDarkness(NaN, 1.2, 0, 0, 1.2, 0)).toBe(0);
  });
});
