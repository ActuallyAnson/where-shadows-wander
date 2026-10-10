// Every chapter-1 puzzle, played headless from scripted hands: each is solved every way it should
// be (GDD: at least two solutions, one for the tutorial), and the right solution is recorded.
import { describe, expect, it } from 'vitest';
import chapter1 from '../../../public/scenes/chapter-1.iwsdk.scene.json';
import { Headless } from '../headless';
import { newSave } from '../save-state';
import { createChapter1 } from './index';

function at(index: number, seed = 1) {
  const save = newSave();
  save.puzzle = index;
  return new Headless({ chapter: chapter1, puzzles: createChapter1(), save, seed });
}

function travellerX(h: Headless) {
  const g = h.game;
  return g.store.x[g.traveller.slot(g)];
}

const solved = (h: Headless) => () => h.saw('puzzle-solved');

describe('puzzle 1: the gap', () => {
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
    h.run(6).pose('right', 'flat', 0, -0.32);
    expect(h.runUntil(solved(h), 20)).toBe(true);
    expect(h.saw('puzzle-solved', 'bridge')).toBe(true);
    expect(h.game.save.solutions['p1-gap']).toEqual(['bridge']);
  });
});

describe('puzzle 2: rain', () => {
  it('keeps the traveller out of the rain', () => {
    const h = at(1);
    h.run(15);
    expect(h.game.traveller.state).toBe('held');
    expect(travellerX(h)).toBeLessThan(-0.1);
  });

  it('is solved by carrying a cup over the traveller', () => {
    const h = at(1);
    h.run(4);
    const follow = () => h.pose('right', 'cup', travellerX(h) + 0.05, -0.05);
    expect(h.runUntil(solved(h), 40, follow)).toBe(true);
    expect(h.saw('puzzle-solved', 'cup')).toBe(true);
    expect(h.saw('caught', 'raindrop')).toBe(true);
  });

  it('is solved with a flat hand held up as a roof', () => {
    const h = at(1);
    h.pose('left', 'flat', 0.05, 0.1);
    expect(h.runUntil(solved(h), 40)).toBe(true);
    expect(h.saw('puzzle-solved', 'roof')).toBe(true);
  });
});

describe('puzzle 3: wind', () => {
  it('blows the traveller back on its own', () => {
    const h = at(2);
    h.run(20);
    expect(travellerX(h)).toBeLessThan(-0.2);
    expect(h.saw('puzzle-solved')).toBe(false);
  });

  it('is solved by a spread-hand windbreak carried ahead of the traveller', () => {
    const h = at(2);
    const follow = () => h.pose('right', 'spread', travellerX(h) + 0.15, -0.11);
    expect(h.runUntil(solved(h), 40, follow)).toBe(true);
    expect(h.saw('puzzle-solved', 'wall')).toBe(true);
  });

  it('is solved by a fist anchor held just above the traveller', () => {
    const h = at(2);
    const follow = () => h.pose('left', 'fist', travellerX(h), -0.14);
    expect(h.runUntil(solved(h), 60, follow)).toBe(true);
    expect(h.saw('puzzle-solved', 'anchor')).toBe(true);
  });

  it('shows the rabbit hint in the scenery', () => {
    const h = at(2);
    h.run(0.1);
    expect(h.game.fixtures.find('hint-rabbit')?.active).toBe(true);
  });
});

describe('puzzle 4: the chasm', () => {
  it('is solved by the rabbit hopping across and lowering the rope', () => {
    const h = at(3);
    h.pose('left', 'rabbit', -0.5, -0.1).run(1.5).hide('left');
    expect(h.saw('companion-released', 'rabbit')).toBe(true);
    expect(h.saw('creature-discovered', 'rabbit')).toBe(true);
    expect(h.runUntil(solved(h), 40)).toBe(true);
    expect(h.saw('puzzle-event', 'rope-lowered')).toBe(true);
    expect(h.saw('puzzle-solved', 'rabbit')).toBe(true);
    expect(h.game.save.creatures).toEqual(['rabbit']);
  });

  it('is solved with two flat-hand bridges end to end', () => {
    const h = at(3);
    h.pose('left', 'flat', -0.1, -0.32).pose('right', 'flat', 0.18, -0.32);
    expect(h.runUntil(solved(h), 40)).toBe(true);
    expect(h.saw('puzzle-solved', 'two-bridges')).toBe(true);
  });

  it('cannot be crossed on one bridge', () => {
    const h = at(3);
    h.pose('left', 'flat', 0.05, -0.32);
    h.run(25);
    expect(h.saw('puzzle-solved')).toBe(false);
  });
});

describe('puzzle 5: crows', () => {
  it('holds the traveller back from the crows', () => {
    const h = at(4);
    h.run(15);
    expect(h.game.traveller.state).toBe('held');
  });

  it('is solved by the fox scaring the crows away', () => {
    const h = at(4);
    h.pose('right', 'fox', -0.45, -0.15).run(1.5).hide('right');
    expect(h.runUntil(solved(h), 40)).toBe(true);
    expect(h.saw('puzzle-event', 'crows-flee')).toBe(true);
    expect(h.saw('puzzle-solved', 'fox')).toBe(true);
  });

  it('is solved by luring the crows away with a cup of fireflies', () => {
    const h = at(4);
    h.pose('left', 'cup', -0.45, 0.13).run(2);
    expect(h.game.abilities.of('left').carried).toBeGreaterThanOrEqual(3);
    // Bring the light near the crows, then lift it high and keep it there.
    h.move('left', -0.05, 0.0).run(2).move('left', -0.05, 0.4);
    expect(h.runUntil(solved(h), 40)).toBe(true);
    expect(h.saw('puzzle-solved', 'fireflies')).toBe(true);
  });
});

describe('puzzle 6: the gate', () => {
  it('keeps the gate shut on its own', () => {
    const h = at(5);
    h.run(20);
    expect(h.saw('puzzle-solved')).toBe(false);
  });

  it('is solved with a fist rock on the weight plate', () => {
    const h = at(5);
    h.pose('right', 'fist', 0, -0.03);
    expect(h.runUntil(solved(h), 40)).toBe(true);
    expect(h.saw('puzzle-event', 'gate-open')).toBe(true);
    expect(h.saw('puzzle-solved', 'rock')).toBe(true);
  });

  it('is solved by the fox digging under the gate', () => {
    const h = at(5);
    h.pose('left', 'fox', -0.3, -0.15).run(1.5).hide('left');
    expect(h.runUntil(solved(h), 40)).toBe(true);
    expect(h.saw('puzzle-event', 'dig')).toBe(true);
    expect(h.saw('puzzle-solved', 'fox')).toBe(true);
  });

  it('ends the chapter after the outro and lights the window', () => {
    const h = at(5);
    h.pose('right', 'fist', 0, -0.03);
    expect(h.runUntil(() => h.saw('chapter-complete'), 50)).toBe(true);
    expect(h.game.complete).toBe(true);
    expect(h.game.save.chapterComplete).toBe(true);
    expect(h.game.fixtures.find('window')?.active).toBe(true);
  });
});
