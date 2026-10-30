import { describe, expect, it } from 'vitest';
import { Kind } from '../engine/sim/entity-kinds';
import { Role } from './abilities';
import { DebugSnapshot, describe as describeSnapshot, fillSnapshot } from './debug-snapshot';
import { Game } from './game';
import { Headless } from './headless';
import { createNight } from './puzzles/index';
import { InputRecorder, replay } from './replay';
import { newSave } from './save-state';

const opts = (puzzle = 0) => {
  const save = newSave();
  save.puzzle = puzzle;
  return { puzzles: createNight(), save, seed: 3 };
};

describe('debug snapshot', () => {
  it('copies the state a debug panel shows', () => {
    const h = new Headless(opts(2));
    h.pose('left', 'cup', 0.05, 0).run(2);
    const snap = fillSnapshot(h.game, new DebugSnapshot());
    expect(snap.puzzleId).toBe('n3-drip');
    expect(snap.counts[Kind.Raindrop]).toBeGreaterThan(0);
    expect(snap.roles[0]).toBe(Role.Catcher);
    expect(snap.water[0]).toBeGreaterThan(0);
    const lines = describeSnapshot(snap, h.game);
    expect(lines[0]).toContain('n3-drip');
    expect(lines.join('\n')).toContain('catcher');
  });
});

describe('replay', () => {
  it('plays a recorded session back into a fresh game to the same state', () => {
    const h = new Headless(opts(0));
    const rec = new InputRecorder(72 * 30);
    h.recorder = rec;
    h.run(3).pose('right', 'flat', 0, -0.27);
    expect(h.runUntil(() => h.game.puzzle.id === 'n2-ledge', 25)).toBe(true);
    h.pose('right', 'cup', -0.2, -0.05).run(3);
    expect(rec.full).toBe(false);

    const g = new Game(opts(0));
    replay(rec, g);
    const a = h.game.store,
      b = g.store;
    expect(g.puzzle.id).toBe('n2-ledge');
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
