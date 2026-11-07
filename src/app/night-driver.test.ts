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
import { Touch } from '../engine/sim/solver';
import { StageFrame } from '../engine/stage/stage-frame';
import { PROP_TAG_BASE } from '../game/props';
import { LEDGE_TOP } from '../game/puzzles/bedroom';
import { firstStageOf } from '../game/puzzles/index';
import { KEEP_GATE_X, KEEP_MOAT, KEEP_PLATE_X, KEEP_STEP } from '../game/puzzles/n5-castle';
import { stageLine } from '../game/story';
import type { CutsceneData } from '../engine/sim/cutscene';
import {
  DIMMING_AT,
  INTERLUDE_HOLD_LIMIT_S,
  NIGHT_MOOD,
  NightDriver,
  RETURN_MOOD,
  RETURN_S,
  type NightHost,
} from './night-driver';

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
    woke: [] as number[],
    rewoundBy: [] as number[],
    rewards: [] as number[],
    scenery: [] as number[],
    said: [] as string[],
    notes: [] as string[],
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
    note: (text) => void state.notes.push(text),
    scenery: (index) => void state.scenery.push(index),
    reward: (index) => void state.rewards.push(index),
    wake: (index) => void state.woke.push(index),
    rewound: (seconds) => void state.rewoundBy.push(seconds),
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
  /** Moves a hand's shadow without a new commit (the shape is held). */
  const move = (hand: 'left' | 'right', shape: 'flat' | 'fist', x: number, y: number) => {
    const sh = hand === 'left' ? left : right;
    if (shape === 'flat') flatShadow(sh, x, y);
    else fistShadow(sh, x, y);
  };
  const hide = (hand: 'left' | 'right') => {
    shapes.push('release', hand, 'flat', 0, 0, 1, 'exit');
    if (hand === 'left') shadowL = null;
    else shadowR = null;
  };
  return { driver, host, state, calls, saves, run, pose, move, hide };
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
    expect(state.scenery).toEqual([0]); // the first puzzle's scenery is up
    expect(state.said).toEqual([PUZZLE_LINES[0]]);
  });

  // The candle on the bed tray, as main.ts places it for eyes at 1.2 m: 0.45 m ahead, its flame at 0.805 m.
  it.each([
    ['the stand-in lantern', undefined],
    ['the candle on the bed tray', [0, 0.805, -0.45]],
  ])('casts every stage from %s so the traveller stands on a prop', (_, flameAt) => {
    const { driver, run } = setup(flameAt);
    driver.start();
    const game = driver.game!;
    for (let i = 0; i < game.puzzleCount; i++) {
      game.goto(i);
      run(0.5);
      expect(game.layout.problems, game.puzzle.id).toEqual([]);
      expect(game.solver.terrain.tag[game.traveller.standingOnId(game)], game.puzzle.id).toBeGreaterThanOrEqual(
        PROP_TAG_BASE,
      );
    }
  });

  it("solves the tutorial with a flat hand and saves it; the lamp waits for the level's last stage", () => {
    const { driver, state, calls, saves, run, pose } = setup();
    driver.start();
    run(4);
    pose('right', 'flat', 0, LEDGE_TOP - 0.01);
    expect(run(25, () => calls.includes('solved'))).toBe(true);
    expect(state.rewards).toEqual([0]); // the level's own reward plays on the paper
    expect(state.woke).toEqual([]); // but the level goes on: no spark yet
    expect(state.mood).toBe(NIGHT_MOOD[0]);
    expect(state.said).not.toContain(WAKE_LINES[0]);
    expect(saves.data.puzzles['n1-books']?.solved).toBe(true);
  });

  it("moves on to the level's next stage with new props and its own line: no scenery or mood change", () => {
    const { driver, state, run, pose } = setup();
    driver.start();
    run(4);
    pose('right', 'flat', 0, LEDGE_TOP - 0.01);
    expect(run(30, () => driver.game!.puzzle.id === 'n1-stones')).toBe(true);
    expect(state.props).toBe(3);
    expect(state.scenery).toEqual([0]);
    expect(state.said).toEqual([PUZZLE_LINES[0], stageLine(0, 1)]);
    expect(state.awake).toBe(0);
  });

  it("wakes the level's sleeper and warms the wall one step when its last stage is solved", () => {
    const { driver, state, calls, run } = setup();
    driver.start();
    const game = driver.game!;
    const last = firstStageOf(1) - 1;
    game.goto(last);
    run(DT);
    solveNow(driver, last);
    expect(calls).toContain('solved');
    expect(state.woke).toEqual([0]); // the spark goes to the lamp
    expect(state.rewards).toEqual([0]);
    expect(state.said).toContain(WAKE_LINES[0]); // and says it woke
    expect(state.mood).toBe(NIGHT_MOOD[1]);
  });

  it('counts the ways found and says nothing about another way after the tutorial, which has only one', () => {
    const { driver, state, calls, run, pose } = setup();
    driver.start();
    expect(driver.waysFound()).toEqual({ found: 0, total: 28 });
    run(4);
    pose('right', 'flat', 0, LEDGE_TOP - 0.01);
    expect(run(25, () => calls.includes('solved'))).toBe(true);
    expect(driver.waysFound()).toEqual({ found: 1, total: 28 });
    expect(state.notes).toEqual([]);
  });

  it("hints that other ways exist when a level's last stage is solved with ways left, not after each stage", () => {
    const { driver, state, run } = setup();
    driver.start();
    const game = driver.game!;
    const first = firstStageOf(1);
    game.goto(first);
    run(DT);
    game.save.solutions[game.puzzle.id] = [game.puzzle.solutions[0]]; // one way found, as a solve records it
    solveNow(driver, first);
    expect(state.notes).toEqual([]); // the level goes on
    const last = firstStageOf(2) - 1;
    game.goto(last);
    run(DT);
    game.save.solutions[game.puzzle.id] = [game.puzzle.solutions[0]];
    solveNow(driver, last);
    expect(state.notes).toEqual(['There are other ways through.']); // 2 of the level's 6
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
    driver.game!.goto(firstStageOf(DIMMING_AT) - 1);
    run(DT);
    expect(calls).not.toContain('dim');
    driver.game!.goto(firstStageOf(DIMMING_AT));
    run(DT);
    expect(calls).toContain('dim');
    expect(state.away).toBe(true);
    expect(state.mood).toBe(NIGHT_MOOD[DIMMING_AT]);
    expect(state.said).toContain(DIMMING_LINE);
  });

  it('ends the night: the return, then the ending, then the end screen', () => {
    const { driver, state, calls, run, pose, move, hide } = setup();
    driver.start();
    const game = driver.game!;
    game.goto(game.puzzleCount - 1); // the keep: counterweight, moat, then a lift up the step
    run(DT);
    const x = () => game.store.x[game.traveller.slot(game)];
    pose('right', 'fist', KEEP_PLATE_X, 0.07);
    run(1.5);
    hide('right');
    pose('left', 'flat', (KEEP_MOAT[0] + KEEP_MOAT[1]) / 2, LEDGE_TOP - 0.01);
    expect(run(30, () => x() > KEEP_GATE_X)).toBe(true);
    hide('left');
    run(0.6);
    const stepX = (KEEP_STEP[0] + KEEP_STEP[1]) / 2;
    let y = LEDGE_TOP - 0.065;
    pose('right', 'fist', stepX, y);
    const lift = () => {
      if (game.traveller.standingOn(game) === Touch.Hand && y < LEDGE_TOP + 0.075) {
        y += 0.002;
        move('right', 'fist', stepX, y);
      }
      return game.complete;
    };
    expect(run(60, lift)).toBe(true);
    expect(state.mood).toBe(RETURN_MOOD);
    expect(state.woke).toContain(4); // the last spark goes to the window
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

  it('turns the night back: the puzzle is reloaded and its recorded input played again, and the app is told', () => {
    const { driver, state, run } = setup();
    expect(driver.rewind(2)).toBe(false); // before the night starts
    driver.start();
    run(6);
    const game = driver.game!;
    const before = game.time;
    expect(driver.rewind(2)).toBe(true);
    expect(state.rewoundBy).toHaveLength(1);
    expect(state.rewoundBy[0]).toBeGreaterThanOrEqual(2);
    expect(game.time).toBeLessThan(before - 1.5); // the clock is back too
    run(2); // and play goes on from there
    expect(game.time).toBeGreaterThan(before - 1.5);
    expect(driver.rewind(0)).toBe(false);
  });

  it('does not rewind on a fall unless it is switched on', () => {
    const { driver, state, run } = setup();
    driver.start();
    run(4);
    expect(driver.rewindOnFall).toBe(false);
    // (A real fall is hard to stage in a unit test; the driver notes one by setting `fell` when the game's event comes.)
    const fall = () => ((driver as unknown as { fell: boolean }).fell = true);
    fall();
    run(0.05);
    expect(state.rewoundBy).toHaveLength(0);
    driver.rewindOnFall = true;
    fall();
    run(0.05);
    expect(state.rewoundBy).toHaveLength(1);
  });
});

describe('NightDriver interludes', () => {
  function withInterludes() {
    const s = setup();
    const played: { data: CutsceneData; onDone: () => void }[] = [];
    s.host.interlude = (data, onDone) => void played.push({ data, onDone });
    return { ...s, played };
  }

  it("plays the sleeper's stir moving on to a later stage, holding the game until it ends", () => {
    const { driver, played, run } = withInterludes();
    driver.start();
    run(DT);
    expect(played).toEqual([]); // the first puzzle: the opening has just played
    const game = driver.game!;
    game.goto(1);
    run(DT);
    expect(played.map((p) => p.data.id)).toEqual(['stir-0-1']);
    expect(driver.inInterlude).toBe(true);
    const t = game.time;
    run(2);
    expect(game.time).toBe(t); // held
    played[0].onDone();
    expect(driver.inInterlude).toBe(false);
    run(1);
    expect(game.time).toBeGreaterThan(t + 0.9);
  });

  it("plays the next level's chapter card on moving on to it, and nothing on a restart, a jump or a resume", () => {
    const { driver, played, run } = withInterludes();
    driver.start();
    const game = driver.game!;
    game.goto(firstStageOf(1) - 1);
    run(DT);
    expect(played).toEqual([]); // a jump
    game.goto(firstStageOf(1));
    run(DT);
    expect(played.map((p) => p.data.id)).toEqual(['chapter-1']);
    played[0].onDone();
    game.restart();
    run(DT);
    expect(played).toHaveLength(1);
  });

  it('lets an older interlude ending late leave a newer one holding, and gives up on one that never ends', () => {
    const { driver, played, run } = withInterludes();
    driver.start();
    run(DT);
    const game = driver.game!;
    game.goto(1);
    run(DT);
    game.goto(2);
    run(DT);
    expect(played.map((p) => p.data.id)).toEqual(['stir-0-1', 'stir-0-2']);
    played[0].onDone();
    expect(driver.inInterlude).toBe(true);
    run(INTERLUDE_HOLD_LIMIT_S + 0.1);
    expect(driver.inInterlude).toBe(false);
  });

  it('stops holding when the night begins again', () => {
    const { driver, played, run } = withInterludes();
    driver.start();
    run(DT);
    driver.game!.goto(1);
    run(DT);
    expect(played).toHaveLength(1);
    driver.again();
    expect(driver.inInterlude).toBe(false);
  });
});

describe('NightDriver travel scenes', () => {
  it('asks for a travel scene when the night moves on to the next level, and not for a stage, the first puzzle, a restart or a jump', () => {
    const { driver, host, run } = setup();
    const travelled: [number, number][] = [];
    host.travel = (from, to) => void travelled.push([from, to]);
    driver.start();
    run(DT);
    expect(travelled).toEqual([]); // the first puzzle: no walk (the opening has just played)
    for (let i = 1; i < firstStageOf(1); i++) {
      driver.game!.goto(i);
      run(DT);
    }
    expect(travelled).toEqual([]); // the next stages of the same level: no walk
    driver.game!.goto(firstStageOf(1));
    run(DT);
    expect(travelled).toEqual([[0, 1]]); // moving on: the first land wakes, the traveller walks into the second
    driver.game!.restart();
    run(DT);
    expect(travelled).toEqual([[0, 1]]); // a restart is not a walk
    driver.game!.goto(firstStageOf(3));
    run(DT);
    expect(travelled).toEqual([[0, 1]]); // nor is a jump over a level
    driver.game!.goto(firstStageOf(4) - 1);
    run(DT);
    driver.game!.goto(firstStageOf(4));
    run(DT);
    expect(travelled).toEqual([
      [0, 1],
      [3, 4],
    ]);
  });
});

/** Delivers a solve of puzzle `index` (the current one) to the driver now, as the game reports one. */
function solveNow(driver: NightDriver, index: number): void {
  const game = driver.game!;
  (game.events as unknown as { push(t: string, id: string, time: number, a: number, b: number): void }).push(
    'puzzle-solved',
    game.puzzle.solutions[0],
    game.time,
    index,
    1,
  );
  (driver as unknown as { readEvents(g: unknown): void }).readEvents(game);
}
