import { describe, expect, it } from 'vitest';
import { Bus, Mixer, volumeToGain } from './mixer';

describe('volumeToGain', () => {
  it('is silent at 0, unity at 1, and quieter than linear in between', () => {
    expect(volumeToGain(0)).toBe(0);
    expect(volumeToGain(1)).toBe(1);
    expect(volumeToGain(0.5)).toBe(0.25);
  });

  it('clamps out-of-range and NaN to the ends', () => {
    expect(volumeToGain(2)).toBe(1);
    expect(volumeToGain(-1)).toBe(0);
    expect(volumeToGain(NaN)).toBe(0);
  });
});

describe('Mixer', () => {
  it('multiplies master and bus volumes through the curve', () => {
    const m = new Mixer();
    m.setMaster(0.5);
    m.setVolume(Bus.Effects, 0.5);
    expect(m.busGain(Bus.Effects)).toBeCloseTo(0.25 * 0.25, 12);
  });

  it('mutes one bus, or everything, without losing the volumes', () => {
    const m = new Mixer();
    m.setVolume(Bus.Music, 0.8);
    m.setMuted(Bus.Music, true);
    expect(m.busGain(Bus.Music)).toBe(0);
    expect(m.busGain(Bus.Effects)).toBeGreaterThan(0);
    m.setMuted(Bus.Music, false);
    expect(m.busGain(Bus.Music)).toBeCloseTo(0.64, 12);
    m.setAllMuted(true);
    for (const b of [Bus.Music, Bus.Effects, Bus.Ambience]) expect(m.busGain(b)).toBe(0);
    expect(m.isMuted(Bus.Effects)).toBe(true);
    m.setAllMuted(false);
    expect(m.busGain(Bus.Effects)).toBe(1);
  });

  it('bumps its version on every change, and not otherwise', () => {
    const m = new Mixer();
    const v = m.version;
    m.busGain(Bus.Music);
    expect(m.version).toBe(v);
    m.setMaster(0.3);
    m.setVolume(Bus.Ambience, 0.1);
    m.setMuted(Bus.Music, true);
    m.setAllMuted(true);
    expect(m.version).toBe(v + 4);
  });

  it('clamps what the sliders send', () => {
    const m = new Mixer();
    m.setMaster(7);
    m.setVolume(Bus.Music, -3);
    expect(m.master).toBe(1);
    expect(m.volume(Bus.Music)).toBe(0);
  });
});
