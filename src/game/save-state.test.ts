import { describe, expect, it } from 'vitest';
import { addCreature, addSolution, newSave, readSave, SAVE_VERSION } from './save-state';

describe('save state', () => {
  it('starts at the first puzzle with nothing found', () => {
    expect(newSave()).toEqual({
      version: SAVE_VERSION,
      chapter: 'night',
      puzzle: 0,
      solutions: {},
      creatures: [],
      chapterComplete: false,
    });
  });

  it('round-trips through JSON', () => {
    const s = newSave();
    addSolution(s, 'p1-gap', 'bridge');
    addCreature(s, 'fox');
    s.puzzle = 3;
    expect(readSave(JSON.parse(JSON.stringify(s)))).toEqual(s);
  });

  it('records each solution and creature once', () => {
    const s = newSave();
    expect(addSolution(s, 'p2-rain', 'cup')).toBe(true);
    expect(addSolution(s, 'p2-rain', 'cup')).toBe(false);
    expect(addSolution(s, 'p2-rain', 'roof')).toBe(true);
    expect(s.solutions['p2-rain']).toEqual(['cup', 'roof']);
    expect(addCreature(s, 'rabbit')).toBe(true);
    expect(addCreature(s, 'rabbit')).toBe(false);
  });

  it('never throws on damaged data, keeping what is valid', () => {
    for (const bad of [null, 3, 'x', [], { version: 99 }, { version: 1, puzzle: -2, creatures: 'fox' }]) {
      expect(() => readSave(bad)).not.toThrow();
    }
    const s = readSave({ version: 1, puzzle: 2.5, creatures: ['fox', 7], solutions: { a: ['x', 1], b: 'nope' } });
    expect(s.puzzle).toBe(0);
    expect(s.creatures).toEqual(['fox']);
    expect(s.solutions).toEqual({ a: ['x'] });
  });
});
