import { describe, expect, it } from 'vitest';
import { GOODBYE_MOON_PEAK, goodbyeMoon } from './goodbye-moon';
import { GIRL_GO_LEN_S, GIRL_GO_S, GOODBYE_LENGTH_S } from './goodbye';
import { STORY_CHAPTER } from './story-stage';

const start = STORY_CHAPTER.goodbye.start;

describe('goodbyeMoon', () => {
  it('is the night moon outside scene 6, and with no memory showing', () => {
    expect(goodbyeMoon(null)).toBe(1);
    expect(goodbyeMoon(NaN)).toBe(1);
    expect(goodbyeMoon(0)).toBe(1);
    expect(goodbyeMoon(start - 1)).toBe(1);
    expect(goodbyeMoon(start)).toBe(1); // waiting for the palms to meet
    expect(goodbyeMoon(start + GOODBYE_LENGTH_S)).toBe(1);
  });

  it('brightens slowly from the touch, stays while the hands are together, and settles back as she fades', () => {
    expect(goodbyeMoon(start + 0.5)).toBeGreaterThan(1);
    expect(goodbyeMoon(start + 0.5)).toBeLessThan(1.2);
    expect(goodbyeMoon(start + GIRL_GO_S)).toBeCloseTo(GOODBYE_MOON_PEAK, 6);
    const halfGone = goodbyeMoon(start + GIRL_GO_S + GIRL_GO_LEN_S / 2);
    expect(halfGone).toBeGreaterThan(1.2);
    expect(halfGone).toBeLessThan(GOODBYE_MOON_PEAK);
    let last = Infinity;
    for (let t = GIRL_GO_S; t <= GIRL_GO_S + GIRL_GO_LEN_S; t += 0.1) {
      const k = goodbyeMoon(start + t);
      expect(k).toBeLessThanOrEqual(last + 1e-9);
      last = k;
    }
    expect(goodbyeMoon(start + GIRL_GO_S + GIRL_GO_LEN_S - 1e-6)).toBeCloseTo(1, 4);
  });
});
