import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../settings/settings';
import { mergeData } from './merge';
import { defaultData, type SaveData } from './schema';

const make = (patch: Partial<SaveData> = {}): SaveData => ({ ...defaultData(1000), ...patch });

describe('mergeData', () => {
  it('takes the settings changed last, whole', () => {
    const a = make({ settings: { ...DEFAULT_SETTINGS, volumeMaster: 0.2, highContrast: true }, settingsAt: 100 });
    const b = make({ settings: { ...DEFAULT_SETTINGS, volumeMaster: 0.9 }, settingsAt: 200 });
    expect(mergeData(a, b).settings).toEqual(b.settings);
    expect(mergeData(b, a).settings).toEqual(b.settings);
    expect(mergeData(a, b).settingsAt).toBe(200);
  });

  it('a copy made after more resets replaces the other outright, so a wiped save does not come back', () => {
    const old = make({ lastPlayedDay: '2026-10-12', resetCount: 0 });
    const wiped = make({ lastPlayedDay: '2026-10-01', resetCount: 1 });
    expect(mergeData(old, wiped)).toBe(wiped);
    expect(mergeData(wiped, old)).toBe(wiped);
  });

  it('keeps the latest day and the widest dates', () => {
    const a = make({ createdAt: 100, updatedAt: 900, lastPlayedDay: '2026-10-09' });
    const b = make({ createdAt: 50, updatedAt: 400, lastPlayedDay: '2026-10-11' });
    const m = mergeData(a, b);
    expect(m.lastPlayedDay).toBe('2026-10-11');
    expect([m.createdAt, m.updatedAt]).toEqual([50, 900]);
  });

  it('is the same whichever way round, and with itself', () => {
    const a = make({ lastPlayedDay: '2026-10-09', settingsAt: 5 });
    const b = make({ lastPlayedDay: '2026-10-11', settings: { ...DEFAULT_SETTINGS, captions: true }, settingsAt: 9 });
    expect(mergeData(a, b)).toEqual(mergeData(b, a));
    expect(mergeData(a, a)).toEqual(a);
  });

  it('does not change what it is given', () => {
    const a = make({ lastPlayedDay: '2026-10-09' });
    const b = make({ lastPlayedDay: '2026-10-11' });
    mergeData(a, b);
    expect(a.lastPlayedDay).toBe('2026-10-09');
  });
});
