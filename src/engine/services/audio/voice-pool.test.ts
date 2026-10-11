import { describe, expect, it } from 'vitest';
import { VoicePool } from './voice-pool';

describe('VoicePool', () => {
  it('hands out free voices in order and counts them', () => {
    const p = new VoicePool(3);
    expect([p.acquire(1, 0), p.acquire(1, 0), p.acquire(1, 0)]).toEqual([0, 1, 2]);
    expect(p.active).toBe(3);
  });

  it('reuses a released voice', () => {
    const p = new VoicePool(2);
    p.acquire(1, 0);
    p.acquire(1, 0);
    p.release(0);
    expect(p.isBusy(0)).toBe(false);
    expect(p.acquire(1, 1)).toBe(0);
  });

  it('when full, takes the oldest of the least important voices if it is no more important than the new sound', () => {
    const p = new VoicePool(3);
    p.acquire(2, 0); // 0: important
    p.acquire(1, 1); // 1: less important, older
    p.acquire(1, 2); // 2: less important, newer
    expect(p.acquire(1, 3)).toBe(1);
    expect(p.stolen).toBe(1);
    expect(p.acquire(3, 4)).toBe(2);
  });

  it('drops a new sound that is less important than everything playing', () => {
    const p = new VoicePool(2);
    p.acquire(3, 0);
    p.acquire(3, 0);
    expect(p.acquire(1, 1)).toBe(-1);
    expect(p.dropped).toBe(1);
    expect(p.active).toBe(2);
  });

  it('releasing a free voice changes nothing', () => {
    const p = new VoicePool(1);
    p.release(0);
    expect(p.active).toBe(0);
  });
});
