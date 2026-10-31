import { describe, expect, it } from 'vitest';
import { Bus } from './mixer';
import { Cooldowns, Sound, SOUND_COUNT, SOUND_DEFS, soundForShapeEvent } from './sounds';

describe('soundForShapeEvent', () => {
  it('rustles when a shape is recognised and thumps when it commits, and is silent on cancel', () => {
    expect(soundForShapeEvent('candidate')).toBe(Sound.Rustle);
    expect(soundForShapeEvent('commit')).toBe(Sound.Thump);
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

  it('puts the menu and feedback sounds on effects, the flame and the room on ambience and the music on music', () => {
    expect(SOUND_DEFS[Sound.Music].bus).toBe(Bus.Music);
    expect(SOUND_DEFS[Sound.Hum].bus).toBe(Bus.Ambience);
    for (const id of [Sound.Tick, Sound.Press, Sound.Ignite, Sound.Release, Sound.Lost, Sound.Lift, Sound.Set])
      expect(SOUND_DEFS[id].bus).toBe(Bus.Effects);
  });

  it('loops only the flame, the room tone, the music, the clock and the wind', () => {
    expect(SOUND_DEFS.filter((d) => d.loop).map((d) => d.name)).toEqual(['crackle', 'hum', 'music', 'clock', 'wind']);
  });

  it('keeps the first four sounds where they were: rustle, thump and chime on effects, the crackle on ambience', () => {
    expect(SOUND_DEFS[Sound.Rustle].bus).toBe(Bus.Effects);
    expect(SOUND_DEFS[Sound.Thump].bus).toBe(Bus.Effects);
    expect(SOUND_DEFS[Sound.Chime].bus).toBe(Bus.Effects);
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
