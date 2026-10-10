import { describe, expect, it } from 'vitest';
import chapter1 from '../../public/scenes/chapter-1.iwsdk.scene.json';
import { Kind } from '../engine/sim/entity-kinds';
import { Role } from './abilities';
import { DebugSnapshot, describe as describeSnapshot, fillSnapshot } from './debug-snapshot';
import { Game } from './game';
import { Headless } from './headless';
import { createChapter1 } from './puzzles/index';
import { InputRecorder, replay } from './replay';
import { newSave } from './save-state';

const opts = (puzzle = 0) => {
  const save = newSave();
  save.puzzle = puzzle;
  return { chapter: chapter1, puzzles: createChapter1(), save, seed: 3 };
};

describe('debug snapshot', () => {
  it('copies the state a debug panel shows', () => {
    const h = new Headless(opts(4));
    h.pose('left', 'cup', -0.45, 0.13).run(2);
    const snap = fillSnapshot(h.game, new DebugSnapshot());
    expect(snap.puzzleId).toBe('p5-crows');
    expect(snap.counts[Kind.Crow]).toBe(3);
    expect(snap.roles[0]).toBe(Role.Catcher);
    expect(snap.carried[0]).toBeGreaterThanOrEqual(3);
    const lines = describeSnapshot(snap, h.game);
    expect(lines[0]).toContain('p5-crows');
    expect(lines.join('\n')).toContain('catcher');
  });
});

describe('replay', () => {
  it('plays a recorded session back into a fresh game to the same state', () => {
    const h = new Headless(opts(0));
    const rec = new InputRecorder(72 * 30);
    h.recorder = rec;
    h.run(3).pose('right', 'flat', 0, -0.32);
    expect(h.runUntil(() => h.game.puzzle.id === 'p2-rain', 25)).toBe(true);
    h.pose('right', 'cup', -0.2, -0.05).run(3);
    expect(rec.full).toBe(false);

    const g = new Game(opts(0));
    replay(rec, g);
    const a = h.game.store,
      b = g.store;
    expect(g.puzzle.id).toBe('p2-rain');
    expect(g.time).toBe(h.game.time);
    expect(b.count).toBe(a.count);
    expect(new Uint8Array(b.x.buffer)).toEqual(new Uint8Array(a.x.buffer));
    expect(new Uint8Array(b.y.buffer)).toEqual(new Uint8Array(a.y.buffer));
    expect(g.save).toEqual(h.game.save);
  });

  it('stops recording when full', () => {
    const rec = new InputRecorder(10);
    const h = new Headless(opts(0));
    h.recorder = rec;
    h.run(1);
    expect(rec.frames).toBe(10);
    expect(rec.full).toBe(true);
  });
});
