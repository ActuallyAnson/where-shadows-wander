import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TESTING,
  describeTesting,
  loadTesting,
  saveTesting,
  TESTING_KEY,
  nextChoice,
  RECORD_CHOICES,
  type TestingOptions,
} from './testing-options';

describe('describeTesting and nextChoice', () => {
  it('lists what is on, in words', () => {
    expect(describeTesting(DEFAULT_TESTING)).toEqual([]);
    expect(describeTesting({ ...DEFAULT_TESTING, joints: true, record: 'shapes' })).toEqual([
      'joint dots',
      'guided shape recording (84 s)',
    ]);
    expect(describeTesting({ ...DEFAULT_TESTING, flicker: 0 })).toEqual(['lantern flicker 0']);
  });

  it('cycles through a list and wraps', () => {
    expect(nextChoice(RECORD_CHOICES, 'off')).toBe('free');
    expect(nextChoice(RECORD_CHOICES, 'shapes')).toBe('off');
  });
});

describe('remembering the switches (no address needed)', () => {
  it('keeps the flicker between 0 and 1, and ignores anything but a number', () => {
    const s = new Map<string, string>();
    const st = { getItem: (k: string) => s.get(k) ?? null, setItem: (k: string, v: string) => void s.set(k, v) };
    s.set(TESTING_KEY, JSON.stringify({ flicker: 3 }));
    expect(loadTesting(st).flicker).toBe(1);
    s.set(TESTING_KEY, JSON.stringify({ flicker: '0' }));
    expect(loadTesting(st).flicker).toBeNull();
  });

  const store = () => {
    const m = new Map<string, string>();
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m };
  };

  it('saves and loads every combination', () => {
    for (const joints of [false, true])
      for (const record of RECORD_CHOICES) {
        const s = store();
        const o: TestingOptions = {
          joints,
          shadow: !joints,
          settings: joints,
          record,
          menu: 'pause',
          flicker: joints ? 0 : null,
        };
        expect(saveTesting(o, s)).toBe(true);
        expect(loadTesting(s)).toEqual(o);
      }
  });

  it('is all off for nothing stored, damaged text or blocked storage, and repairs odd values', () => {
    expect(loadTesting(store())).toEqual(DEFAULT_TESTING);
    const bad = store();
    bad.m.set(TESTING_KEY, '{not json');
    expect(loadTesting(bad)).toEqual(DEFAULT_TESTING);
    const odd = store();
    odd.m.set(TESTING_KEY, JSON.stringify({ joints: 'yes', record: 'forever', settings: true }));
    expect(loadTesting(odd)).toEqual({
      joints: false,
      shadow: false,
      settings: true,
      record: 'off',
      menu: 'off',
      flicker: null,
    });
    expect(loadTesting(null)).toEqual(DEFAULT_TESTING);
    const throwing = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(loadTesting(throwing)).toEqual(DEFAULT_TESTING);
    expect(saveTesting(DEFAULT_TESTING, throwing)).toBe(false);
    expect(saveTesting(DEFAULT_TESTING, null)).toBe(false);
  });
});
