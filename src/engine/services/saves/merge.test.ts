import { describe, expect, it } from 'vitest';
import { mergeData } from './merge';
import { defaultData, LIMITS, type SaveData } from './schema';

const make = (patch: Partial<SaveData> = {}): SaveData => ({ ...defaultData(1000), ...patch });

describe('mergeData', () => {
  it('keeps every creature, with the earliest discovery date', () => {
    const a = make({ creatures: Object.assign(Object.create(null), { rabbit: { discoveredAt: 500 } }) });
    const b = make({
      creatures: Object.assign(Object.create(null), { rabbit: { discoveredAt: 300 }, fox: { discoveredAt: 900 } }),
    });
    expect(mergeData(a, b).creatures).toEqual({ rabbit: { discoveredAt: 300 }, fox: { discoveredAt: 900 } });
  });

  it('unions the solutions found for a puzzle, in the order found, and keeps it solved if either solved it', () => {
    const a = make({ puzzles: Object.assign(Object.create(null), { p: { solved: false, solutions: ['x'] } }) });
    const b = make({
      puzzles: Object.assign(Object.create(null), {
        p: { solved: true, solutions: ['y', 'x'] },
        q: { solved: true, solutions: [] },
      }),
    });
    const m = mergeData(a, b);
    expect(m.puzzles.p).toEqual({ solved: true, solutions: ['x', 'y'] });
    expect(m.puzzles.q).toEqual({ solved: true, solutions: [] });
  });

  it('takes the resume point that was set last, even if it is a step back (a replay)', () => {
    const at = (chapter: number, puzzle: number, when: number) =>
      make({ progress: { chapter, puzzle, chaptersCompleted: [], lastPlayedDay: '', at: when } });
    expect(mergeData(at(3, 2, 100), at(1, 0, 200)).progress).toMatchObject({ chapter: 1, puzzle: 0, at: 200 });
    expect(mergeData(at(1, 0, 200), at(3, 2, 100)).progress).toMatchObject({ chapter: 1, puzzle: 0, at: 200 });
  });

  it('on a tie in time takes the further point, the same whichever way round', () => {
    const at = (chapter: number, puzzle: number) =>
      make({ progress: { chapter, puzzle, chaptersCompleted: [], lastPlayedDay: '', at: 50 } });
    expect(mergeData(at(1, 5), at(2, 0)).progress).toMatchObject({ chapter: 2, puzzle: 0 });
    expect(mergeData(at(2, 0), at(1, 5)).progress).toMatchObject({ chapter: 2, puzzle: 0 });
    expect(mergeData(at(2, 1), at(2, 4)).progress).toMatchObject({ chapter: 2, puzzle: 4 });
  });

  it('a copy made after more resets replaces the other outright, so a wiped save does not come back', () => {
    const old = make({ creatures: Object.assign(Object.create(null), { fox: { discoveredAt: 5 } }), resetCount: 0 });
    const wiped = make({ creatures: Object.assign(Object.create(null), { owl: { discoveredAt: 9 } }), resetCount: 1 });
    expect(Object.keys(mergeData(old, wiped).creatures)).toEqual(['owl']);
    expect(Object.keys(mergeData(wiped, old).creatures)).toEqual(['owl']);
    expect(mergeData(old, wiped).resetCount).toBe(1);
  });

  it('unions completed chapters, and keeps the latest day and the widest dates', () => {
    const a = make({
      createdAt: 100,
      updatedAt: 900,
      progress: { chapter: 1, puzzle: 0, chaptersCompleted: [2, 1], lastPlayedDay: '2026-10-09', at: 0 },
    });
    const b = make({
      createdAt: 50,
      updatedAt: 400,
      progress: { chapter: 1, puzzle: 0, chaptersCompleted: [3], lastPlayedDay: '2026-10-11', at: 0 },
    });
    const m = mergeData(a, b);
    expect(m.progress.chaptersCompleted).toEqual([1, 2, 3]);
    expect(m.progress.lastPlayedDay).toBe('2026-10-11');
    expect([m.createdAt, m.updatedAt]).toEqual([50, 900]);
  });

  it('is the same whichever way round, and with itself', () => {
    const a = make({ creatures: Object.assign(Object.create(null), { fox: { discoveredAt: 5 } }) });
    const b = make({ puzzles: Object.assign(Object.create(null), { p: { solved: true, solutions: ['s'] } }) });
    expect(JSON.parse(JSON.stringify(mergeData(a, b)))).toEqual(JSON.parse(JSON.stringify(mergeData(b, a))));
    expect(JSON.parse(JSON.stringify(mergeData(a, a)))).toEqual(JSON.parse(JSON.stringify(a)));
  });

  it('stays inside the limits', () => {
    const many = (prefix: string, n: number) => {
      const o = Object.create(null) as Record<string, { solved: boolean; solutions: string[] }>;
      for (let i = 0; i < n; i++) o[`${prefix}${i}`] = { solved: true, solutions: [] };
      return o;
    };
    const m = mergeData(make({ puzzles: many('a', LIMITS.puzzles) }), make({ puzzles: many('b', LIMITS.puzzles) }));
    expect(Object.keys(m.puzzles).length).toBe(LIMITS.puzzles);
  });

  it('does not change what it is given', () => {
    const a = make({ puzzles: Object.assign(Object.create(null), { p: { solved: false, solutions: ['x'] } }) });
    const b = make({ puzzles: Object.assign(Object.create(null), { p: { solved: true, solutions: ['y'] } }) });
    mergeData(a, b);
    expect(a.puzzles.p).toEqual({ solved: false, solutions: ['x'] });
  });
});
