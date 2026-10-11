import { describe, expect, it } from 'vitest';
import { Bus } from './mixer';
import { Cooldowns, Sound, SOUND_COUNT, SOUND_DEFS, soundForShapeEvent } from './sounds';

describe('soundForShapeEvent', () => {
  it('rustles when a shape is recognised and thumps when it commits, and is silent otherwise', () => {
    expect(soundForShapeEvent('candidate')).toBe(Sound.Rustle);
    expect(soundForShapeEvent('commit')).toBe(Sound.Thump);
    expect(soundForShapeEvent('cancel')).toBeNull();
    expect(soundForShapeEvent('release')).toBeNull();
  });
});

describe('SOUND_DEFS', () => {
  it('has one definition per sound, each with a unique name', () => {
    expect(SOUND_DEFS).toHaveLength(SOUND_COUNT);
    expect(new Set(SOUND_DEFS.map((d) => d.name)).size).toBe(SOUND_COUNT);
  });

  it('puts the feedback sounds on effects and the flame on ambience, looping only the flame', () => {
    expect(SOUND_DEFS[Sound.Rustle].bus).toBe(Bus.Effects);
    expect(SOUND_DEFS[Sound.Thump].bus).toBe(Bus.Effects);
    expect(SOUND_DEFS[Sound.Chime].bus).toBe(Bus.Effects);
    expect(SOUND_DEFS[Sound.Crackle].bus).toBe(Bus.Ambience);
    expect(SOUND_DEFS.filter((d) => d.loop).map((d) => d.name)).toEqual(['crackle']);
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
