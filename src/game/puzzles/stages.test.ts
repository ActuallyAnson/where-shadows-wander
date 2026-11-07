// The harder stages of each level, played headless from scripted hands, as night.test.ts plays the
// first stage of each: each is solved every way it should be, the right solution is recorded, and
// one way that should not work does not.
import { describe, expect, it } from 'vitest';
import type { Handedness } from '../../engine/hands/hand';
import type { Shape } from '../../engine/hands/shapes';
import { Touch } from '../../engine/sim/solver';
import { Headless } from '../headless';
import { newSave } from '../save-state';
import { LEDGE_TOP } from './bedroom';
import { createNight, createNightLevels, LEVEL_COUNT } from './index';
import { STONES_GAPS, WIDE_GAP } from './n1-books';
import { STAIR_GAPS, STEP_BRIDGE_GAP, STEP_GAP, TABLE_RISE } from './n2-ledge';
import { DRIP_GAP, GAP_DRIPS } from './n3-drip';
import { FAN_STEP_GAP, STEP_WIND } from './n4-fan';
import { KEEP_GATE_X, KEEP_MOAT, KEEP_PLATE_X, KEEP_STEP, WIDE_MOAT } from './n5-castle';

function at(id: string, seed = 1) {
  const puzzles = createNight();
  const save = newSave();
  save.puzzle = puzzles.findIndex((p) => p.id === id);
  if (save.puzzle < 0) throw new Error(`no puzzle ${id}`);
  return new Headless({ puzzles, save, seed });
}

const travellerX = (h: Headless) => h.game.store.x[h.game.traveller.slot(h.game)];
const travellerFeet = (h: Headless) => {
  const g = h.game,
    s = g.traveller.slot(g);
  return g.store.y[s] - g.store.radius[s];
};
const solved = (h: Headless) => () => h.saw('puzzle-solved');

/** A flat hand's shadow centred this far below a ledge's top lies level with it. */
const FLAT_BELOW = 0.01;
/** A fist's shadow centred this far below a ledge's top has its top level with it. */
const FIST_BELOW = 0.065;
const BRIDGE_Y = LEDGE_TOP - FLAT_BELOW;
/** A fist resting on a counterweight plate at x. */
const onPlate = (x: number): [number, number] => [x, 0.07];

/**
 * A scripted hand that carries the traveller: holds `shape` at (x, y), and while the traveller
 * stands on it moves it toward (toX, toY), a little each frame. Returns the per-frame function.
 */
function carry(h: Headless, hand: Handedness, shape: Shape, x: number, y: number, toX: number, toY: number) {
  let cx = x,
    cy = y;
  h.pose(hand, shape, cx, cy);
  return () => {
    if (h.game.traveller.standingOn(h.game) !== Touch.Hand) return;
    if (cx < toX) cx = Math.min(toX, cx + 0.0015);
    if (cy < toY) cy = Math.min(toY, cy + 0.002);
    h.move(hand, cx, cy);
  };
}

describe('the levels', () => {
  it('are five, of three stages each, every stage marked with its level and stage', () => {
    const levels = createNightLevels();
    expect(levels.length).toBe(LEVEL_COUNT);
    for (const stages of levels) expect(stages.length).toBe(3);
    const night = createNight();
    expect(night.length).toBe(15);
    night.forEach((p, i) => {
      expect(p.level).toBe(Math.floor(i / 3));
      expect(p.stage).toBe(i % 3);
    });
    expect(new Set(night.map((p) => p.id)).size).toBe(night.length);
  });

  it('tells the game where each level ends', () => {
    const h = at('n1-books');
    const g = h.game;
    expect([0, 1, 2, 3].map((i) => g.levelOf(i))).toEqual([0, 0, 0, 1]);
    expect([0, 1, 2, 14].map((i) => g.endsLevel(i))).toEqual([false, false, true, true]);
  });

  it('moves on from a stage to the next stage of the same level', () => {
    const h = at('n1-books');
    h.run(6).pose('right', 'flat', 0, BRIDGE_Y);
    expect(h.runUntil(() => h.game.puzzle.id === 'n1-stones', 30)).toBe(true);
    expect(h.game.save.puzzle).toBe(1);
  });
});

describe('1.2: stepping stones', () => {
  const [a, b] = STONES_GAPS;
  const mid = (g: readonly [number, number]) => (g[0] + g[1]) / 2;

  it('is solved by one bridge moved from the first gap to the second', () => {
    const h = at('n1-stones');
    h.pose('right', 'flat', mid(a), BRIDGE_Y);
    const follow = () => {
      if (travellerX(h) > a[1] + 0.06) h.move('right', mid(b), BRIDGE_Y);
    };
    expect(h.runUntil(solved(h), 40, follow)).toBe(true);
    expect(h.saw('puzzle-solved', 'bridge')).toBe(true);
  });

  it('is not solved by a bridge left over the first gap, and the hint moves to the second', () => {
    const h = at('n1-stones');
    h.pose('right', 'flat', mid(a), BRIDGE_Y);
    h.run(30);
    expect(travellerX(h)).toBeGreaterThan(a[1]);
    expect(travellerX(h)).toBeLessThan(b[0]);
    expect(h.saw('hint-show', 'flat')).toBe(true);
    expect(h.saw('puzzle-solved')).toBe(false);
  });
});

describe('1.3: the wide gap', () => {
  const half = WIDE_GAP / 2;

  it.each([
    ['flat', 'bridge', BRIDGE_Y, -half + 0.15],
    ['fist', 'rock', LEDGE_TOP - FIST_BELOW, -half + 0.04],
  ] as const)('is solved by carrying the traveller across on a %s (%s)', (shape, way, y, x) => {
    const h = at('n1-wide');
    const far = shape === 'flat' ? half - 0.15 : half - 0.03;
    expect(h.runUntil(solved(h), 60, carry(h, 'right', shape, x, y, far, y))).toBe(true);
    expect(h.saw('puzzle-solved', way)).toBe(true);
  });

  it('is not solved by a bridge held still at the near edge', () => {
    const h = at('n1-wide');
    h.pose('right', 'flat', -half + 0.15, BRIDGE_Y);
    h.run(30);
    expect(h.game.traveller.standingOn(h.game)).toBe(Touch.Hand);
    expect(h.saw('puzzle-solved')).toBe(false);
  });
});

describe('2.2: the stair', () => {
  const [a, b] = STAIR_GAPS;
  const mid = (g: readonly [number, number]) => (g[0] + g[1]) / 2;

  it.each([
    ['fist', 'rock', FIST_BELOW],
    ['flat', 'bridge', FLAT_BELOW],
  ] as const)('is solved by two lifts on a %s (%s)', (shape, way, below) => {
    const h = at('n2-stair');
    let lift = carry(h, 'right', shape, mid(a), LEDGE_TOP - below, mid(a), LEDGE_TOP - below + TABLE_RISE + 0.02);
    let second = false;
    const follow = () => {
      if (!second && travellerX(h) > a[1] + 0.06) {
        second = true;
        const y = LEDGE_TOP + TABLE_RISE - below;
        lift = carry(h, 'right', shape, mid(b), y, mid(b), y + TABLE_RISE + 0.02);
      }
      lift();
    };
    expect(h.runUntil(solved(h), 60, follow)).toBe(true);
    expect(h.saw('puzzle-solved', way)).toBe(true);
  });

  it('is not solved by one lift: the traveller waits at the dresser', () => {
    const h = at('n2-stair');
    const y = LEDGE_TOP - FIST_BELOW;
    h.run(40, carry(h, 'right', 'fist', mid(a), y, mid(a), y + TABLE_RISE + 0.02));
    expect(travellerX(h)).toBeGreaterThan(a[1]);
    expect(travellerX(h)).toBeLessThan(b[1]);
    expect(h.saw('puzzle-solved')).toBe(false);
  });
});

describe('2.3: the bridge and the step', () => {
  const bridgeX = (STEP_BRIDGE_GAP[0] + STEP_BRIDGE_GAP[1]) / 2;
  const stepX = (STEP_GAP[0] + STEP_GAP[1]) / 2;

  it.each([
    ['fist', 'rock', FIST_BELOW],
    ['flat', 'bridge', FLAT_BELOW],
  ] as const)('is solved by a bridge, then a lift on a %s (%s)', (shape, way, below) => {
    const h = at('n2-step-bridge');
    h.pose('right', 'flat', bridgeX, BRIDGE_Y);
    let lift: (() => void) | null = null;
    const follow = () => {
      if (!lift && travellerX(h) > STEP_BRIDGE_GAP[1] + 0.06) {
        const y = LEDGE_TOP - below;
        lift = carry(h, 'right', shape, stepX, y, stepX, y + TABLE_RISE + 0.02);
      }
      lift?.();
    };
    expect(h.runUntil(solved(h), 60, follow)).toBe(true);
    expect(h.saw('puzzle-solved', way)).toBe(true);
  });

  it('asks for a flat hand at the gap, and a fist at the step once over it', () => {
    const h = at('n2-step-bridge');
    h.run(30);
    expect(h.saw('hint-show', 'flat')).toBe(true);
    expect(h.saw('hint-show', 'fist')).toBe(false);
    h.pose('right', 'flat', bridgeX, BRIDGE_Y);
    expect(h.runUntil(() => travellerX(h) > STEP_BRIDGE_GAP[1] + 0.06, 20)).toBe(true);
    h.hide('right').run(30);
    expect(h.saw('hint-show', 'fist')).toBe(true);
    expect(h.saw('puzzle-solved')).toBe(false);
  });
});

describe('3.2: the hanging plant', () => {
  it('keeps the traveller out of the drips', () => {
    const h = at('n3-hanging');
    h.run(20);
    expect(h.saw('puzzle-solved')).toBe(false);
    expect(travellerX(h)).toBeLessThan(0.1);
  });

  it('is solved by carrying a cup over the traveller', () => {
    const h = at('n3-hanging');
    const follow = () => h.pose('right', 'cup', travellerX(h) + 0.05, 0);
    expect(h.runUntil(solved(h), 60, follow)).toBe(true);
    expect(h.saw('puzzle-solved', 'cup')).toBe(true);
  });

  it('is solved by carrying a flat roof over the traveller', () => {
    const h = at('n3-hanging');
    const follow = () => h.pose('right', 'flat', travellerX(h) + 0.05, 0.05);
    expect(h.runUntil(solved(h), 60, follow)).toBe(true);
    expect(h.saw('puzzle-solved', 'roof')).toBe(true);
  });

  it('is not solved by a roof held still in the middle', () => {
    const h = at('n3-hanging');
    h.pose('right', 'flat', 0, 0.12);
    h.run(40);
    expect(h.saw('puzzle-solved')).toBe(false);
  });
});

describe('3.3: drips and a gap', () => {
  const gapX = (DRIP_GAP[0] + DRIP_GAP[1]) / 2;

  it.each([
    ['cup', 'cup', 0],
    ['flat', 'roof', 0.05],
  ] as const)('is solved by a %s over the drips, then a bridge over the gap (%s)', (shape, way, y) => {
    const h = at('n3-drip-gap');
    let bridged = false;
    const follow = () => {
      if (bridged || travellerX(h) > GAP_DRIPS.right + 0.08) {
        bridged = true;
        h.pose('right', 'flat', gapX, BRIDGE_Y);
      } else h.pose('right', shape, travellerX(h) + 0.05, y);
    };
    expect(h.runUntil(solved(h), 60, follow)).toBe(true);
    expect(h.saw('puzzle-solved', way)).toBe(true);
  });

  it('is not solved by the cover alone: the traveller waits at the gap, and the hint turns to the flat hand', () => {
    const h = at('n3-drip-gap');
    const follow = () => {
      if (travellerX(h) < GAP_DRIPS.right + 0.08) h.pose('right', 'cup', travellerX(h) + 0.05, 0);
      else h.hide('right');
    };
    h.run(50, follow);
    expect(travellerX(h)).toBeLessThan(DRIP_GAP[0]);
    expect(h.saw('hint-show', 'flat')).toBe(true);
    expect(h.saw('puzzle-solved')).toBe(false);
  });
});

describe('4.2: two fans', () => {
  it('blows the traveller back on its own', () => {
    const h = at('n4-two-fans');
    h.run(20);
    expect(travellerX(h)).toBeLessThan(-0.4);
    expect(h.saw('puzzle-solved')).toBe(false);
  });

  it('is solved by a windbreak carried ahead of the traveller through both winds', () => {
    const h = at('n4-two-fans');
    const follow = () => h.pose('right', 'spread', travellerX(h) + 0.15, LEDGE_TOP + 0.19);
    expect(h.runUntil(solved(h), 60, follow)).toBe(true);
    expect(h.saw('puzzle-solved', 'wall')).toBe(true);
  });

  it('is solved by a fist anchor carried with the traveller', () => {
    const h = at('n4-two-fans');
    const follow = () => h.pose('left', 'fist', travellerX(h), LEDGE_TOP + 0.19);
    expect(h.runUntil(solved(h), 90, follow)).toBe(true);
    expect(h.saw('puzzle-solved', 'anchor')).toBe(true);
  });

  it('is not solved by a windbreak only through the small fan', () => {
    const h = at('n4-two-fans');
    const follow = () => {
      if (travellerX(h) < 0) h.pose('right', 'spread', travellerX(h) + 0.15, LEDGE_TOP + 0.19);
      else h.hide('right');
    };
    h.run(40, follow);
    expect(h.saw('puzzle-solved')).toBe(false);
  });
});

describe('4.3: the fan and the step', () => {
  const stepX = (FAN_STEP_GAP[0] + FAN_STEP_GAP[1]) / 2;

  it.each([
    ['spread', 'wall', 0.15],
    ['fist', 'anchor', 0],
  ] as const)('is solved by a %s through the wind (%s), then a fist up the step', (shape, way, dx) => {
    const h = at('n4-fan-step');
    let lift: (() => void) | null = null;
    const follow = () => {
      if (!lift && travellerX(h) > STEP_WIND[1] + 0.02) {
        const y = LEDGE_TOP - FIST_BELOW;
        lift = carry(h, 'right', 'fist', stepX, y, stepX, y + TABLE_RISE + 0.02);
      }
      if (lift) lift();
      else h.pose('right', shape, travellerX(h) + dx, LEDGE_TOP + 0.19);
    };
    expect(h.runUntil(solved(h), 90, follow)).toBe(true);
    expect(h.saw('puzzle-solved', way)).toBe(true);
  });

  it('is not solved by the windbreak alone: the traveller waits below the table', () => {
    const h = at('n4-fan-step');
    const follow = () => {
      if (travellerX(h) < STEP_WIND[1] + 0.02) h.pose('right', 'spread', travellerX(h) + 0.15, LEDGE_TOP + 0.19);
      else h.hide('right');
    };
    h.run(50, follow);
    expect(travellerX(h)).toBeLessThan(FAN_STEP_GAP[0]);
    expect(h.saw('hint-show', 'fist')).toBe(true);
    expect(h.saw('puzzle-solved')).toBe(false);
  });
});

describe('5.2: the wide moat', () => {
  const [l, r] = WIDE_MOAT;

  it('is solved gate first, then carried over the moat', () => {
    const h = at('n5-wide-moat');
    h.pose('right', 'fist', ...onPlate(-0.3)).run(1.5);
    expect(h.saw('puzzle-event', 'gate-open')).toBe(true);
    h.hide('right');
    expect(h.runUntil(solved(h), 60, carry(h, 'left', 'flat', l + 0.15, BRIDGE_Y, r - 0.15, BRIDGE_Y))).toBe(true);
    expect(h.saw('puzzle-solved', 'gate-first')).toBe(true);
  });

  it('is solved carried over first, then the counterweight', () => {
    const h = at('n5-wide-moat');
    const over = carry(h, 'left', 'flat', l + 0.15, BRIDGE_Y, r - 0.15, BRIDGE_Y);
    expect(h.runUntil(() => travellerX(h) > r + 0.02, 40, over)).toBe(true);
    h.hide('left').pose('right', 'fist', ...onPlate(-0.3));
    expect(h.runUntil(solved(h), 40)).toBe(true);
    expect(h.saw('puzzle-solved', 'bridge-first')).toBe(true);
  });

  it('is not crossed on a bridge held still over the middle of the moat', () => {
    const h = at('n5-wide-moat');
    h.pose('right', 'fist', ...onPlate(-0.3)).run(1.5);
    h.hide('right').pose('left', 'flat', (l + r) / 2, BRIDGE_Y);
    h.run(30);
    expect(travellerX(h)).toBeLessThan(r);
    expect(h.saw('puzzle-solved')).toBe(false);
  });
});

describe('5.3: the keep', () => {
  const moatX = (KEEP_MOAT[0] + KEEP_MOAT[1]) / 2;
  const stepX = (KEEP_STEP[0] + KEEP_STEP[1]) / 2;
  const liftUp = (h: Headless, hand: Handedness) => {
    const y = LEDGE_TOP - FIST_BELOW;
    return carry(h, hand, 'fist', stepX, y, stepX, y + TABLE_RISE + 0.02);
  };

  it.each(['right', 'left'] as const)('is solved with the %s hand alone: counterweight, bridge, lift', (hand) => {
    const h = at('n5-keep');
    h.pose(hand, 'fist', ...onPlate(KEEP_PLATE_X)).run(1.5);
    expect(h.saw('puzzle-event', 'gate-open')).toBe(true);
    h.hide(hand).run(0.6).pose(hand, 'flat', moatX, BRIDGE_Y);
    expect(h.runUntil(() => travellerX(h) > KEEP_MOAT[1] + 0.06, 30)).toBe(true);
    h.hide(hand).run(0.6);
    expect(h.runUntil(solved(h), 60, liftUp(h, hand))).toBe(true);
    expect(h.saw('puzzle-solved', 'gate-first')).toBe(true);
  });

  it('is solved bridge first: over the moat, the counterweight, then the lift', () => {
    const h = at('n5-keep');
    h.pose('left', 'flat', moatX, BRIDGE_Y);
    expect(h.runUntil(() => travellerX(h) > KEEP_MOAT[1] + 0.06, 30)).toBe(true);
    h.hide('left')
      .pose('right', 'fist', ...onPlate(KEEP_PLATE_X))
      .run(1.5);
    expect(h.saw('puzzle-event', 'gate-open')).toBe(true);
    h.hide('right').run(0.6);
    expect(h.runUntil(solved(h), 60, liftUp(h, 'right'))).toBe(true);
    expect(h.saw('puzzle-solved', 'bridge-first')).toBe(true);
  });

  it('is not solved without the lift: the traveller waits below the keep, and the hint asks for a fist', () => {
    const h = at('n5-keep');
    h.pose('right', 'fist', ...onPlate(KEEP_PLATE_X)).run(1.5);
    h.hide('right').pose('left', 'flat', moatX, BRIDGE_Y);
    expect(h.runUntil(() => travellerX(h) > KEEP_MOAT[1] + 0.06, 30)).toBe(true);
    h.hide('left').run(50);
    expect(travellerX(h)).toBeGreaterThan(KEEP_GATE_X);
    expect(travellerX(h)).toBeLessThan(KEEP_STEP[1]);
    expect(travellerFeet(h)).toBeLessThan(LEDGE_TOP + 0.02);
    expect(h.saw('hint-show', 'fist')).toBe(true);
    expect(h.saw('puzzle-solved')).toBe(false);
  });

  it('ends the night after the outro and lights the window', () => {
    const h = at('n5-keep');
    h.pose('right', 'fist', ...onPlate(KEEP_PLATE_X)).run(1.5);
    h.hide('right').pose('left', 'flat', moatX, BRIDGE_Y);
    expect(h.runUntil(() => travellerX(h) > KEEP_MOAT[1] + 0.06, 30)).toBe(true);
    h.hide('left').run(0.6);
    expect(h.runUntil(() => h.saw('chapter-complete'), 70, liftUp(h, 'right'))).toBe(true);
    expect(h.game.complete).toBe(true);
    expect(h.game.fixtures.find('window')?.active).toBe(true);
  });
});

/** A fist on the counterweight for 1.5 s (gate first), lowered for 0.6 s, then `then` every frame. */
function castleScript(h: Headless, hand: Handedness, plateX: number, then: () => void): () => void {
  const start = h.t;
  return () => {
    const t = h.t - start;
    if (t < 1.5) h.pose(hand, 'fist', ...onPlate(plateX));
    else if (t < 2.1) h.hide(hand);
    else then();
  };
}

/** A fist under the traveller at a step, lifted up to the next ledge. */
function liftAt(h: Headless, hand: Handedness, gap: readonly [number, number], from = LEDGE_TOP) {
  const x = (gap[0] + gap[1]) / 2,
    y = from - FIST_BELOW;
  return carry(h, hand, 'fist', x, y, x, y + TABLE_RISE + 0.02);
}

/** The cup carried over the traveller. */
const cupOver = (h: Headless, hand: Handedness) => h.pose(hand, 'cup', travellerX(h) + 0.05, 0);
/** The windbreak carried ahead of the traveller. */
const wallAhead = (h: Headless, hand: Handedness) => h.pose(hand, 'spread', travellerX(h) + 0.15, LEDGE_TOP + 0.19);

/**
 * For each stage, a script that solves it the intended way with `hand` alone, from its first
 * frame: called once when the stage loads, it returns the function to call every frame.
 */
const SOLVE: Record<string, (h: Headless, hand: Handedness) => () => void> = {
  'n1-books': (h, hand) => {
    h.pose(hand, 'flat', 0, BRIDGE_Y);
    return () => {};
  },
  'n1-stones': (h, hand) => {
    const [a, b] = STONES_GAPS;
    h.pose(hand, 'flat', (a[0] + a[1]) / 2, BRIDGE_Y);
    return () => {
      if (travellerX(h) > a[1] + 0.06) h.move(hand, (b[0] + b[1]) / 2, BRIDGE_Y);
    };
  },
  'n1-wide': (h, hand) => carry(h, hand, 'flat', -WIDE_GAP / 2 + 0.15, BRIDGE_Y, WIDE_GAP / 2 - 0.15, BRIDGE_Y),
  'n2-ledge': (h, hand) => liftAt(h, hand, [-0.06, 0.06]),
  'n2-stair': (h, hand) => {
    const [a, b] = STAIR_GAPS;
    let lift = liftAt(h, hand, a);
    let second = false;
    return () => {
      if (!second && travellerX(h) > a[1] + 0.06) {
        second = true;
        lift = liftAt(h, hand, b, LEDGE_TOP + TABLE_RISE);
      }
      lift();
    };
  },
  'n2-step-bridge': (h, hand) => {
    h.pose(hand, 'flat', (STEP_BRIDGE_GAP[0] + STEP_BRIDGE_GAP[1]) / 2, BRIDGE_Y);
    let lift: (() => void) | null = null;
    return () => {
      if (!lift && travellerX(h) > STEP_BRIDGE_GAP[1] + 0.06) lift = liftAt(h, hand, STEP_GAP);
      lift?.();
    };
  },
  'n3-drip': (h, hand) => () => cupOver(h, hand),
  'n3-hanging': (h, hand) => () => cupOver(h, hand),
  'n3-drip-gap': (h, hand) => {
    let bridged = false;
    return () => {
      if (bridged || travellerX(h) > GAP_DRIPS.right + 0.08) {
        bridged = true;
        h.pose(hand, 'flat', (DRIP_GAP[0] + DRIP_GAP[1]) / 2, BRIDGE_Y);
      } else cupOver(h, hand);
    };
  },
  'n4-fan': (h, hand) => () => wallAhead(h, hand),
  'n4-two-fans': (h, hand) => () => wallAhead(h, hand),
  'n4-fan-step': (h, hand) => {
    let lift: (() => void) | null = null;
    return () => {
      if (!lift && travellerX(h) > STEP_WIND[1] + 0.02) lift = liftAt(h, hand, FAN_STEP_GAP);
      if (lift) lift();
      else wallAhead(h, hand);
    };
  },
  'n5-castle': (h, hand) => castleScript(h, hand, -0.3, () => h.pose(hand, 'flat', 0.01, BRIDGE_Y)),
  'n5-wide-moat': (h, hand) => {
    let over: (() => void) | null = null;
    return castleScript(h, hand, -0.3, () => {
      over ??= carry(h, hand, 'flat', WIDE_MOAT[0] + 0.15, BRIDGE_Y, WIDE_MOAT[1] - 0.15, BRIDGE_Y);
      over();
    });
  },
  'n5-keep': (h, hand) => {
    let lift: (() => void) | null = null;
    return castleScript(h, hand, KEEP_PLATE_X, () => {
      if (!lift && travellerX(h) > KEEP_GATE_X) lift = liftAt(h, hand, KEEP_STEP);
      if (lift) lift();
      else h.pose(hand, 'flat', (KEEP_MOAT[0] + KEEP_MOAT[1]) / 2, BRIDGE_Y);
    });
  },
};

describe.each<Handedness>(['right', 'left'])('the whole night, with the %s hand alone', (hand) => {
  it('plays every stage of every level start to finish the intended way, recording each', () => {
    const night = createNight();
    expect(Object.keys(SOLVE)).toEqual(night.map((p) => p.id));
    const h = new Headless({ puzzles: createNight(), save: newSave() });
    for (let i = 0; i < night.length; i++) {
      expect(h.game.puzzle.id).toBe(night[i].id);
      const each = SOLVE[night[i].id](h, hand);
      const done = i + 1 < night.length ? () => h.game.puzzleIndex === i + 1 : () => h.saw('chapter-complete');
      expect(h.runUntil(done, 90, each), `stage ${night[i].id}`).toBe(true);
      h.hide('right').hide('left').run(0.5);
    }
    expect(h.game.complete).toBe(true);
    expect(Object.keys(h.game.save.solutions)).toEqual(night.map((p) => p.id));
    expect(h.game.save.solutions['n1-wide']).toEqual(['bridge']);
    expect(h.game.save.solutions['n2-step-bridge']).toEqual(['rock']);
    expect(h.game.save.solutions['n3-drip-gap']).toEqual(['cup']);
    expect(h.game.save.solutions['n4-fan-step']).toEqual(['wall']);
    expect(h.game.save.solutions['n5-keep']).toEqual(['gate-first']);
  });
});
