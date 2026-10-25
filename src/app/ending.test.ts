import { describe, expect, it } from 'vitest';
import { validateCutscene } from '../engine/sim/cutscene';
import { ENDING, ENDING_MOOD } from './ending';

describe('ending', () => {
  it('is a playable cutscene with at most four beats on at once', () => {
    expect(validateCutscene(ENDING)).toEqual([]);
    for (let t = 0; t < 16; t += 0.1) {
      const on = ENDING.beats.filter((b) => t >= b.at && t <= b.at + b.duration).length;
      expect(on).toBeLessThanOrEqual(4);
    }
  });

  it('settles the room dim but not dark', () => {
    expect(ENDING_MOOD).toBeGreaterThan(0.1);
    expect(ENDING_MOOD).toBeLessThan(0.5);
  });
});
