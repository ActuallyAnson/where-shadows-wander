import { describe, expect, it } from 'vitest';
import { Bus } from './mixer';
import { Cooldowns, Sound, SOUND_COUNT, SOUND_DEFS, soundForShapeEvent } from './sounds';

describe('soundForShapeEvent', () => {
  it('is silent when a shape is recognised, when it commits and on cancel', () => {
    expect(soundForShapeEvent('candidate')).toBeNull();
    expect(soundForShapeEvent('commit')).toBeNull();
    expect(soundForShapeEvent('cancel')).toBeNull();
  });

  it('lets go softly, falls low if tracking was lost, and stays quiet when another shape took over', () => {
    expect(soundForShapeEvent('release')).toBe(Sound.Release);
    expect(soundForShapeEvent('release', 'exit')).toBe(Sound.Release);
    expect(soundForShapeEvent('release', 'lost')).toBe(Sound.Lost);
    expect(soundForShapeEvent('release', 'switch')).toBeNull();
  });
});

describe('SOUND_DEFS', () => {
  it('has one definition per sound, each with a unique name', () => {
    expect(SOUND_DEFS).toHaveLength(SOUND_COUNT);
    expect(new Set(SOUND_DEFS.map((d) => d.name)).size).toBe(SOUND_COUNT);
  });

  it('has each sound at its own index, in the order of Sound', () => {
    for (const [key, id] of Object.entries(Sound)) expect(SOUND_DEFS[id].name).toBe(key.toLowerCase());
    expect(Object.values(Sound).sort((a, b) => a - b)).toEqual(Array.from({ length: SOUND_COUNT }, (_, i) => i));
  });

  it('puts the menu and feedback sounds on effects, and the flame, the rain and the thunder on ambience', () => {
    for (const id of [Sound.Crackle, Sound.Rain, Sound.Thunder]) expect(SOUND_DEFS[id].bus).toBe(Bus.Ambience);
    for (const id of [Sound.Tick, Sound.Press, Sound.Ignite, Sound.Release, Sound.Lost])
      expect(SOUND_DEFS[id].bus).toBe(Bus.Effects);
  });

  it('loops only the flame, the rain, the music and the three story beds', () => {
    expect(SOUND_DEFS.filter((d) => d.loop).map((d) => d.name)).toEqual([
      'crackle',
      'rain',
      'music',
      'crickets',
      'wind',
      'birds',
    ]);
  });

  it('plays the music flat on the music bus, and only from its file', () => {
    const music = SOUND_DEFS[Sound.Music];
    expect(music.bus).toBe(Bus.Music);
    expect(music.flat).toBe(true);
    expect(music.fileOnly).toBe(true);
    expect(SOUND_DEFS.filter((d) => d.flat).map((d) => d.name)).toEqual(['music']);
  });

  it('plays the voices and the recorded story and night sounds only from their files, with no placeholder', () => {
    expect(SOUND_DEFS.filter((d) => d.fileOnly).map((d) => d.name)).toEqual([
      'music',
      'laugh',
      'yawn',
      'giggle',
      'hop',
      'blanket',
      'run',
      'jar',
      'bell',
      'gate',
      'creak',
      'gust',
      'crickets',
      'wind',
      'firefly',
      'palms',
      'slide',
      'snuff',
      'breath',
      'birds',
    ]);
  });

  it('fades the story beds (crickets, wind, birds) in and out slowly, and keeps them on ambience', () => {
    for (const id of [Sound.Crickets, Sound.Wind, Sound.Birds]) {
      expect(SOUND_DEFS[id].loop).toBe(true);
      expect(SOUND_DEFS[id].bus).toBe(Bus.Ambience);
      expect(SOUND_DEFS[id].fadeS).toBeGreaterThanOrEqual(1);
    }
  });

  it('plays the far thunder in a memory softer than the room thunder, on ambience', () => {
    expect(SOUND_DEFS[Sound.Rumble].bus).toBe(Bus.Ambience);
    expect(SOUND_DEFS[Sound.Rumble].gain).toBeLessThan(SOUND_DEFS[Sound.Thunder].gain);
  });

  it('keeps the first sounds where they were: rustle and thump on effects, the crackle on ambience', () => {
    expect(SOUND_DEFS[Sound.Rustle].bus).toBe(Bus.Effects);
    expect(SOUND_DEFS[Sound.Thump].bus).toBe(Bus.Effects);
    expect(SOUND_DEFS[Sound.Crackle].bus).toBe(Bus.Ambience);
    expect(SOUND_DEFS[Sound.Crackle].loop).toBe(true);
  });
});

describe('Cooldowns', () => {
  it('refuses a repeat inside the gap and allows it after, only once marked', () => {
    const c = new Cooldowns();
    const gap = SOUND_DEFS[Sound.Rustle].minGapS;
    expect(c.ready(Sound.Rustle, 0, 10)).toBe(true);
    expect(c.ready(Sound.Rustle, 0, 10)).toBe(true); // asking does not use the gap up
    c.mark(Sound.Rustle, 0, 10);
    expect(c.ready(Sound.Rustle, 0, 10 + gap / 2)).toBe(false);
    expect(c.ready(Sound.Rustle, 0, 10 + gap)).toBe(true);
  });

  it('keeps a clock for each sound and each key (hand)', () => {
    const c = new Cooldowns();
    c.mark(Sound.Rustle, 0, 0);
    expect(c.ready(Sound.Thump, 0, 0)).toBe(true);
    expect(c.ready(Sound.Rustle, 1, 0)).toBe(true);
    expect(c.ready(Sound.Rustle, 0, 0)).toBe(false);
  });
});
