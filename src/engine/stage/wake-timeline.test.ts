import { describe, expect, it } from 'vitest';
import { WAKE_SCRIPT, WakeTimeline, sampleKeys, wakeDuration } from './wake-timeline';

describe('sampleKeys', () => {
  const keys = [
    { t: 1, v: 0 },
    { t: 3, v: 1 },
  ];
  it('holds before the first point and after the last, and eases between', () => {
    expect(sampleKeys(keys, 0)).toBe(0);
    expect(sampleKeys(keys, 2)).toBeCloseTo(0.5);
    expect(sampleKeys(keys, 1.5)).toBeLessThan(0.25); // eased, not linear
    expect(sampleKeys(keys, 9)).toBe(1);
    expect(sampleKeys([], 1)).toBe(0);
  });
});

describe('WAKE_SCRIPT', () => {
  it('has its points in time order', () => {
    for (const keys of [WAKE_SCRIPT.textKeys, WAKE_SCRIPT.lidKeys])
      for (let i = 1; i < keys.length; i++) expect(keys[i].t).toBeGreaterThanOrEqual(keys[i - 1].t);
  });

  it('starts black and silent, shows the word while the eyes are still shut, and ends with the eyes open', () => {
    const lid = WAKE_SCRIPT.lidKeys;
    expect(lid[0].v).toBe(0);
    expect(lid[lid.length - 1].v).toBe(1);
    expect(WAKE_SCRIPT.textKeys[0].v).toBe(0);
    // Wherever the word shows, the eyes are shut.
    for (let t = 0; t < wakeDuration(WAKE_SCRIPT); t += 0.05)
      if (sampleKeys(WAKE_SCRIPT.textKeys, t) > 0.01) expect(sampleKeys(lid, t)).toBe(0);
  });

  it('blinks: the eyes open and close at least twice before they stay open', () => {
    let opens = 0;
    let wasOpen = false;
    for (let t = 0; t <= wakeDuration(WAKE_SCRIPT); t += 0.02) {
      const open = sampleKeys(WAKE_SCRIPT.lidKeys, t) > 0.15;
      if (open && !wasOpen) opens++;
      wasOpen = open;
    }
    expect(opens).toBeGreaterThanOrEqual(3);
  });
});

describe('WakeTimeline', () => {
  it('is open and wordless until started, then plays to the end once', () => {
    const w = new WakeTimeline();
    expect(w.playing).toBe(false);
    expect(w.lid).toBe(1);
    expect(w.text).toBe(0);
    w.start();
    expect(w.playing).toBe(true);
    expect(w.lid).toBe(0);
    let finished = 0;
    for (let i = 0; i < 2000; i++) if (w.update(1 / 72)) finished++;
    expect(finished).toBe(1);
    expect(w.playing).toBe(false);
    expect(w.lid).toBe(1);
  });

  it('can be skipped to the end', () => {
    const w = new WakeTimeline();
    w.start();
    w.update(2);
    w.finish();
    expect(w.playing).toBe(false);
    expect(w.lid).toBe(1);
    expect(w.text).toBe(0);
  });
});
