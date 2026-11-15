import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../settings/settings';
import { defaultData, sanitize } from './schema';

const NOW = 1_760_000_000_000;
const good = () => ({
  createdAt: 1000,
  updatedAt: 2000,
  lastPlayedDay: '2026-10-11',
  resetCount: 0,
  settings: { ...DEFAULT_SETTINGS, tolerance: 2, hand: 'left' },
  settingsAt: 1800,
});

describe('defaultData', () => {
  it('starts never played, with the default settings', () => {
    expect(defaultData(NOW)).toEqual({
      createdAt: NOW,
      updatedAt: NOW,
      lastPlayedDay: '',
      resetCount: 0,
      settings: DEFAULT_SETTINGS,
      settingsAt: 0,
    });
  });
});

describe('sanitize', () => {
  it('passes a correct save through unchanged, with no repairs', () => {
    const r = sanitize(good(), NOW)!;
    expect(r.repairs).toBe(0);
    expect(JSON.parse(JSON.stringify(r.data))).toEqual(good());
  });

  it('returns null only for something that is not an object', () => {
    for (const bad of [null, undefined, 5, 'x', true, [], [1, 2]]) expect(sanitize(bad, NOW)).toBeNull();
  });

  it('fills everything missing from an empty object, counting the repairs', () => {
    const r = sanitize({}, NOW)!;
    expect(r.data.createdAt).toBe(NOW);
    expect(r.data.updatedAt).toBe(NOW);
    expect(r.data.lastPlayedDay).toBe('');
    expect(r.data.settings).toEqual(DEFAULT_SETTINGS);
    expect(r.repairs).toBeGreaterThan(0);
  });

  it.each([
    ['a negative timestamp', { createdAt: -5 }],
    ['an infinite timestamp', { updatedAt: Infinity }],
    ['a string timestamp', { createdAt: '1000' }],
  ])('repairs %s without losing the rest', (_name, patch) => {
    const r = sanitize({ ...good(), ...patch }, NOW)!;
    expect(r.repairs).toBeGreaterThan(0);
    expect(r.data.lastPlayedDay).toBe('2026-10-11');
    expect(r.data.settings.tolerance).toBe(2);
  });

  it('drops a day that is not YYYY-MM-DD', () => {
    for (const day of ['yesterday', '2026-1-1', '2026-99-99', '2026-00-10', '2026-10-32', 20261011, null]) {
      const r = sanitize({ ...good(), lastPlayedDay: day }, NOW)!;
      expect(r.data.lastPlayedDay).toBe('');
      expect(r.repairs).toBeGreaterThan(0);
    }
  });

  it('drops fields it does not know and counts them, so a schema change that forgot its migration is noticed', () => {
    const r = sanitize({ ...good(), extra: { a: 1 }, puzzles: {} }, NOW)!;
    expect(r.repairs).toBe(2);
    expect('extra' in r.data).toBe(false);
    expect('puzzles' in r.data).toBe(false);
  });

  it('repairs an update time before the creation time', () => {
    const r = sanitize({ ...good(), createdAt: 5000, updatedAt: 100 }, NOW)!;
    expect(r.data.updatedAt).toBe(5000);
    expect(r.repairs).toBe(1);
  });

  it('keeps the reset count and the settings time, and repairs bad ones', () => {
    const r = sanitize({ ...good(), resetCount: 3 }, NOW)!;
    expect([r.data.resetCount, r.data.settingsAt]).toEqual([3, 1800]);
    const bad = sanitize({ ...good(), resetCount: -1, settingsAt: 'now' }, NOW)!;
    expect([bad.data.resetCount, bad.data.settingsAt, bad.repairs]).toEqual([0, 0, 2]);
  });
});
