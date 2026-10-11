import { describe, expect, it } from 'vitest';
import { renderPlaceholder } from './placeholder-sounds';
import { Sound, SOUND_COUNT, type SoundId } from './sounds';

const SR = 48000;
const all = Array.from({ length: SOUND_COUNT }, (_, i) => i as SoundId);

describe('renderPlaceholder', () => {
  it.each(all)('sound %i has finite samples peaking at 0.8, and is the same every time', (id) => {
    const a = renderPlaceholder(id, SR);
    const b = renderPlaceholder(id, SR);
    expect(a.length).toBeGreaterThan(SR * 0.1);
    expect(a.every((x) => Number.isFinite(x))).toBe(true);
    expect(Math.max(...a.map(Math.abs))).toBeCloseTo(0.8, 5);
    expect(Array.from(a)).toEqual(Array.from(b));
  });

  it('keeps each sound short enough for a one-shot, and the loop at two seconds', () => {
    expect(renderPlaceholder(Sound.Rustle, SR).length / SR).toBeLessThan(0.5);
    expect(renderPlaceholder(Sound.Thump, SR).length / SR).toBeLessThan(0.5);
    expect(renderPlaceholder(Sound.Chime, SR).length / SR).toBeLessThan(2);
    expect(renderPlaceholder(Sound.Crackle, SR).length / SR).toBe(2);
  });

  it('ends each one-shot at exactly zero, so it does not click', () => {
    for (const id of [Sound.Rustle, Sound.Thump, Sound.Chime] as const) {
      const s = renderPlaceholder(id, SR);
      expect(Math.abs(s[s.length - 1])).toBe(0);
    }
  });

  it('starts and ends the loop silent, so it joins without a click', () => {
    const c = renderPlaceholder(Sound.Crackle, SR);
    expect(Math.abs(c[0])).toBeLessThan(1e-3);
    expect(Math.abs(c[c.length - 1])).toBeLessThan(1e-3);
  });

  it('dies away: the last tenth of a one-shot is much quieter than the first', () => {
    for (const id of [Sound.Rustle, Sound.Thump, Sound.Chime] as const) {
      const s = renderPlaceholder(id, SR);
      const tenth = Math.floor(s.length / 10);
      const rms = (from: number) => Math.sqrt(s.slice(from, from + tenth).reduce((t, x) => t + x * x, 0) / tenth);
      expect(rms(s.length - tenth)).toBeLessThan(rms(0) * 0.1);
    }
  });

  it('scales with the sample rate', () => {
    expect(renderPlaceholder(Sound.Chime, 24000).length).toBe(renderPlaceholder(Sound.Chime, 48000).length / 2);
  });
});
