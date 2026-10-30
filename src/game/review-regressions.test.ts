// Regression tests for the bugs found in the first full review of the gameplay layer (10 Oct 2026).
// Each test names the bug it guards against.
import { describe, expect, it } from 'vitest';
import { createHandShadow } from '../engine/hands/hand-shadow';
import { ShapeEventQueue } from '../engine/hands/shape-events';
import { fistShadow } from '../engine/sim/shadow-shapes';
import { Role } from './abilities';
import { Game, type GameInput } from './game';
import { Headless } from './headless';
import { OTHER_SOLUTION } from './puzzle';
import { createNight } from './puzzles/index';
import { InputRecorder, replay } from './replay';
import { newSave } from './save-state';

const opts = (puzzle = 0, seed = 1) => {
  const save = newSave();
  save.puzzle = puzzle;
  return { puzzles: createNight(), save, seed };
};
const tx = (h: Headless) => h.game.store.x[h.game.traveller.slot(h.game)];

describe('review regressions', () => {
  it('a restart shuts the castle gate again and forgets which came first', () => {
    // (This guarded the bed puzzle's remembered bridges; the castle is the puzzle with state now.)
    const h = new Headless(opts(4));
    h.pose('right', 'fist', -0.3, 0.07);
    expect(h.runUntil(() => h.saw('puzzle-event', 'gate-open'), 5)).toBe(true);
    h.game.restart();
    h.run(0.1);
    expect(h.game.fixtures.find('gate')?.active).toBe(true);
    // Bridge first this time: the opening before the restart must not count as gate first.
    h.hide('right').pose('left', 'flat', 0.01, -0.27);
    expect(h.runUntil(() => tx(h) > 0.25, 30)).toBe(true);
    h.hide('left').pose('right', 'fist', -0.3, 0.07);
    expect(h.runUntil(() => h.saw('puzzle-solved'), 40)).toBe(true);
    expect(h.saw('puzzle-solved', 'bridge-first')).toBe(true);
  });

  it('a shape committed while paused takes its role on resume', () => {
    const g = new Game(opts());
    const q = new ShapeEventQueue();
    const input: GameInput = { dt: 1 / 72, paused: true, left: null, right: null, shapeEvents: q };
    q.push('commit', 'right', 'fist', 0, 0.5, 0.4);
    g.frame(input);
    q.clear();
    for (let i = 0; i < 10; i++) g.frame(input);
    input.paused = false;
    for (let i = 0; i < 3; i++) g.frame(input);
    expect(g.abilities.of('right').role).toBe(Role.Rock);
  });

  it('a win nobody designed is recorded as "other", not as the intended solution', () => {
    // Two fists side by side fill the tutorial's gap as stepping stones.
    const h = new Headless(opts(0));
    h.pose('left', 'fist', -0.05, -0.31).pose('right', 'fist', 0.05, -0.31);
    expect(h.runUntil(() => h.saw('puzzle-solved'), 30)).toBe(true);
    expect(h.saw('puzzle-solved', OTHER_SOLUTION)).toBe(true);
  });

  it('a fist below the counterweight plate does not press it', () => {
    const g = new Game(opts(4));
    const right = createHandShadow('right');
    fistShadow(right, 0, g.groundY - 0.2);
    const q = new ShapeEventQueue();
    q.push('commit', 'right', 'fist', 0, 0.5, 0.4);
    const input: GameInput = { dt: 1 / 60, paused: false, left: null, right, shapeEvents: q };
    for (let i = 0; i < 120; i++) {
      g.frame(input);
      q.clear();
    }
    expect(g.fixtures.find('gate')?.active).toBe(true);
    expect(g.fixtures.find('plate')?.value).toBe(0);
  });

  it('takes the hint down when a puzzle reloads while it shows', () => {
    const h = new Headless(opts(0));
    expect(h.runUntil(() => h.saw('hint-show'), 10)).toBe(true);
    const before = h.log.length;
    h.game.restart();
    h.run(0.1);
    expect(h.log.slice(before).some((e) => e.what === 'hint-hide:')).toBe(true);
  });

  it('a shape held through the outro keeps its role in the next puzzle', () => {
    const h = new Headless(opts(0));
    h.pose('right', 'flat', 0, -0.27);
    expect(h.runUntil(() => h.game.puzzle.id === 'n2-ledge', 30)).toBe(true);
    h.run(0.2);
    expect(h.game.abilities.of('right').role).toBe(Role.Bridge);
  });

  it('replays a session that used restart and goto, and leaves the options save untouched', () => {
    const o = opts(0, 4);
    const h = new Headless({ ...o, save: o.save });
    const rec = new InputRecorder(72 * 20);
    h.recorder = rec;
    h.pose('right', 'flat', 0, -0.27).run(4);
    rec.recordCommand('restart');
    h.game.restart();
    h.run(2);
    rec.recordCommand('goto', 2);
    h.game.goto(2);
    h.run(3);
    expect(o.save.puzzle).toBe(0);
    const g = new Game({ ...o, puzzles: createNight() });
    replay(rec, g);
    expect(g.puzzle.id).toBe('n3-drip');
    expect(new Uint8Array(g.store.x.buffer)).toEqual(new Uint8Array(h.game.store.x.buffer));
  });
});
