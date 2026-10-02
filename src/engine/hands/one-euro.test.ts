import { describe, expect, it } from 'vitest';
import { OneEuroFilter } from './one-euro';
import { seededRandom } from './synthetic-hand';

const DT = 1 / 24; // a webcam's frame interval

describe('one euro filter', () => {
  it('passes the first input through unchanged', () => {
    const f = new OneEuroFilter(3);
    expect([...f.filter([1, 2, 3], DT)]).toEqual([1, 2, 3]);
  });

  it('removes most jitter from a still input', () => {
    const f = new OneEuroFilter(1);
    const random = seededRandom(3);
    let rawErr = 0,
      outErr = 0;
    for (let i = 0; i < 240; i++) {
      const noise = (random() - 0.5) * 0.01; // ±5 mm
      const out = f.filter([0.5 + noise], DT)[0];
      if (i > 24) {
        rawErr += Math.abs(noise);
        outErr += Math.abs(out - 0.5);
      }
    }
    expect(outErr).toBeLessThan(rawErr * 0.35);
  });

  it('follows a fast move with little lag', () => {
    const f = new OneEuroFilter(1);
    // 0.5 m/s for half a second.
    let out = 0;
    for (let i = 0; i <= 12; i++) out = f.filter([0.5 * i * DT], DT)[0];
    const target = 0.5 * 12 * DT;
    expect(target - out).toBeLessThan(0.02); // within 2 cm of a 25 cm move
  });

  it('starts over after a reset', () => {
    const f = new OneEuroFilter(1);
    f.filter([0], DT);
    f.reset();
    expect(f.filter([1], DT)[0]).toBe(1);
  });
});
