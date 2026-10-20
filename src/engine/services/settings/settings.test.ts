import { describe, expect, it } from 'vitest';
import {
  clampNumber,
  DEFAULT_SETTINGS,
  repairSettings,
  repairValue,
  SETTING_SPECS,
  settingsEqual,
  specFor,
  type NumberSpec,
} from './settings';

describe('the settings table', () => {
  it('has a default inside its own range, a label and a one-line explanation for every setting', () => {
    for (const s of SETTING_SPECS) {
      expect(s.label.length).toBeGreaterThan(0);
      expect(s.help.length).toBeGreaterThan(10);
      expect(s.help).not.toContain('\n');
      if (s.kind === 'number') {
        expect(s.default).toBeGreaterThanOrEqual(s.min);
        expect(s.default).toBeLessThanOrEqual(s.max);
        expect(clampNumber(s, s.default)).toBe(s.default);
      }
    }
  });

  it('lists each key once and covers every field of Settings', () => {
    const keys = SETTING_SPECS.map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect([...keys].sort()).toEqual(Object.keys(DEFAULT_SETTINGS).sort());
  });

  it('starts sensibly: normal tolerance, 0.4 s hold, natural shadows, no high contrast, right hand', () => {
    expect(DEFAULT_SETTINGS).toMatchObject({
      tolerance: 1,
      holdTime: 0.4,
      shadowSize: 1,
      highContrast: false,
      captions: false,
      hand: 'right',
    });
  });

  it('matches the ranges the engine documents (tolerance 1 to 3, hold 0.2 to 1.0 s)', () => {
    expect(specFor('tolerance')).toMatchObject({ min: 1, max: 3 });
    expect(specFor('holdTime')).toMatchObject({ min: 0.2, max: 1 });
  });
});

describe('clampNumber', () => {
  const hold = specFor('holdTime') as NumberSpec;
  it('limits to the range and snaps to the step without float noise', () => {
    expect(clampNumber(hold, 0)).toBe(0.2);
    expect(clampNumber(hold, 9)).toBe(1);
    expect(clampNumber(hold, 0.5000001)).toBe(0.5);
    expect(clampNumber(hold, 0.2 + 0.1)).toBe(0.3);
  });
  it('gives the default for anything that is not a finite number', () => {
    for (const v of [NaN, Infinity, '0.5', null, undefined, {}]) expect(clampNumber(hold, v)).toBe(hold.default);
  });
});

describe('repairValue', () => {
  it('repairs toggles and choices', () => {
    expect(repairValue('highContrast', 'yes')).toBe(false);
    expect(repairValue('captions', true)).toBe(true);
    expect(repairValue('hand', 'left')).toBe('left');
    expect(repairValue('hand', 'middle')).toBe('right');
  });
});

describe('repairSettings', () => {
  it('passes valid settings through with no repairs', () => {
    const mine = { ...DEFAULT_SETTINGS, tolerance: 2.5, hand: 'left' as const, highContrast: true };
    const r = repairSettings(mine);
    expect(r.repairs).toBe(0);
    expect(r.settings).toEqual(mine);
  });

  it('fills a missing block or missing values with the defaults, without counting a repair', () => {
    expect(repairSettings(undefined)).toEqual({ settings: DEFAULT_SETTINGS, repairs: 0 });
    expect(repairSettings({}).repairs).toBe(0);
    expect(repairSettings({ tolerance: 3 }).settings).toEqual({ ...DEFAULT_SETTINGS, tolerance: 3 });
  });

  it('repairs one bad value at a time and counts it, keeping the rest', () => {
    const r = repairSettings({ tolerance: 99, holdTime: 'slow', hand: 'left', flicker: 0.5 });
    expect(r.settings).toMatchObject({ tolerance: 3, holdTime: 0.4, hand: 'left', flicker: 0.5 });
    expect(r.repairs).toBe(2);
  });

  it('counts an unknown key, and a block that is not an object', () => {
    expect(repairSettings({ ...DEFAULT_SETTINGS, brightness: 3 }).repairs).toBe(1);
    for (const bad of [5, 'x', null, [1, 2]])
      expect(repairSettings(bad)).toEqual({ settings: DEFAULT_SETTINGS, repairs: 1 });
  });

  it('never returns the shared defaults object, so changing the result cannot change the defaults', () => {
    const r = repairSettings(undefined).settings;
    expect(r).not.toBe(DEFAULT_SETTINGS);
    r.tolerance = 3;
    expect(DEFAULT_SETTINGS.tolerance).toBe(1);
  });
});

describe('settingsEqual', () => {
  it('compares every setting', () => {
    expect(settingsEqual(DEFAULT_SETTINGS, { ...DEFAULT_SETTINGS })).toBe(true);
    expect(settingsEqual(DEFAULT_SETTINGS, { ...DEFAULT_SETTINGS, captions: true })).toBe(false);
  });
});
