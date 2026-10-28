// Every puzzle of the night, played headless from scripted hands: each is solved every way it
// should be (GDD: two solutions, one for the tutorial), the right solution is recorded, and one way
// that should not work (a cheat or a half-solution) does not. The ground is the props' shadows,
// cast by the orthographic stand-in (ADR 0014).
import { describe, expect, it } from 'vitest';
import { Kind } from '../../engine/sim/entity-kinds';
import { Touch } from '../../engine/sim/solver';
import { Headless } from '../headless';
import { PROP_TAG_BASE } from '../props';
import { newSave } from '../save-state';
import { LEDGE_TOP } from './bedroom';
import { createNight } from './index';
import { BOOKS_END_X, TABLE_RISE } from './n2-ledge';
import { DRIP_LEFT } from './n3-drip';
import { GATE_X, MOAT_RIGHT } from './n5-castle';

function at(index: number, seed = 1) {
  const save = newSave();
  save.puzzle = index;
  return new Headless({ puzzles: createNight(), save, seed });
}

function travellerX(h: Headless) {
  const g = h.game;
  return g.store.x[g.traveller.slot(g)];
}

/** A flat hand's shadow centred here lies level with the ledges' tops. */
const BRIDGE_Y = LEDGE_TOP - 0.01;

const solved = (h: Headless) => () => h.saw('puzzle-solved');

describe('the night', () => {
  it('has five puzzles, each loading with no problems and the traveller standing on a prop', () => {
    const night = createNight();
    expect(night.map((p) => p.id)).toEqual(['n1-books', 'n2-ledge', 'n3-drip', 'n4-fan', 'n5-castle']);
    for (let i = 0; i < night.length; i++) {
      const h = at(i);
      h.run(0.5);
      const g = h.game;
      expect(g.layout.problems).toEqual([]);
      expect(g.store.countOf(Kind.Traveller)).toBe(1);
      expect(g.solver.terrain.tag[g.traveller.standingOnId(g)]).toBeGreaterThanOrEqual(PROP_TAG_BASE);
    }
  });

  it('uses only the four bold shapes', () => {
    for (const p of createNight()) expect(['flat', 'fist', 'cup', 'spread']).toContain(p.hintShape);
  });
});

describe('1: the books (tutorial)', () => {
  it('stops the traveller at the gap and shows the flat-hand hint', () => {
    const h = at(0);
    h.run(8);
    expect(h.game.traveller.state === 'blocked' || h.game.traveller.state === 'look-back').toBe(true);
    expect(travellerX(h)).toBeLessThan(-0.1);
    expect(h.saw('hint-show', 'flat')).toBe(true);
    expect(h.saw('puzzle-solved')).toBe(false);
  });

  it('is solved with a flat-hand bridge', () => {
    const h = at(0);
    h.run(6).pose('right', 'flat', 0, BRIDGE_Y);
    expect(h.runUntil(solved(h), 20)).toBe(true);
    expect(h.saw('puzzle-solved', 'bridge')).toBe(true);
    expect(h.game.save.solutions['n1-books']).toEqual(['bridge']);
  });

  it('is not crossed on an animal shape, which has no role', () => {
    const h = at(0);
    h.pose('right', 'rabbit', 0, BRIDGE_Y);
    h.run(20);
    expect(h.saw('ability-start')).toBe(false);
    expect(h.saw('puzzle-solved')).toBe(false);
  });
});

describe('2: the ledge', () => {
  /** A fist's shadow centred here has its top level with the books. */
  const FIST_Y = LEDGE_TOP - 0.065;

  /** Holds `shape` in the gap at `y`, and once the traveller is standing on it, lifts it to the table. */
  function lift(h: Headless, shape: 'fist' | 'flat', y: number) {
    let lifted = y;
    h.pose('right', shape, 0, y);
    return () => {
      if (h.game.traveller.standingOn(h.game) !== Touch.Hand || lifted >= y + TABLE_RISE + 0.02) return;
      lifted += 0.002;
      h.move('right', 0, lifted);
    };
  }

  it('stops the traveller below the bedside table and, after a while, shows the fist hint', () => {
    const h = at(1);
    h.run(25);
    expect(travellerX(h)).toBeLessThan(BOOKS_END_X);
    expect(h.saw('hint-show', 'fist')).toBe(true);
    expect(h.saw('puzzle-solved')).toBe(false);
  });

  it('is solved by lifting the traveller up on a fist', () => {
    const h = at(1);
    expect(h.runUntil(solved(h), 40, lift(h, 'fist', FIST_Y))).toBe(true);
    expect(h.saw('puzzle-solved', 'rock')).toBe(true);
  });

  it('is solved by lifting the traveller up on a flat hand', () => {
    const h = at(1);
    expect(h.runUntil(solved(h), 40, lift(h, 'flat', BRIDGE_Y))).toBe(true);
    expect(h.saw('puzzle-solved', 'bridge')).toBe(true);
  });

  it("is not solved by a fist held still at the books' height", () => {
    // The traveller steps onto it and waits at the table's side.
    const h = at(1);
    h.pose('right', 'fist', 0, FIST_Y);
    h.run(25);
    expect(h.game.traveller.standingOn(h.game)).toBe(Touch.Hand);
    expect(h.saw('puzzle-solved')).toBe(false);
  });
});

describe('3: the dripping plant', () => {
  it('keeps the traveller out of the drips', () => {
    const h = at(2);
    h.run(15);
    expect(h.game.traveller.state).toBe('held');
    // It may edge in during a dry moment (the drops are seeded by the puzzle's place in the night), never far.
    expect(travellerX(h)).toBeLessThan(DRIP_LEFT + 0.05);
  });

  it('is solved by carrying a cup over the traveller', () => {
    const h = at(2);
    h.run(4);
    const follow = () => h.pose('right', 'cup', travellerX(h) + 0.05, 0);
    expect(h.runUntil(solved(h), 40, follow)).toBe(true);
    expect(h.saw('puzzle-solved', 'cup')).toBe(true);
    expect(h.saw('caught', 'raindrop')).toBe(true);
  });

  it('is solved with a flat hand held up as a roof', () => {
    const h = at(2);
    h.pose('left', 'flat', 0.05, 0.12);
    expect(h.runUntil(solved(h), 40)).toBe(true);
    expect(h.saw('puzzle-solved', 'roof')).toBe(true);
  });

  it('is not solved by a cup held off to the side of the drips', () => {
    const h = at(2);
    h.pose('right', 'cup', 0.5, 0.2);
    h.run(25);
    expect(h.saw('puzzle-solved')).toBe(false);
  });
});

describe('4: the fan', () => {
  it('blows the traveller back on its own', () => {
    const h = at(3);
    h.run(20);
    expect(travellerX(h)).toBeLessThan(-0.2);
    expect(h.saw('puzzle-solved')).toBe(false);
  });

  it('is solved by a spread-hand windbreak carried ahead of the traveller', () => {
    const h = at(3);
    const follow = () => h.pose('right', 'spread', travellerX(h) + 0.15, LEDGE_TOP + 0.19);
    expect(h.runUntil(solved(h), 40, follow)).toBe(true);
    expect(h.saw('puzzle-solved', 'wall')).toBe(true);
  });

  it('is solved by a fist anchor held just above the traveller', () => {
    const h = at(3);
    const follow = () => h.pose('left', 'fist', travellerX(h), LEDGE_TOP + 0.19);
    expect(h.runUntil(solved(h), 60, follow)).toBe(true);
    expect(h.saw('puzzle-solved', 'anchor')).toBe(true);
  });

  it('is not solved by a windbreak on the sheltered side', () => {
    // The fan blows from the right: a wall on the traveller's left shelters nothing.
    const h = at(3);
    const follow = () => h.pose('right', 'spread', travellerX(h) - 0.15, LEDGE_TOP + 0.19);
    h.run(25, follow);
    expect(h.saw('puzzle-solved')).toBe(false);
  });
});

describe('5: the castle', () => {
  /** A fist resting on the counterweight plate. */
  const ON_PLATE: [number, number] = [-0.3, 0.07];
  const MOAT_BRIDGE: [number, number] = [0.01, BRIDGE_Y];

  it('keeps the gate shut on its own', () => {
    const h = at(4);
    h.run(20);
    expect(h.saw('puzzle-event', 'gate-open')).toBe(false);
    expect(h.saw('puzzle-solved')).toBe(false);
  });

  it('is solved gate first: a fist on the counterweight, then a bridge over the moat', () => {
    const h = at(4);
    h.pose('right', 'fist', ...ON_PLATE).run(1.5);
    expect(h.saw('puzzle-event', 'gate-open')).toBe(true);
    // The gate stays open once the fist is gone.
    h.hide('right').pose('left', 'flat', ...MOAT_BRIDGE);
    expect(h.runUntil(solved(h), 40)).toBe(true);
    expect(h.saw('puzzle-solved', 'gate-first')).toBe(true);
  });

  it('is solved bridge first: over the moat, then a fist on the counterweight', () => {
    const h = at(4);
    h.pose('left', 'flat', ...MOAT_BRIDGE);
    expect(h.runUntil(() => travellerX(h) > MOAT_RIGHT + 0.1, 30)).toBe(true);
    h.hide('left').pose('right', 'fist', ...ON_PLATE);
    expect(h.runUntil(solved(h), 40)).toBe(true);
    expect(h.saw('puzzle-solved', 'bridge-first')).toBe(true);
  });

  it('is not solved by the bridge alone: the traveller waits at the gate, and the hint turns to the fist', () => {
    const h = at(4);
    h.pose('left', 'flat', ...MOAT_BRIDGE);
    expect(h.runUntil(() => travellerX(h) > MOAT_RIGHT + 0.1, 30)).toBe(true);
    h.hide('left').run(40);
    expect(travellerX(h)).toBeLessThan(GATE_X);
    expect(h.saw('hint-show', 'fist')).toBe(true);
    expect(h.saw('puzzle-solved')).toBe(false);
  });

  it('is not solved by the counterweight alone: the moat is still there', () => {
    const h = at(4);
    h.pose('right', 'fist', ...ON_PLATE);
    h.run(40);
    expect(h.saw('puzzle-event', 'gate-open')).toBe(true);
    expect(h.saw('hint-show', 'flat')).toBe(true);
    expect(h.saw('puzzle-solved')).toBe(false);
  });

  it('is not opened by a flat hand on the counterweight', () => {
    // Only a rock has weight.
    const h = at(4);
    h.pose('right', 'flat', ...ON_PLATE);
    h.run(20);
    expect(h.saw('puzzle-event', 'gate-open')).toBe(false);
  });

  it('ends the night after the outro and lights the window', () => {
    const h = at(4);
    h.pose('right', 'fist', ...ON_PLATE).run(1.5);
    h.hide('right').pose('left', 'flat', ...MOAT_BRIDGE);
    expect(h.runUntil(() => h.saw('chapter-complete'), 50)).toBe(true);
    expect(h.game.complete).toBe(true);
    expect(h.game.save.chapterComplete).toBe(true);
    expect(h.game.fixtures.find('window')?.active).toBe(true);
  });
});

describe('the whole night', () => {
  it('plays start to finish with the intended solutions, recording each', () => {
    const save = newSave();
    const h = new Headless({ puzzles: createNight(), save });
    const ids = createNight().map((p) => p.id);
    const until = (id: string) => () => h.game.puzzle.id === id;
    // 1: a bridge over the books' gap, lowered once the outro moves on.
    h.pose('right', 'flat', 0, BRIDGE_Y);
    expect(h.runUntil(until('n2-ledge'), 30)).toBe(true);
    h.hide('right').run(0.5);
    // 2: a fist in the gap, lifted to the bedside table with the traveller on it.
    let y = LEDGE_TOP - 0.065;
    h.pose('right', 'fist', 0, y);
    const lift = () => {
      if (h.game.traveller.standingOn(h.game) !== Touch.Hand || y >= LEDGE_TOP + TABLE_RISE) return;
      y += 0.002;
      h.move('right', 0, y);
    };
    expect(h.runUntil(until('n3-drip'), 45, lift)).toBe(true);
    h.hide('right').run(0.5);
    // 3: a roof over the drips.
    h.pose('left', 'flat', 0.05, 0.12);
    expect(h.runUntil(until('n4-fan'), 45)).toBe(true);
    h.hide('left').run(0.5);
    // 4: a windbreak walked along with the traveller.
    expect(
      h.runUntil(until('n5-castle'), 45, () => h.pose('right', 'spread', travellerX(h) + 0.15, LEDGE_TOP + 0.19)),
    ).toBe(true);
    h.hide('right').run(0.5);
    // 5: the counterweight, then the bridge over the moat.
    h.pose('right', 'fist', -0.3, 0.07).run(1.5);
    h.hide('right').pose('left', 'flat', 0.01, BRIDGE_Y);
    expect(h.runUntil(() => h.saw('chapter-complete'), 50)).toBe(true);
    expect(Object.keys(h.game.save.solutions)).toEqual(ids);
    expect(h.game.save.solutions['n2-ledge']).toEqual(['rock']);
    expect(h.game.save.solutions['n5-castle']).toEqual(['gate-first']);
  });
});
