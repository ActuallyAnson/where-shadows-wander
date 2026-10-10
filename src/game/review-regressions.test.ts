// Regression tests for the bugs found in the first full review of the gameplay layer (10 Oct 2026).
// Each test names the bug it guards against.
import { describe, expect, it } from 'vitest';
import chapter1 from '../../public/scenes/chapter-1.iwsdk.scene.json';
import { createHandShadow } from '../engine/hands/hand-shadow';
import { ShapeEventQueue } from '../engine/hands/shape-events';
import { fistShadow } from '../engine/sim/shadow-shapes';
import { Role } from './abilities';
import { Game, type GameInput } from './game';
import { Headless } from './headless';
import { OTHER_SOLUTION } from './puzzle';
import { createChapter1 } from './puzzles/index';
import { InputRecorder, replay } from './replay';
import { newSave } from './save-state';

const opts = (puzzle = 0, seed = 1) => {
  const save = newSave();
  save.puzzle = puzzle;
  return { chapter: chapter1, puzzles: createChapter1(), save, seed };
};
const tx = (h: Headless) => h.game.store.x[h.game.traveller.slot(h.game)];

describe('review regressions', () => {
  it('a restart forgets what the rabbit did (no rope without a rabbit)', () => {
    const h = new Headless(opts(3));
    h.pose('left', 'rabbit', -0.5, -0.1).run(1.5).hide('left');
    expect(h.runUntil(() => h.saw('puzzle-event', 'rope-lowered'), 10)).toBe(true);
    h.game.restart();
    const before = h.log.length;
    h.run(3);
    expect(h.log.slice(before).some((e) => e.what === 'puzzle-event:rope-lowered')).toBe(false);
  });

  it('a restart forgets the fox dug under the gate (the gate is shut again)', () => {
    const h = new Headless(opts(5));
    h.pose('left', 'fox', -0.3, -0.15).run(1.5).hide('left');
    expect(h.runUntil(() => h.saw('puzzle-event', 'dig'), 15)).toBe(true);
    h.game.restart();
    h.run(1);
    expect(h.game.fixtures.find('gate')?.active).toBe(true);
    expect(h.game.fixtures.find('tunnel')).toBeNull();
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
    // One bridge carried along under the traveller ferries it over the chasm.
    const h = new Headless(opts(3));
    h.pose('right', 'flat', -0.1, -0.32);
    const ferry = () => {
      const x = tx(h);
      if (x > -0.25) h.move('right', Math.min(x, 0.2), -0.32);
    };
    expect(h.runUntil(() => h.saw('puzzle-solved'), 40, ferry)).toBe(true);
    expect(h.saw('puzzle-solved', OTHER_SOLUTION)).toBe(true);
  });

  it('a fist below the weight plate does not press it', () => {
    const g = new Game(opts(5));
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
    h.pose('right', 'flat', 0, -0.32);
    expect(h.runUntil(() => h.game.puzzle.id === 'p2-rain', 30)).toBe(true);
    h.run(0.2);
    expect(h.game.abilities.of('right').role).toBe(Role.Bridge);
  });

  it('the fox walks on once the gap it waits at is bridged', () => {
    const h = new Headless(opts(3));
    h.pose('left', 'fox', -0.5, -0.1).run(1.5).hide('left').run(3);
    expect(h.game.companions.fox.state).toBe('wait');
    h.pose('left', 'flat', -0.1, -0.32).pose('right', 'flat', 0.18, -0.32).run(1);
    expect(h.game.companions.fox.state).toBe('walk');
  });

  it('replays a session that used restart and goto, and leaves the options save untouched', () => {
    const o = opts(0, 4);
    const h = new Headless({ ...o, save: o.save });
    const rec = new InputRecorder(72 * 20);
    h.recorder = rec;
    h.pose('right', 'flat', 0, -0.32).run(4);
    rec.recordCommand('restart');
    h.game.restart();
    h.run(2);
    rec.recordCommand('goto', 2);
    h.game.goto(2);
    h.run(3);
    expect(o.save.puzzle).toBe(0);
    const g = new Game({ ...o, puzzles: createChapter1() });
    replay(rec, g);
    expect(g.puzzle.id).toBe('p3-wind');
    expect(new Uint8Array(g.store.x.buffer)).toEqual(new Uint8Array(h.game.store.x.buffer));
  });
});
