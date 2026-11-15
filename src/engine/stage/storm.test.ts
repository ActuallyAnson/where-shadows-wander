import { describe, expect, it } from 'vitest';
import { STORM, Storm } from './storm';

/** Runs `seconds` at 72 fps; returns when each flash began and each thunder fired, and the brightest flash. */
function run(storm: Storm, seconds: number) {
  const flashes: number[] = [];
  const thunders: number[] = [];
  let peak = 0;
  let was = 0;
  const dt = 1 / 72;
  for (let i = 0; i * dt < seconds; i++) {
    storm.update(dt);
    const f = storm.flash;
    if (f > 0 && was === 0) flashes.push(i * dt);
    if (storm.thunder) thunders.push(i * dt);
    peak = Math.max(peak, f);
    was = f;
  }
  return { flashes, thunders, peak };
}

describe('Storm', () => {
  it('is quiet before the first strike, then flashes and, a few seconds later, thunders', () => {
    const { flashes, thunders, peak } = run(new Storm(3), 600);
    expect(flashes[0]).toBeGreaterThanOrEqual(STORM.firstS - 0.1);
    expect(flashes.length).toBeGreaterThanOrEqual(600 / STORM.gapMaxS - 1);
    expect(flashes.length).toBeLessThanOrEqual(600 / STORM.gapMinS + 1);
    expect(thunders.length).toBeGreaterThanOrEqual(flashes.length - 1);
    for (let i = 0; i < thunders.length; i++) {
      const delay = thunders[i] - flashes[i];
      expect(delay).toBeGreaterThanOrEqual(STORM.delayMinS - 0.05);
      expect(delay).toBeLessThanOrEqual(STORM.delayMaxS + 0.05);
    }
    expect(peak).toBeGreaterThan(0.2);
    expect(peak).toBeLessThanOrEqual(1);
  });

  it('repeats exactly for the same seed', () => {
    expect(run(new Storm(7), 300)).toEqual(run(new Storm(7), 300));
  });

  it('holds still for a zero, negative or NaN step, and stays sane for a huge one', () => {
    const s = new Storm();
    for (const dt of [0, -1, NaN]) {
      s.update(dt);
      expect(s.flash).toBe(0);
      expect(s.thunder).toBe(false);
    }
    s.update(1e9);
    expect(Number.isFinite(s.flash)).toBe(true);
  });

  it('strikes on the next update when asked', () => {
    const s = new Storm();
    s.update(1);
    s.strikeNow();
    s.update(0.05);
    expect(s.flash).toBeGreaterThan(0);
  });

  it('strikes now with the thunder and the brightness asked for, then goes back to its own', () => {
    const s = new Storm(9);
    s.update(1);
    s.strikeNow(1.5, 1);
    s.update(1 / 72);
    expect(s.lastStrength).toBe(1);
    let after = 0;
    while (!s.thunder && after < 10) {
      s.update(1 / 72);
      after += 1 / 72;
    }
    expect(after).toBeCloseTo(1.5, 1);
  });

  it('reports thunder on one update only', () => {
    const s = new Storm(5);
    let count = 0;
    for (let i = 0; i < 72 * (STORM.firstS + STORM.delayMaxS + 1); i++) {
      s.update(1 / 72);
      if (s.thunder) count++;
    }
    expect(count).toBe(1);
  });
});
