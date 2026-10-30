import { DIMMING_LINE, PUZZLE_LINES, RETURN_LINE, WAKE_LINES } from './story';
import { describe, expect, it } from 'vitest';
import { createHandShadow, type HandShadow } from '../engine/hands/hand-shadow';
import { ShapeEventQueue } from '../engine/hands/shape-events';
import type { Shape } from '../engine/hands/shapes';
import { SaveManager } from '../engine/services/saves/save-manager';
import { MemoryStore } from '../engine/services/saves/storage';
import { REAL_WALL_SHADOW_SETTINGS } from '../engine/shadow/pure/real-wall';
import { placeLantern } from '../engine/shadow/pure/test-rig';
import { fistShadow, flatShadow } from '../engine/sim/shadow-shapes';
import { StageFrame } from '../engine/stage/stage-frame';
import { PROP_TAG_BASE } from '../game/props';
import { LEDGE_TOP } from '../game/puzzles/bedroom';
import { DIMMING_AT, NIGHT_MOOD, NightDriver, RETURN_MOOD, RETURN_S, type NightHost } from './night-driver';

const DT = 1 / 72;

/** The real wall and a flame placed as main.ts does, a fresh save, and a host that records what it is asked. */
function setup(flameAt?: readonly number[]) {
  const head = [0, 1.2, 0];
  const stage = new StageFrame();
  stage.placeInFront(head, 0);
  const flame = new Float64Array(3);
  if (flameAt) flame.set(flameAt);
  else placeLantern(head, 0, flame);
  const calls: string[] = [];
  const state = {
    awake: -1,
    said: [] as string[],
    mood: 0,
    props: 0,
    hint: '' as Shape | '',
    perched: false,
    away: false,
    ended: false,
  };
  const saves = new SaveManager({ store: new MemoryStore(), prefix: 'test' });
  saves.load();
  const host: NightHost = {
    stage,
    flame,
    blend: () => REAL_WALL_SHADOW_SETTINGS.blend ?? 0.65,
    saves,
    setProps: (props) => void (state.props = props.length),
    showHint: (shape) => void (state.hint = shape),
    hideHint: () => void (state.hint = ''),
    perchKindred: () => {
      state.perched = true;
      calls.push('perch');
    },
    releaseKindred: () => void (state.perched = false),
    dim: () => void calls.push('dim'),
    setKindredAway: (away) => void (state.away = away),
    setMood: (goal) => void (state.mood = goal),
    say: (text) => void state.said.push(text),
    setAwake: (count) => void (state.awake = count),
    solved: () => void calls.push('solved'),
    twinkle: () => void calls.push('twinkle'),
    playEnding: (onDone) => {
      calls.push('ending');
      onDone();
    },
    nightOver: () => void (state.ended = true),
  };
  const driver = new NightDriver(host);
  const left = createHandShadow('left');
  const right = createHandShadow('right');
  const shapes = new ShapeEventQueue();
  let shadowL: HandShadow | null = null;
  let shadowR: HandShadow | null = null;
  const run = (seconds: number, until?: () => boolean) => {
    for (let t = 0; t < seconds; t += DT) {
      driver.frame(DT, false, shadowL, shadowR, shapes, true, true);
      shapes.clear();
      if (until?.()) return true;
    }
    return false;
  };
  const pose = (hand: 'left' | 'right', shape: 'flat' | 'fist', x: number, y: number) => {
    const sh = hand === 'left' ? left : right;
    if (shape === 'flat') flatShadow(sh, x, y);
    else fistShadow(sh, x, y);
    if (hand === 'left') shadowL = sh;
    else shadowR = sh;
    shapes.push('commit', hand, shape, 0, 0.5, 0.4);
  };
  const hide = (hand: 'left' | 'right') => {
    shapes.push('release', hand, 'flat', 0, 0, 1, 'exit');
    if (hand === 'left') shadowL = null;
    else shadowR = null;
  };
  return { driver, host, state, calls, saves, run, pose, hide };
}

describe('NightDriver', () => {
  it('starts at the first puzzle, draws its props and sets the first mood', () => {
    const { driver, state, run } = setup();
    driver.start();
    run(DT);
    expect(driver.game?.puzzle.id).toBe('n1-books');
    expect(state.props).toBe(2);
    expect(state.mood).toBe(NIGHT_MOOD[0]);
    expect(state.awake).toBe(0); // nothing in the room is lit yet
    expect(state.said).toEqual([PUZZLE_LINES[0]]);
  });

  // The candle on the bed tray, as main.ts places it for eyes at 1.2 m: 0.45 m ahead, its flame at 0.805 m.
  it.each([
    ['the stand-in lantern', undefined],
    ['the candle on the bed tray', [0, 0.805, -0.45]],
  ])('casts every puzzle from %s so the traveller stands on a prop', (_, flameAt) => {
    const { driver, run } = setup(flameAt);
    driver.start();
    const game = driver.game!;
    for (let i = 0; i < 5; i++) {
      game.goto(i);
      run(0.5);
      expect(game.layout.problems, game.puzzle.id).toEqual([]);
      expect(game.solver.terrain.tag[game.traveller.standingOnId(game)], game.puzzle.id).toBeGreaterThanOrEqual(
        PROP_TAG_BASE,
      );
    }
  });

  it('solves the tutorial with a flat hand, saves it, and warms the wall one step', () => {
    const { driver, state, calls, saves, run, pose } = setup();
    driver.start();
    run(4);
    pose('right', 'flat', 0, LEDGE_TOP - 0.01);
    expect(run(25, () => calls.includes('solved'))).toBe(true);
    expect(state.mood).toBe(NIGHT_MOOD[1]);
    expect(state.awake).toBe(1); // the room lights its first thing
    expect(state.said).toContain(WAKE_LINES[0]); // and says it woke
    expect(saves.data.puzzles['n1-books']?.solved).toBe(true);
  });

  it('shows the outline, then perches the kindred, while the player waits', () => {
    const { driver, state, calls, run } = setup();
    driver.start();
    expect(run(5, () => state.hint !== '')).toBe(true);
    expect(state.hint).toBe('flat');
    expect(run(25, () => calls.includes('perch'))).toBe(true);
    expect(state.perched).toBe(true);
  });

  it('plays the dimming moving on to the fan, and keeps the kindred away there', () => {
    const { driver, state, calls, run } = setup();
    driver.start();
    driver.game!.goto(DIMMING_AT - 1);
    run(DT);
    expect(calls).not.toContain('dim');
    driver.game!.goto(DIMMING_AT);
    run(DT);
    expect(calls).toContain('dim');
    expect(state.away).toBe(true);
    expect(state.mood).toBe(NIGHT_MOOD[DIMMING_AT]);
    expect(state.said).toContain(DIMMING_LINE);
  });

  it('ends the night: the return, then the ending, then the end screen', () => {
    const { driver, state, calls, run, pose, hide } = setup();
    driver.start();
    driver.game!.goto(4);
    run(DT);
    pose('right', 'fist', -0.3, 0.07);
    run(1.5);
    hide('right');
    pose('left', 'flat', 0.01, LEDGE_TOP - 0.01);
    expect(run(40, () => driver.game!.complete)).toBe(true);
    expect(state.mood).toBe(RETURN_MOOD);
    expect(state.awake).toBe(NIGHT_MOOD.length); // everything in the room is lit
    expect(state.said).toContain(RETURN_LINE);
    expect(state.away).toBe(false);
    expect(state.perched).toBe(true);
    expect(calls).not.toContain('ending');
    run(RETURN_S + 0.1);
    expect(calls).toContain('ending');
    expect(state.ended).toBe(true);
  });

  it('begins a new night from the first puzzle after a finished one', () => {
    const { driver, saves } = setup();
    saves.completeChapter(1);
    driver.start();
    expect(driver.game?.puzzle.id).toBe('n1-books');
    expect(driver.game?.complete).toBe(false);
  });
});
