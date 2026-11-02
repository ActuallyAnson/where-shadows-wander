// Accessibility: every way through every puzzle of the night can be done with one hand alone, either hand. A player with one hand (or
// one hand tracked) loses no puzzle and no way found. Each solution is played headless as in night.test.ts, but with only `hand`.
import { describe, expect, it } from 'vitest';
import type { Handedness } from '../../engine/hands/hand';
import { Touch } from '../../engine/sim/solver';
import { Headless } from '../headless';
import { newSave } from '../save-state';
import { LEDGE_TOP } from './bedroom';
import { createNight } from './index';
import { TABLE_RISE } from './n2-ledge';

const BRIDGE_Y = LEDGE_TOP - 0.01;
const FIST_Y = LEDGE_TOP - 0.065;
const ON_PLATE: [number, number] = [-0.3, 0.07];
const MOAT_BRIDGE: [number, number] = [0.01, BRIDGE_Y];

function at(index: number) {
  const save = newSave();
  save.puzzle = index;
  return new Headless({ puzzles: createNight(), save, seed: 1 });
}
const travellerX = (h: Headless) => h.game.store.x[h.game.traveller.slot(h.game)];
const solved = (h: Headless) => () => h.saw('puzzle-solved');

describe.each<Handedness>(['right', 'left'])('with the %s hand alone', (hand) => {
  it('1: the books, by a bridge', () => {
    const h = at(0);
    h.run(6).pose(hand, 'flat', 0, BRIDGE_Y);
    expect(h.runUntil(solved(h), 20)).toBe(true);
    expect(h.saw('puzzle-solved', 'bridge')).toBe(true);
  });

  it.each([
    ['fist', 'rock', FIST_Y],
    ['flat', 'bridge', BRIDGE_Y],
  ] as const)('2: the ledge, lifted on a %s (%s)', (shape, way, y) => {
    const h = at(1);
    let lifted: number = y;
    h.pose(hand, shape, 0, y);
    const lift = () => {
      if (h.game.traveller.standingOn(h.game) !== Touch.Hand || lifted >= y + TABLE_RISE + 0.02) return;
      lifted += 0.002;
      h.move(hand, 0, lifted);
    };
    expect(h.runUntil(solved(h), 40, lift)).toBe(true);
    expect(h.saw('puzzle-solved', way)).toBe(true);
  });

  it('3: the drip, by a cup', () => {
    const h = at(2);
    h.run(4);
    expect(h.runUntil(solved(h), 40, () => h.pose(hand, 'cup', travellerX(h) + 0.05, 0))).toBe(true);
    expect(h.saw('puzzle-solved', 'cup')).toBe(true);
  });

  it('3: the drip, by a roof', () => {
    const h = at(2);
    h.pose(hand, 'flat', 0.05, 0.12);
    expect(h.runUntil(solved(h), 40)).toBe(true);
    expect(h.saw('puzzle-solved', 'roof')).toBe(true);
  });

  it('4: the fan, by a windbreak', () => {
    const h = at(3);
    const follow = () => h.pose(hand, 'spread', travellerX(h) + 0.15, LEDGE_TOP + 0.19);
    expect(h.runUntil(solved(h), 40, follow)).toBe(true);
    expect(h.saw('puzzle-solved', 'wall')).toBe(true);
  });

  it('4: the fan, by an anchor', () => {
    const h = at(3);
    const follow = () => h.pose(hand, 'fist', travellerX(h), LEDGE_TOP + 0.19);
    expect(h.runUntil(solved(h), 60, follow)).toBe(true);
    expect(h.saw('puzzle-solved', 'anchor')).toBe(true);
  });

  it('5: the castle, gate first', () => {
    const h = at(4);
    h.pose(hand, 'fist', ...ON_PLATE).run(1.5);
    expect(h.saw('puzzle-event', 'gate-open')).toBe(true);
    h.hide(hand).pose(hand, 'flat', ...MOAT_BRIDGE);
    expect(h.runUntil(solved(h), 40)).toBe(true);
    expect(h.saw('puzzle-solved', 'gate-first')).toBe(true);
  });

  it('5: the castle, bridge first', () => {
    const h = at(4);
    h.pose(hand, 'flat', ...MOAT_BRIDGE);
    expect(h.runUntil(() => travellerX(h) > 0.2, 30)).toBe(true);
    h.hide(hand).pose(hand, 'fist', ...ON_PLATE);
    expect(h.runUntil(solved(h), 40)).toBe(true);
    expect(h.saw('puzzle-solved', 'bridge-first')).toBe(true);
  });
});
