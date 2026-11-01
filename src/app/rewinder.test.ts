import { describe, expect, it } from 'vitest';
import { Game } from '../game/game';
import { Headless } from '../game/headless';
import { createNight } from '../game/puzzles/index';
import { replay } from '../game/replay';
import { newSave } from '../game/save-state';
import { Rewinder } from './rewinder';

const opts = (puzzle = 0) => {
  const save = newSave();
  save.puzzle = puzzle;
  return { puzzles: createNight(), save, seed: 3 };
};
const columns = (g: Game) => ({
  x: Array.from(g.store.x),
  y: Array.from(g.store.y),
  vx: Array.from(g.store.vx),
  count: g.store.count,
  time: g.time,
});

/** Plays `seconds` of the puzzle with the Rewinder recording, as the app does. */
function play(seconds: number, puzzle = 0) {
  const h = new Headless(opts(puzzle));
  const rw = new Rewinder(72 * 30);
  rw.begin(puzzle, h.game.time);
  h.game.goto(puzzle); // the recording starts from a load, as the app's does
  h.recorder = rw.recorder;
  h.run(seconds);
  return { h, rw };
}

describe('Rewinder', () => {
  it('has nothing to go back through until a puzzle has begun and some of it is recorded', () => {
    const rw = new Rewinder();
    expect(rw.ready).toBe(false);
    expect(rw.seconds).toBe(0);
    const g = new Game(opts(0));
    expect(rw.rewind(g, 2)).toBe(0);
    rw.begin(0);
    expect(rw.ready).toBe(false); // begun, but no frames yet
  });

  it('takes the game back to exactly where an independent replay of the kept frames puts it', () => {
    const { h, rw } = play(8);
    const before = rw.seconds;
    expect(before).toBeGreaterThan(7.5);
    const gone = rw.rewind(h.game, 3);
    expect(gone).toBeGreaterThanOrEqual(3);
    expect(gone).toBeLessThan(3.1);
    expect(rw.seconds).toBeCloseTo(before - gone, 6);
    // The oracle: a fresh game given the same kept recording.
    const oracle = new Game(opts(0));
    replay(rw.recorder, oracle);
    expect(columns(h.game)).toEqual(columns(oracle));
  });

  it('matches the live game as it was at that moment (the same state, not just the same as another replay)', () => {
    const live = new Headless(opts(0));
    const rw = new Rewinder(72 * 30);
    rw.begin(0);
    live.game.goto(0);
    live.recorder = rw.recorder;
    live.run(4);
    const atFour = columns(live.game); // the moment to come back to
    const framesAtFour = rw.recorder.frames;
    live.run(5); // five more seconds go by
    expect(columns(live.game)).not.toEqual(atFour);
    const dropped = rw.recorder.frames - framesAtFour;
    let seconds = 0;
    for (let f = framesAtFour; f < rw.recorder.frames; f++) seconds += rw.recorder.dt[f];
    expect(dropped).toBeGreaterThan(0);
    rw.rewind(live.game, seconds - 1e-9);
    expect(rw.recorder.frames).toBe(framesAtFour);
    expect(columns(live.game)).toEqual(atFour);
  });

  it('goes right back to the start of the puzzle when asked for more than was played, and plays on from there', () => {
    const { h, rw } = play(2);
    const gone = rw.rewind(h.game, 60);
    expect(gone).toBeGreaterThan(1.9);
    expect(rw.recorder.frames).toBe(0);
    expect(h.game.puzzle.id).toBe('n1-books');
    expect(h.game.events.count).toBe(0); // the replay's news is not delivered again
  });

  it('can be rewound twice, and cleared', () => {
    const { h, rw } = play(6);
    rw.rewind(h.game, 2);
    const mid = rw.seconds;
    rw.rewind(h.game, 2);
    expect(rw.seconds).toBeLessThan(mid - 1.9);
    rw.clear();
    expect(rw.ready).toBe(false);
    expect(rw.rewind(h.game, 1)).toBe(0);
  });

  it('refuses when the recording ran out of room, and for a time that is not positive', () => {
    const h = new Headless(opts(0));
    const rw = new Rewinder(10);
    rw.begin(0);
    h.recorder = rw.recorder;
    h.run(1);
    expect(rw.recorder.full).toBe(true);
    expect(rw.ready).toBe(false);
    expect(rw.rewind(h.game, 1)).toBe(0);
    const ok = play(2);
    expect(ok.rw.rewind(ok.h.game, 0)).toBe(0);
    expect(ok.rw.rewind(ok.h.game, -3)).toBe(0);
    expect(ok.rw.rewind(ok.h.game, NaN)).toBe(0);
  });

  it('keeps the shapes the hands hold now: a rewind does not make the game forget a held flat hand', () => {
    const { h, rw } = play(1);
    h.pose('right', 'flat', 0, -0.27).run(3);
    const hand = h.game.abilities.hands[1];
    const role = hand.role;
    const shape = hand.shape;
    expect(shape).toBe('flat');
    rw.rewind(h.game, 2.5);
    expect(hand.role).toBe(role);
    expect(hand.shape).toBe(shape);
  });
});
