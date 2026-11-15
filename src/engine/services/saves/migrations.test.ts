import { describe, expect, it } from 'vitest';
import { MIGRATIONS, migrate } from './migrations';
import { CURRENT_VERSION } from './schema';

describe('migrate', () => {
  const table = {
    1: (d: unknown) => ({ ...(d as object), stepOne: true }),
    2: (d: unknown) => ({ ...(d as object), stepTwo: true }),
  };

  it('runs every step from the old version to the new one, in order', () => {
    expect(migrate({ a: 1 }, 1, 3, table)).toEqual({ ok: true, data: { a: 1, stepOne: true, stepTwo: true } });
    expect(migrate({ a: 1 }, 2, 3, table)).toEqual({ ok: true, data: { a: 1, stepTwo: true } });
  });

  it('does nothing when the data is already at the target version', () => {
    expect(migrate({ a: 1 }, 3, 3, table)).toEqual({ ok: true, data: { a: 1 } });
  });

  it('fails, rather than guessing, when a step is missing', () => {
    expect(migrate({}, 1, 4, table)).toEqual({ ok: false, reason: 'no migration from version 3 to 4' });
    expect(migrate({}, 0, 2, table)).toEqual({ ok: false, reason: 'no migration from version 0 to 1' });
  });

  it('fails, rather than throwing, when a step throws', () => {
    const boom = {
      1: () => {
        throw new Error('bad shape');
      },
    };
    expect(migrate({}, 1, 2, boom)).toEqual({ ok: false, reason: 'migration from version 1 failed: bad shape' });
  });

  it('does not change the data it was given', () => {
    const input = { a: 1 };
    migrate(input, 1, 3, table);
    expect(input).toEqual({ a: 1 });
  });
});

describe('the real migration table', () => {
  it('has a step for every version below the current one', () => {
    for (let v = 1; v < CURRENT_VERSION; v++)
      expect(MIGRATIONS[v], `a migration from version ${v}`).toBeTypeOf('function');
  });
});

describe('version 2 to 3', () => {
  it('drops the puzzle progress, puzzles, creatures and the travel scenes setting, keeping the day and the rest', () => {
    const v2 = {
      createdAt: 1,
      updatedAt: 2,
      progress: { chapter: 1, puzzle: 3, chaptersCompleted: [], lastPlayedDay: '2026-10-11', at: 5 },
      puzzles: { p: { solved: true, solutions: [] } },
      creatures: { fox: { discoveredAt: 3 } },
      resetCount: 1,
      settings: { captions: true, travelScenes: false },
      settingsAt: 4,
    };
    expect(MIGRATIONS[2](v2)).toEqual({
      createdAt: 1,
      updatedAt: 2,
      lastPlayedDay: '2026-10-11',
      resetCount: 1,
      settings: { captions: true },
      settingsAt: 4,
    });
  });

  it('never throws on odd data', () => {
    for (const odd of [null, 5, 'x', [], {}, { progress: null }, { progress: 7, settings: [] }])
      expect(() => MIGRATIONS[2](odd)).not.toThrow();
  });
});
