import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../settings/settings';
import { defaultData, emptyRecord, isValidId, LIMITS, sanitize } from './schema';

const NOW = 1_760_000_000_000;
const good = () => ({
  createdAt: 1000,
  updatedAt: 2000,
  progress: { chapter: 2, puzzle: 3, chaptersCompleted: [1], lastPlayedDay: '2026-10-11', at: 1700 },
  puzzles: { 'c1-p1': { solved: true, solutions: ['cup', 'roof'] } },
  creatures: { rabbit: { discoveredAt: 1500 } },
  resetCount: 0,
  settings: { ...DEFAULT_SETTINGS, tolerance: 2, hand: 'left' },
  settingsAt: 1800,
});

describe('defaultData', () => {
  it('starts at chapter 1, puzzle 0, with nothing found', () => {
    const d = defaultData(NOW);
    expect(d).toEqual({
      createdAt: NOW,
      updatedAt: NOW,
      progress: { chapter: 1, puzzle: 0, chaptersCompleted: [], lastPlayedDay: '', at: 0 },
      puzzles: {},
      creatures: {},
      resetCount: 0,
      settings: DEFAULT_SETTINGS,
      settingsAt: 0,
    });
  });
});

describe('isValidId', () => {
  it('accepts short plain ids and refuses anything else', () => {
    for (const ok of ['c1-p2', 'rabbit', 'flat_bridge', 'A', '9lives', 'constructor']) expect(isValidId(ok)).toBe(true);
    for (const bad of [
      '',
      '-x',
      '_x',
      '__proto__',
      'a b',
      'a.b',
      'a/b',
      'x'.repeat(LIMITS.idLength + 1),
      5,
      null,
      undefined,
      {},
    ])
      expect(isValidId(bad)).toBe(false);
    expect(isValidId('x'.repeat(LIMITS.idLength))).toBe(true);
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
    expect(r.data.progress).toEqual({ chapter: 1, puzzle: 0, chaptersCompleted: [], lastPlayedDay: '', at: 0 });
    expect(r.repairs).toBeGreaterThan(0);
  });

  it.each([
    ['a negative timestamp', { createdAt: -5 }],
    ['an infinite timestamp', { updatedAt: Infinity }],
    ['a string timestamp', { createdAt: '1000' }],
  ])('repairs %s without losing the rest', (_name, patch) => {
    const r = sanitize({ ...good(), ...patch }, NOW)!;
    expect(r.repairs).toBeGreaterThan(0);
    expect(r.data.progress.chapter).toBe(2);
    expect(r.data.creatures.rabbit).toBeDefined();
  });

  it.each([
    ['chapter 0', { chapter: 0 }],
    ['a fractional puzzle', { puzzle: 1.5 }],
    ['a negative puzzle', { puzzle: -1 }],
    ['a string chapter', { chapter: '2' }],
    ['a NaN puzzle', { puzzle: NaN }],
  ])('repairs progress with %s to the start, keeping the other field', (_name, patch) => {
    const r = sanitize({ ...good(), progress: { ...good().progress, ...patch } }, NOW)!;
    expect(r.repairs).toBeGreaterThan(0);
    const field = Object.keys(patch)[0] as 'chapter' | 'puzzle';
    expect(r.data.progress[field]).toBe(field === 'chapter' ? 1 : 0);
    expect(r.data.creatures.rabbit).toBeDefined();
  });

  it('drops bad, duplicate and out-of-range completed chapters and sorts the rest', () => {
    const r = sanitize(
      { ...good(), progress: { ...good().progress, chaptersCompleted: [3, 1, 1, 0, -2, 'x', 2.5, 2] } },
      NOW,
    )!;
    expect(r.data.progress.chaptersCompleted).toEqual([1, 2, 3]);
    expect(r.repairs).toBe(5);
  });

  it('drops a day that is not YYYY-MM-DD', () => {
    for (const day of ['yesterday', '2026-1-1', '2026-99-99', '2026-00-10', '2026-10-32', 20261011, null]) {
      const r = sanitize({ ...good(), progress: { ...good().progress, lastPlayedDay: day } }, NOW)!;
      expect(r.data.progress.lastPlayedDay).toBe('');
      expect(r.repairs).toBeGreaterThan(0);
    }
  });

  it('drops one bad puzzle or creature entry, not the others', () => {
    const r = sanitize(
      {
        ...good(),
        puzzles: {
          ok: { solved: true, solutions: ['a'] },
          'bad id!': { solved: true, solutions: [] },
          five: 5,
          nul: null,
        },
        creatures: { fox: { discoveredAt: 7 }, 'bad id!': { discoveredAt: 1 }, owl: 'x' },
      },
      NOW,
    )!;
    expect(Object.keys(r.data.puzzles)).toEqual(['ok']);
    expect(Object.keys(r.data.creatures)).toEqual(['fox']);
    expect(r.repairs).toBe(5);
  });

  it('repairs a puzzle whose solutions or solved flag are wrong, keeping what is good', () => {
    const r = sanitize({ ...good(), puzzles: { p: { solved: 'yes', solutions: ['a', 'a', 7, 'b c', 'd'] } } }, NOW)!;
    expect(r.data.puzzles.p).toEqual({ solved: false, solutions: ['a', 'd'] });
    expect(r.repairs).toBe(4);
  });

  it('gives a creature with no date the save’s own time', () => {
    const r = sanitize({ ...good(), creatures: { fox: {} } }, NOW)!;
    expect(r.data.creatures.fox.discoveredAt).toBe(2000);
  });

  it('keeps the lists inside their limits', () => {
    const puzzles: Record<string, unknown> = {};
    for (let i = 0; i < LIMITS.puzzles + 20; i++) puzzles[`p${i}`] = { solved: true, solutions: [] };
    const creatures: Record<string, unknown> = {};
    for (let i = 0; i < LIMITS.creatures + 20; i++) creatures[`c${i}`] = { discoveredAt: 1 };
    const solutions = Array.from({ length: LIMITS.solutionsPerPuzzle + 5 }, (_, i) => `s${i}`);
    const r = sanitize({ ...good(), puzzles: { ...puzzles, big: { solved: true, solutions } }, creatures }, NOW)!;
    expect(Object.keys(r.data.puzzles).length).toBe(LIMITS.puzzles);
    expect(Object.keys(r.data.creatures).length).toBe(LIMITS.creatures);
    const first = sanitize({ ...good(), puzzles: { big: { solved: true, solutions } } }, NOW)!;
    expect(first.data.puzzles.big.solutions).toHaveLength(LIMITS.solutionsPerPuzzle);
  });

  it('is safe against ids that are properties of Object, and against __proto__ in the JSON', () => {
    const text =
      '{"puzzles":{"__proto__":{"solved":true,"solutions":["x"]},"constructor":{"solved":true,"solutions":[]}},"creatures":{"toString":{"discoveredAt":1},"__proto__":{"discoveredAt":2}}}';
    const r = sanitize(JSON.parse(text), NOW)!;
    expect(Object.keys(r.data.puzzles)).toEqual(['constructor']);
    expect(Object.keys(r.data.creatures)).toEqual(['toString']);
    expect(({} as Record<string, unknown>).solved).toBeUndefined();
    expect(Object.getPrototypeOf(r.data.puzzles)).toBeNull();
  });

  it('drops fields it does not know and counts them, so a schema change that forgot its migration is noticed', () => {
    const r = sanitize({ ...good(), extra: { a: 1 }, progress: { ...good().progress, mood: 'sleepy' } }, NOW)!;
    expect(r.repairs).toBe(2);
    expect('extra' in r.data).toBe(false);
    expect('mood' in r.data.progress).toBe(false);
  });

  it('repairs an update time before the creation time', () => {
    const r = sanitize({ ...good(), createdAt: 5000, updatedAt: 100 }, NOW)!;
    expect(r.data.updatedAt).toBe(5000);
    expect(r.repairs).toBe(1);
  });

  it('keeps the resume time and the reset count, and repairs bad ones', () => {
    const r = sanitize({ ...good(), resetCount: 3 }, NOW)!;
    expect([r.data.progress.at, r.data.resetCount]).toEqual([1700, 3]);
    const bad = sanitize({ ...good(), resetCount: -1, progress: { ...good().progress, at: 'now' } }, NOW)!;
    expect([bad.data.progress.at, bad.data.resetCount, bad.repairs]).toEqual([0, 0, 2]);
  });
});

describe('emptyRecord', () => {
  it('has no prototype', () => {
    expect(Object.getPrototypeOf(emptyRecord())).toBeNull();
  });
});
