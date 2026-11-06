import { describe, expect, it } from 'vitest';
import { FADE_IN_S, FADE_OUT_S, NEAR_HIDE_M, NEAR_SHOW_M, nearFade, stepFade } from './hand-fade';

describe('stepFade', () => {
  it('rises to 1 in FADE_IN_S and stops there', () => {
    let v = 0;
    for (let i = 0; i < 9; i++) v = stepFade(v, true, FADE_IN_S / 10);
    expect(v).toBeCloseTo(0.9, 6);
    expect(stepFade(v, true, 10)).toBe(1);
  });

  it('falls to 0 in FADE_OUT_S, slower than it rises, and stops there', () => {
    expect(stepFade(1, false, FADE_OUT_S / 2)).toBeCloseTo(0.5, 6);
    expect(stepFade(1, false, 10)).toBe(0);
    expect(FADE_OUT_S).toBeGreaterThan(FADE_IN_S);
  });

  it('does not blink on a one-frame dropout', () => {
    const after = stepFade(1, false, 1 / 72);
    expect(after).toBeGreaterThan(0.95);
    expect(stepFade(after, true, 1 / 72)).toBe(1);
  });
});

describe('nearFade', () => {
  it('hides a hand right at the eyes, shows it whole at arm distance, and eases between', () => {
    expect(nearFade(0.05)).toBe(0);
    expect(nearFade(NEAR_HIDE_M)).toBe(0);
    expect(nearFade(NEAR_SHOW_M)).toBe(1);
    expect(nearFade(0.6)).toBe(1);
    const mid = nearFade((NEAR_HIDE_M + NEAR_SHOW_M) / 2);
    expect(mid).toBeGreaterThan(0.4);
    expect(mid).toBeLessThan(0.6);
    let last = -1;
    for (let d = 0; d < 0.6; d += 0.01) {
      expect(nearFade(d)).toBeGreaterThanOrEqual(last);
      last = nearFade(d);
    }
  });
});
