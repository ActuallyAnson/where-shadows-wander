import { describe, expect, it } from 'vitest';
import {
  buildTesting,
  DEFAULT_TESTING,
  describeTesting,
  loadTesting,
  saveTesting,
  TESTING_KEY,
  nextChoice,
  parseTesting,
  RECORD_CHOICES,
  type TestingOptions,
} from './testing-options';

describe('parseTesting', () => {
  it('reads nothing from a plain address', () => {
    expect(parseTesting('')).toEqual(DEFAULT_TESTING);
    expect(parseTesting('?')).toEqual(DEFAULT_TESTING);
  });

  it('reads each switch the way the game reads it', () => {
    expect(parseTesting('?debug=joints,shadow&settings&record=20').record).toBe('free');
    const o = parseTesting('?debug=joints,shadow&settings&record&script=shapes');
    expect(o).toEqual({ joints: true, shadow: true, settings: true, record: 'shapes', menu: 'off', cutscene: false });
  });

  it('accepts a repeated debug parameter', () => {
    expect(parseTesting('?debug=joints&debug=shadow')).toMatchObject({ joints: true, shadow: true });
  });
});

describe('buildTesting', () => {
  it('gives an empty address when nothing is on', () => {
    expect(buildTesting('?debug=joints&settings', DEFAULT_TESTING)).toBe('');
  });

  it('builds the short forms the docs use', () => {
    const all: TestingOptions = {
      joints: true,
      shadow: true,
      settings: true,
      record: 'free',
      menu: 'off',
      cutscene: false,
    };
    expect(buildTesting('', all)).toBe('?debug=joints,shadow&settings&record=20');
    expect(buildTesting('', { ...DEFAULT_TESTING, record: 'shapes' })).toBe('?record&script=shapes');
  });

  it('keeps parameters it does not own, and unknown debug views', () => {
    const out = buildTesting('?mock=1&stage=real&debug=other,joints', { ...DEFAULT_TESTING, shadow: true });
    expect(out).toBe('?mock=1&stage=real&debug=shadow,other');
  });

  it('removes a note and script when recording is switched off', () => {
    expect(buildTesting('?record=20&note=hi&script=shapes', DEFAULT_TESTING)).toBe('');
  });

  it('round-trips every combination through the game reading it back', () => {
    for (const joints of [false, true])
      for (const shadow of [false, true])
        for (const settings of [false, true])
          for (const record of RECORD_CHOICES) {
            const o: TestingOptions = { joints, shadow, settings, record, menu: 'off', cutscene: false };
            expect(parseTesting(buildTesting('?mock=1', o))).toEqual(o);
          }
  });
});

describe('describeTesting and nextChoice', () => {
  it('lists what is on, in words', () => {
    expect(describeTesting(DEFAULT_TESTING)).toEqual([]);
    expect(describeTesting({ ...DEFAULT_TESTING, joints: true, record: 'shapes' })).toEqual([
      'joint dots',
      'guided shape recording (84 s)',
    ]);
  });

  it('cycles through a list and wraps', () => {
    expect(nextChoice(RECORD_CHOICES, 'off')).toBe('free');
    expect(nextChoice(RECORD_CHOICES, 'shapes')).toBe('off');
  });
});

describe('remembering the switches (no address needed)', () => {
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
          cutscene: joints,
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
      cutscene: false,
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
