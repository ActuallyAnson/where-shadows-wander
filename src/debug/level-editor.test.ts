import { describe, expect, it } from 'vitest';
import { Game } from '../game/game';
import { markerOf } from '../game/level';
import { MAX_PROPS } from '../game/props';
import { createNight } from '../game/puzzles/index';
import { Kind } from '../engine/sim/entity-kinds';
import { LevelEditor, NUDGE_M } from './level-editor';

function setup(index = 0) {
  const puzzles = createNight();
  const game = new Game({ puzzles });
  game.goto(index);
  return { game, puzzles, editor: new LevelEditor(puzzles[index]) };
}

describe('LevelEditor', () => {
  it('walks through the start, the goal and each prop, and says which is selected', () => {
    const { editor } = setup();
    expect(editor.editable).toBe(true);
    expect(editor.count).toBe(4); // start, goal, books, toy block
    expect(editor.describe()).toContain('start');
    editor.run('next');
    expect(editor.describe()).toContain('goal');
    editor.run('next');
    expect(editor.describe()).toContain('books');
    editor.run('prev');
    editor.run('prev');
    editor.run('prev');
    expect(editor.selected).toBe(3); // wraps round
  });

  it('moves a piece, and the puzzle loads with the change', () => {
    const { game, editor } = setup();
    const before = markerOf(game.layout, 'goal')!.x;
    editor.run('next'); // the goal
    expect(editor.run('right')).toBe(true);
    game.restart();
    expect(markerOf(game.layout, 'goal')!.x).toBeCloseTo(before + NUDGE_M, 6);
  });

  it('resizes a ledge and grows the gap it leaves', () => {
    const { game, editor } = setup();
    editor.run('next');
    editor.run('next'); // the books
    const cap = () => game.solver.terrain.count;
    const props = (game as unknown as { puzzle: { props: { size: number[] }[] } }).puzzle.props;
    const w = props[0].size[0];
    expect(editor.run('narrower')).toBe(true);
    expect(props[0].size[0]).toBeLessThan(w);
    game.restart();
    expect(cap()).toBeGreaterThan(0);
  });

  it('adds a ledge that becomes ground, removes it, and keeps the start and goal', () => {
    const { game, editor } = setup();
    const ground = () => game.solver.terrain.count;
    const before = ground();
    expect(editor.run('add')).toBe(true);
    expect(editor.count).toBe(5);
    expect(editor.describe()).toContain('new-');
    game.restart();
    expect(ground()).toBeGreaterThan(before);
    expect(editor.run('remove')).toBe(true);
    expect(editor.count).toBe(4);
    game.restart();
    expect(ground()).toBe(before);
    editor.selected = 0;
    expect(editor.run('remove')).toBe(false);
    expect(editor.message).toContain('stay');
    expect(editor.run('wider')).toBe(false); // the start has no size
  });

  it('will not add more props than a puzzle may have', () => {
    const { editor } = setup();
    let added = 0;
    while (editor.run('add')) added++;
    expect(2 + added + 0).toBeLessThanOrEqual(MAX_PROPS + 2);
    expect(editor.message).toContain(String(MAX_PROPS));
  });

  it('goes back to how the puzzle was written', () => {
    const { game, editor } = setup();
    const before = markerOf(game.layout, 'goal')!.x;
    editor.run('next');
    editor.run('left');
    editor.run('add');
    expect(editor.run('revert')).toBe(true);
    expect(editor.count).toBe(4);
    game.restart();
    expect(markerOf(game.layout, 'goal')!.x).toBeCloseTo(before, 6);
  });

  it('writes the layout and props as TypeScript that names every piece', () => {
    const { editor } = setup();
    const src = editor.toSource();
    expect(src).toContain('layout: {');
    expect(src).toContain("tag: 'gap'");
    expect(src).toContain("id: 'books'");
    expect(src).toContain("id: 'toy-block'");
    expect(src.split('\n').filter((l) => l.includes("shape: 'box'"))).toHaveLength(2);
  });

  it('can be used on every puzzle of the night, or says why it cannot', () => {
    for (let i = 0; i < 5; i++) {
      const { game, editor } = setup(i);
      if (!editor.editable) {
        expect(editor.describe()).toContain('chapter file');
        continue;
      }
      expect(editor.run('next')).toBe(false);
      expect(editor.run('up')).toBe(true);
      expect(() => game.restart()).not.toThrow();
      expect(editor.toSource().length).toBeGreaterThan(20);
    }
  });

  it('keeps what a puzzle has beyond ledges when it writes the code out, and says so when a resize changes nothing', () => {
    const puzzle = {
      layout: {
        traveller: { x: 0, y: 0 },
        goal: { x: 1, y: 0, width: 0.1, height: 0.2 },
        markers: [{ tag: 'gap', x: 0.5, y: 0, width: 0.2, height: 0.1 }],
        pieces: [{ kind: Kind.Rock, x: 0.2, y: 0.1, radius: 0.05 }],
      },
      props: [{ id: 'ball', shape: 'sphere' as const, x: 0, y: 0, size: [0.1], solid: false }],
    };
    const editor = new LevelEditor(puzzle);
    const src = editor.toSource();
    expect(src).toContain('pieces: [');
    expect(src).toContain('solid: false');
    expect(src).toContain("{ tag: 'gap', x: 0.5");
    expect(src).not.toContain('...');
    editor.selected = 2;
    expect(editor.run('taller')).toBe(false); // a sphere has no height
    expect(editor.message).toContain('does not change');
    expect(editor.run('wider')).toBe(true);
  });
});
