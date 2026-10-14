import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../settings/settings';
import { mergeData } from './merge';
import { MIGRATIONS } from './migrations';
import { SaveManager } from './save-manager';
import { defaultData, sanitize } from './schema';
import { MemoryStore } from './storage';

let clock = 5_000;
const open = (store: MemoryStore) => {
  const m = new SaveManager({ store, now: () => (clock += 10), today: () => '2026-10-13' });
  m.load();
  return m;
};

describe('settings in the save', () => {
  it('starts with the defaults and writes nothing for them', () => {
    const store = new MemoryStore();
    const m = open(store);
    expect(m.data.settings).toEqual(DEFAULT_SETTINGS);
    expect(m.flush()).toBe(true);
    expect(m.status.writes).toBe(0);
  });

  it('keeps changed settings across a reload', () => {
    const store = new MemoryStore();
    const m = open(store);
    expect(m.setSettings({ ...DEFAULT_SETTINGS, tolerance: 2.5, highContrast: true, hand: 'left' })).toBe(true);
    expect(m.flush()).toBe(true);
    const again = open(store);
    expect(again.data.settings).toMatchObject({ tolerance: 2.5, highContrast: true, hand: 'left' });
    expect(again.data.settingsAt).toBeGreaterThan(0);
  });

  it('does not dirty the save when nothing changed, and repairs out-of-range values', () => {
    const m = open(new MemoryStore());
    expect(m.setSettings({ ...DEFAULT_SETTINGS })).toBe(false);
    expect(m.setSettings({ ...DEFAULT_SETTINGS, tolerance: 50 })).toBe(true);
    expect(m.data.settings.tolerance).toBe(3);
  });

  it('survives a reset as the defaults, like the rest of the save', () => {
    const m = open(new MemoryStore());
    m.setSettings({ ...DEFAULT_SETTINGS, captions: true });
    m.reset();
    expect(m.data.settings).toEqual(DEFAULT_SETTINGS);
  });
});

describe('migrating version 1', () => {
  it('adds an empty settings block, which reads as the defaults with no repairs', () => {
    const v1 = { ...defaultData(1) } as Record<string, unknown>;
    delete v1.settings;
    delete v1.settingsAt;
    const migrated = MIGRATIONS[1](v1);
    const r = sanitize(migrated, 1)!;
    expect(r.repairs).toBe(0);
    expect(r.data.settings).toEqual(DEFAULT_SETTINGS);
  });

  it('is total: odd data passes through instead of throwing', () => {
    for (const odd of [null, 7, 'x', [1]]) expect(() => MIGRATIONS[1](odd)).not.toThrow();
  });
});

describe('merging settings from two copies', () => {
  const a = { ...defaultData(1), settings: { ...DEFAULT_SETTINGS, tolerance: 2 }, settingsAt: 100 };
  const b = { ...defaultData(1), settings: { ...DEFAULT_SETTINGS, flicker: 0 }, settingsAt: 200 };
  it('takes the whole set that changed last, whichever way round', () => {
    expect(mergeData(a, b).settings).toEqual(b.settings);
    expect(mergeData(b, a).settings).toEqual(b.settings);
    expect(mergeData(a, b).settingsAt).toBe(200);
  });
});
