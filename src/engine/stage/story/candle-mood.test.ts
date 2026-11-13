import { describe, expect, it } from 'vitest';
import { CANDLE_MOODS, CandleMoodBlend, START_MOOD } from './candle-mood';

describe('CandleMoodBlend', () => {
  it('opens rainy: a blue light, bluer than the warm one', () => {
    expect(START_MOOD).toBe('rainy');
    const b = new CandleMoodBlend();
    expect(b.light[2]).toBeGreaterThan(b.light[0]);
    expect(b.wall[2]).toBeGreaterThan(b.wall[0]);
    expect(CANDLE_MOODS.warm.light[0]).toBeGreaterThan(CANDLE_MOODS.warm.light[2]);
  });

  it('eases to a new mood over its seconds, smoothly, and stays there', () => {
    const b = new CandleMoodBlend('rainy');
    b.to('warm', 2);
    b.update(1);
    const mid = b.light[0];
    expect(mid).toBeGreaterThan(CANDLE_MOODS.rainy.light[0]);
    expect(mid).toBeLessThan(CANDLE_MOODS.warm.light[0]);
    b.update(1.5);
    expect(Array.from(b.light)).toEqual([...CANDLE_MOODS.warm.light]);
    expect(Array.from(b.wall)).toEqual([...CANDLE_MOODS.warm.wall]);
  });

  it('turning back mid-way starts from where it is, with no jump', () => {
    const b = new CandleMoodBlend('rainy');
    b.to('warm', 2);
    b.update(1);
    const at = b.light[0];
    b.to('rainy', 2);
    expect(b.light[0]).toBe(at);
    b.update(1e-3);
    expect(Math.abs(b.light[0] - at)).toBeLessThan(1e-3);
  });

  it('snaps when given no time', () => {
    const b = new CandleMoodBlend('rainy');
    b.to('warm', 0);
    expect(Array.from(b.light)).toEqual([...CANDLE_MOODS.warm.light]);
  });
});
