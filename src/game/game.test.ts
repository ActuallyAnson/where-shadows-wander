import { describe, expect, it } from 'vitest';
import { createHandShadow } from '../engine/hands/hand-shadow';
import { ShapeEventQueue } from '../engine/hands/shape-events';
import { Kind } from '../engine/sim/entity-kinds';
import { flatShadow } from '../engine/sim/shadow-shapes';
import { Role } from './abilities';
import { Game, MAX_STEPS_PER_FRAME, type GameInput } from './game';
import { Headless } from './headless';
import { createNightLevels } from './puzzles/index';
import { newSave } from './save-state';

/**
 * The first stage of each level: the five puzzles these tests of the game's mechanics play (resume,
 * restart, the outro, saves). The levels' later stages are played in src/game/puzzles/stages.test.ts.
 */
const createNight = () => createNightLevels().map((stages) => stages[0]);

const opts = () => ({ puzzles: createNight() });

function input(dt = 1 / 72, paused = false): GameInput {
  return { dt, paused, left: null, right: null, shapeEvents: null };
}

describe('Game', () => {
  it('starts on the first puzzle with the traveller on its props', () => {
    const g = new Game(opts());
    expect(g.puzzle.id).toBe('n1-books');
    expect(g.store.countOf(Kind.Traveller)).toBe(1);
    // The books and the toy block, four edges each, and no ground line.
    expect(g.solver.terrain.count).toBe(8);
    expect(g.events.has('puzzle-start', 'n1-books')).toBe(true);
  });

  it('resumes at the saved puzzle', () => {
    const save = newSave();
    save.puzzle = 2;
    expect(new Game({ ...opts(), save }).puzzle.id).toBe('n3-drip');
  });

  it('steps at 60 Hz whatever the display rate, and returns an interpolation factor', () => {
    const g = new Game(opts());
    let alpha = 0;
    for (let i = 0; i < 90; i++) alpha = g.frame(input(1 / 90));
    expect(Math.abs(g.loop.steps - 60)).toBeLessThanOrEqual(1);
    expect(alpha).toBeGreaterThanOrEqual(0);
    expect(alpha).toBeLessThan(1);
  });

  it('holds the world still while paused, and does not catch up afterwards', () => {
    const g = new Game(opts());
    g.frame(input());
    const t = g.time;
    const x = g.store.x[g.traveller.slot(g)];
    for (let i = 0; i < 300; i++) g.frame(input(1 / 72, true));
    expect(g.time).toBe(t);
    expect(g.store.x[g.traveller.slot(g)]).toBe(x);
    g.frame(input(0.5));
    expect(g.time - t).toBeLessThanOrEqual(MAX_STEPS_PER_FRAME * g.dt + 1e-9);
  });

  it('delivers a load made between frames on the next frame, then clears events each frame', () => {
    const g = new Game(opts());
    g.frame(input());
    expect(g.events.has('puzzle-start', 'n1-books')).toBe(true);
    g.frame(input());
    expect(g.events.has('puzzle-start')).toBe(false);
    g.goto(2);
    g.frame(input());
    expect(g.events.has('puzzle-start', 'n3-drip')).toBe(true);
  });

  it('gives a committed flat hand the bridge role, solid to the traveller, until released', () => {
    const g = new Game(opts());
    const left = createHandShadow('left');
    flatShadow(left, 0, 0);
    const q = new ShapeEventQueue();
    q.push('commit', 'left', 'flat', 0, 0.5, 0.4);
    g.frame({ dt: 1 / 60, paused: false, left, right: null, shapeEvents: q });
    expect(g.abilities.of('left').role).toBe(Role.Bridge);
    expect(g.solver.hands[0].mask & (1 << Kind.Traveller)).toBeTruthy();
    expect(g.events.has('ability-start', 'bridge')).toBe(true);
    q.clear();
    q.push('release', 'left', 'flat', 1, 0, 1, 'exit');
    g.frame({ dt: 1 / 60, paused: false, left, right: null, shapeEvents: q });
    expect(g.abilities.of('left').role).toBe(Role.None);
    expect(g.solver.hands[0].mask).toBe(0);
  });

  it('applies a commit exactly once even when its frame runs no step', () => {
    const g = new Game(opts());
    const q = new ShapeEventQueue();
    q.push('commit', 'right', 'fist', 0, 0.5, 0.4);
    g.frame({ dt: 0.001, paused: false, left: null, right: null, shapeEvents: q }); // no step yet
    expect(g.abilities.of('right').role).toBe(Role.None);
    q.clear();
    g.frame({ dt: 1 / 60, paused: false, left: null, right: null, shapeEvents: q });
    expect(g.abilities.of('right').role).toBe(Role.Rock);
  });

  it('moves on to the next puzzle after the outro and saves progress', () => {
    const h = new Headless(opts());
    h.pose('right', 'flat', 0, -0.27);
    expect(h.runUntil(() => h.game.puzzle.id === 'n2-ledge', 30)).toBe(true);
    expect(h.game.save.puzzle).toBe(1);
    expect(h.saw('puzzle-start', 'n2-ledge')).toBe(true);
  });

  it('restart and goto reload a puzzle from its layout', () => {
    const g = new Game(opts());
    for (let i = 0; i < 120; i++) g.frame(input());
    const start = -0.7;
    expect(g.store.x[g.traveller.slot(g)]).toBeGreaterThan(start);
    g.restart();
    expect(g.store.x[g.traveller.slot(g)]).toBeCloseTo(start, 9);
    g.goto(4);
    expect(g.puzzle.id).toBe('n5-castle');
    expect(g.fixtures.find('gate')?.active).toBe(true);
  });

  it('puts a fallen traveller back at its start, unhurt', () => {
    const h = new Headless(opts());
    // A bridge that is pulled away halfway across.
    h.pose('right', 'flat', 0, -0.27);
    expect(h.runUntil(() => Math.abs(h.game.store.x[h.game.traveller.slot(h.game)]) < 0.02, 20)).toBe(true);
    h.hide('right');
    expect(h.runUntil(() => h.saw('traveller-fell'), 5)).toBe(true);
    expect(h.game.store.x[h.game.traveller.slot(h.game)]).toBeCloseTo(-0.7, 6);
  });

  it('replays a seeded puzzle identically', () => {
    const play = () => {
      const save = newSave();
      save.puzzle = 1;
      const h = new Headless({ ...opts(), save, seed: 7 });
      h.run(8);
      return h.game;
    };
    const a = play(),
      b = play();
    expect(a.store.count).toBe(b.store.count);
    expect(new Uint8Array(a.store.y.buffer)).toEqual(new Uint8Array(b.store.y.buffer));
  });

  it('looks back at the player after standing at an obstacle for a while', () => {
    const h = new Headless(opts());
    h.run(12);
    expect(h.game.traveller.state).toBe('look-back');
  });

  it('keeps two games apart (each has its own puzzle state)', () => {
    const play = (other: boolean) => {
      const save = newSave();
      save.puzzle = 1;
      const a = new Game({ ...opts(), save, seed: 5 });
      const b = other ? new Game({ ...opts(), save: { ...save }, seed: 9 }) : null;
      for (let i = 0; i < 600; i++) {
        a.frame(input());
        b?.frame(input(1 / 90));
      }
      return a;
    };
    const alone = play(false),
      together = play(true);
    expect(new Uint8Array(together.store.y.buffer)).toEqual(new Uint8Array(alone.store.y.buffer));
    expect(together.traveller.state).toBe(alone.traveller.state);
  });
});
