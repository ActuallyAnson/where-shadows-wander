import { describe, expect, it, vi } from 'vitest';
import { Bus, Mixer } from '../audio/mixer';
import { DEFAULT_SETTINGS } from './settings';
import { SettingsStore, type SettingsTargets } from './settings-store';

function rig() {
  const recognizer = { setTolerance: vi.fn(), setHoldTimes: vi.fn() };
  const projector = { settings: { size: 1 } };
  const sharpen = { settings: { strength: 1 } };
  const lantern = { settings: { amplitude: 0.3 } };
  const mixer = new Mixer();
  const targets: SettingsTargets = { recognizer, projector, sharpen, lantern, mixer };
  return { recognizer, projector, sharpen, lantern, mixer, targets };
}

describe('SettingsStore applies changes live', () => {
  it('sends tolerance and hold times to the recognizer (a companion holds 2.5 times as long)', () => {
    const r = rig();
    const s = new SettingsStore(r.targets);
    r.recognizer.setTolerance.mockClear();
    r.recognizer.setHoldTimes.mockClear();
    s.set('tolerance', 2.5);
    s.set('holdTime', 0.6);
    expect(r.recognizer.setTolerance).toHaveBeenLastCalledWith(2.5);
    expect(r.recognizer.setHoldTimes).toHaveBeenLastCalledWith(0.6, 1.5);
  });

  it('the default hold time gives the GDD values: 0.4 s for verbs and 1 s for companions', () => {
    const r = rig();
    new SettingsStore(r.targets);
    expect(r.recognizer.setHoldTimes).toHaveBeenLastCalledWith(0.4, 1);
  });

  it('steers the shadow size, the sharpen strength and the mixer buses', () => {
    const r = rig();
    const s = new SettingsStore(r.targets);
    s.set('shadowSize', 1.5);
    s.set('sharpen', 0);
    s.set('volumeMaster', 0.5);
    s.set('volumeMusic', 0.2);
    s.set('volumeEffects', 0.9);
    s.set('volumeAmbience', 0);
    expect(r.projector.settings.size).toBe(1.5);
    expect(r.sharpen.settings.strength).toBe(0);
    expect(r.mixer.master).toBe(0.5);
    expect(r.mixer.volume(Bus.Music)).toBe(0.2);
    expect(r.mixer.volume(Bus.Effects)).toBe(0.9);
    expect(r.mixer.volume(Bus.Ambience)).toBe(0);
  });

  it('repairs a value out of range before applying it', () => {
    const r = rig();
    const s = new SettingsStore(r.targets);
    s.set('shadowSize', 99);
    s.set('tolerance', 'wide');
    expect(r.projector.settings.size).toBe(2);
    expect(s.value.tolerance).toBe(1);
  });

  it('works with no targets at all (the Hand Lab has no mixer)', () => {
    const s = new SettingsStore();
    expect(() => s.set('volumeMaster', 0.1)).not.toThrow();
    expect(s.value.volumeMaster).toBe(0.1);
  });
});

describe('SettingsStore start-up', () => {
  it('applies saved settings straight away', () => {
    const r = rig();
    new SettingsStore(r.targets, {}, { ...DEFAULT_SETTINGS, shadowSize: 1.8, tolerance: 3 });
    expect(r.projector.settings.size).toBe(1.8);
    expect(r.recognizer.setTolerance).toHaveBeenLastCalledWith(3);
  });

  it('repairs a damaged saved block instead of throwing', () => {
    const s = new SettingsStore({}, {}, { tolerance: 'x', hand: 7 });
    expect(s.value).toEqual(DEFAULT_SETTINGS);
  });

  it('leaves the lantern to the device default until the player chooses a flicker', () => {
    const r = rig(); // amplitude 0.3: the reduced-motion default main.ts picked
    const s = new SettingsStore(r.targets, { applyOnlyWhenChosen: ['flicker'] });
    expect(r.lantern.settings.amplitude).toBe(0.3);
    s.set('flicker', 1); // choosing the very value the setting defaults to still counts
    expect(r.lantern.settings.amplitude).toBe(1);
    s.set('flicker', 0);
    expect(r.lantern.settings.amplitude).toBe(0);
  });

  it('applies a saved non-default flicker at start-up, and never applies a key in neverApply', () => {
    const a = rig();
    new SettingsStore(a.targets, { applyOnlyWhenChosen: ['flicker'] }, { ...DEFAULT_SETTINGS, flicker: 0.5 });
    expect(a.lantern.settings.amplitude).toBe(0.5);
    const b = rig();
    const s = new SettingsStore(b.targets, { neverApply: ['flicker'] });
    s.set('flicker', 0);
    expect(b.lantern.settings.amplitude).toBe(0.3);
  });

  it('holds a key back on demand and applies it again when released', () => {
    const r = rig();
    const s = new SettingsStore(r.targets);
    s.hold('flicker', true);
    s.set('flicker', 0);
    expect(r.lantern.settings.amplitude).toBe(1); // still the default applied at start-up: held back
    s.hold('flicker', false);
    expect(r.lantern.settings.amplitude).toBe(0);
  });
});

describe('SettingsStore listeners', () => {
  it('hear each change once with the key, and nothing for a value that did not change', () => {
    const s = new SettingsStore();
    const heard = vi.fn();
    s.subscribe(heard);
    s.set('highContrast', true);
    s.set('highContrast', true);
    expect(heard).toHaveBeenCalledTimes(1);
    expect(heard).toHaveBeenCalledWith('highContrast', expect.objectContaining({ highContrast: true }));
  });

  it('a throwing listener does not stop the others or the change', () => {
    const r = rig();
    const s = new SettingsStore(r.targets);
    const after = vi.fn();
    s.subscribe(() => {
      throw new Error('boom');
    });
    s.subscribe(after);
    s.set('shadowSize', 1.2);
    expect(after).toHaveBeenCalled();
    expect(r.projector.settings.size).toBe(1.2);
  });

  it('can be unsubscribed', () => {
    const s = new SettingsStore();
    const heard = vi.fn();
    const off = s.subscribe(heard);
    off();
    s.set('captions', true);
    expect(heard).not.toHaveBeenCalled();
  });

  it('reset restores and applies every default, with one null change', () => {
    const r = rig();
    const s = new SettingsStore(r.targets, {}, { ...DEFAULT_SETTINGS, shadowSize: 2, hand: 'left' });
    const heard = vi.fn();
    s.subscribe(heard);
    s.reset();
    expect(s.value).toEqual(DEFAULT_SETTINGS);
    expect(r.projector.settings.size).toBe(1);
    expect(heard).toHaveBeenCalledTimes(1);
    expect(heard.mock.calls[0][0]).toBeNull();
  });

  it('setAll replaces everything and announces once', () => {
    const s = new SettingsStore();
    const heard = vi.fn();
    s.subscribe(heard);
    s.setAll({ ...DEFAULT_SETTINGS, hand: 'left', tolerance: 2 });
    expect(s.value).toMatchObject({ hand: 'left', tolerance: 2 });
    expect(heard).toHaveBeenCalledTimes(1);
  });
});
