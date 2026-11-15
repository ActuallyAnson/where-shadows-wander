import { describe, expect, it } from 'vitest';
import {
  HUM_S,
  MUSIC_RATE,
  MUSIC_S,
  prewarmMusic,
  renderPlaceholder,
  renderRateFor,
  takeSamples,
  THUNDER_S,
} from './placeholder-sounds';
import { Sound, SOUND_COUNT, SOUND_DEFS, type SoundId } from './sounds';

const SR = 48000;
const all = Array.from({ length: SOUND_COUNT }, (_, i) => i as SoundId);

describe('renderPlaceholder', () => {
  it.each(all)(
    'sound %i has finite samples peaking at its level (0.8; the loops lower), and is the same every time',
    (id) => {
      const rate = renderRateFor(id, SR);
      const a = renderPlaceholder(id, rate);
      const b = renderPlaceholder(id, rate);
      const peaks: Partial<Record<number, number>> = {
        [Sound.Crackle]: 0.35,
        [Sound.Hum]: 0.3,
        [Sound.Music]: 0.5,
        [Sound.Clock]: 0.5,
        [Sound.Wind]: 0.35,
        [Sound.Creak]: 0.7,
        [Sound.Snowtick]: 0.6,
        [Sound.Step0]: 0.6,
        [Sound.Step1]: 0.6,
        [Sound.Rain]: 0.35,
      };
      const peak = peaks[id] ?? 0.8;
      expect(a.length).toBeGreaterThan(rate * 0.05);
      expect(a.every((x) => Number.isFinite(x))).toBe(true);
      expect(a.reduce((m, v) => Math.max(m, Math.abs(v)), 0)).toBeCloseTo(peak, 5);
      expect(Array.from(a)).toEqual(Array.from(b));
    },
  );

  it('keeps each sound short enough for a one-shot, and the candle loop at six seconds', () => {
    expect(renderPlaceholder(Sound.Rustle, SR).length / SR).toBeLessThan(0.5);
    expect(renderPlaceholder(Sound.Thump, SR).length / SR).toBeLessThan(0.5);
    expect(renderPlaceholder(Sound.Chime, SR).length / SR).toBeLessThan(2);
    expect(renderPlaceholder(Sound.Crackle, SR).length / SR).toBe(6);
  });

  it('keeps every one-shot under two seconds (but the thunder, a long roll), and each loop at six seconds or less (the music, at its low rate, at 24)', () => {
    for (let id = 0; id < SOUND_COUNT; id++) {
      const rate = renderRateFor(id as SoundId, SR);
      const s = renderPlaceholder(id as SoundId, rate).length / rate;
      if (id === Sound.Music) expect(s).toBe(MUSIC_S);
      else if (id === Sound.Thunder) expect(s).toBe(THUNDER_S);
      else if (SOUND_DEFS[id].loop) expect(s).toBeLessThanOrEqual(6);
      else expect(s).toBeLessThan(2);
    }
  });

  it('keeps the candle soft: quiet, and no sharp jump from one sample to the next', () => {
    const c = renderPlaceholder(Sound.Crackle, SR);
    let jump = 0;
    let sq = 0;
    for (let i = 1; i < c.length; i++) {
      jump = Math.max(jump, Math.abs(c[i] - c[i - 1]));
      sq += c[i] * c[i];
    }
    expect(jump).toBeLessThan(0.04);
    expect(Math.sqrt(sq / c.length)).toBeLessThan(0.1);
  });

  it('ends each one-shot at exactly zero, so it does not click', () => {
    for (let id = 0; id < SOUND_COUNT; id++) {
      if (SOUND_DEFS[id].loop) continue;
      const s = renderPlaceholder(id as SoundId, SR);
      expect(Math.abs(s[s.length - 1])).toBe(0);
    }
  });

  it('joins the room tone, the music and the rain at their loop point with no jump', () => {
    for (const [id, rate, ceiling] of [
      [Sound.Hum, SR, 0.01],
      [Sound.Music, MUSIC_RATE, 0.02],
      [Sound.Rain, SR, 0.05],
    ] as const) {
      const s = renderPlaceholder(id, rate);
      // The step across the join must be no bigger than the biggest step anywhere else in the loop.
      let worst = 0;
      for (let i = 1; i < s.length; i++) worst = Math.max(worst, Math.abs(s[i] - s[i - 1]));
      const seam = Math.abs(s[0] - s[s.length - 1]);
      expect(seam).toBeLessThanOrEqual(Math.max(worst, ceiling));
    }
  });

  it('has the room tone at six seconds and the music with no sample past 0.5', () => {
    expect(renderPlaceholder(Sound.Hum, SR).length / SR).toBe(HUM_S);
    const m = renderPlaceholder(Sound.Music, MUSIC_RATE);
    expect(m.length).toBe(MUSIC_S * MUSIC_RATE);
  });

  it('renders the music ahead of time and hands that over once, at its own rate only', () => {
    prewarmMusic();
    prewarmMusic(); // twice is fine
    const first = takeSamples(Sound.Music, MUSIC_RATE);
    expect(first.length).toBe(MUSIC_S * MUSIC_RATE);
    const second = takeSamples(Sound.Music, MUSIC_RATE); // rendered fresh: nothing was kept
    expect(second).not.toBe(first);
    expect(Array.from(second.slice(0, 200))).toEqual(Array.from(first.slice(0, 200)));
    prewarmMusic();
    expect(takeSamples(Sound.Music, 48000)).not.toHaveLength(0); // another rate is rendered for that rate, not handed the stored one
  }, 30000); // three renders of 24 s of music: slow on a busy machine

  it('renders the music at a low rate however fast the context runs, and everything else at the context’s', () => {
    expect(renderRateFor(Sound.Music, 48000)).toBe(MUSIC_RATE);
    expect(renderRateFor(Sound.Music, 16000)).toBe(16000);
    expect(renderRateFor(Sound.Chime, 48000)).toBe(48000);
  });

  it('starts and ends the loop silent, so it joins without a click', () => {
    const c = renderPlaceholder(Sound.Crackle, SR);
    expect(Math.abs(c[0])).toBeLessThan(1e-3);
    expect(Math.abs(c[c.length - 1])).toBeLessThan(1e-3);
  });

  it('dies away: the last tenth of a one-shot is much quieter than the first', () => {
    for (const id of [Sound.Rustle, Sound.Thump, Sound.Chime, Sound.Tick, Sound.Press, Sound.Lost] as const) {
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

describe('the wind loop', () => {
  it('runs on from its end into its start with no dip to silence', () => {
    const sr = 22050;
    const w = renderPlaceholder(Sound.Wind, sr);
    let step = 0;
    for (let i = 1; i < w.length; i++) step = Math.max(step, Math.abs(w[i] - w[i - 1]));
    const seam = Math.abs(w[0] - w[w.length - 1]);
    expect(seam).toBeLessThan(step * 3);
    let level = 0;
    for (let i = 0; i < sr * 0.05; i++) level += Math.abs(w[i]);
    let mid = 0;
    for (let i = 0; i < sr * 0.05; i++) mid += Math.abs(w[Math.floor(w.length / 2) + i]);
    expect(level).toBeGreaterThan(mid * 0.2); // the first 50 ms are not faded to nothing
  });
});
