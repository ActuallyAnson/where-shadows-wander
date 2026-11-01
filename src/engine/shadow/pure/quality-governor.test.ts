import { describe, expect, it } from 'vitest';
import { EFFECTS, MAX_LEVEL, QualityGovernor, SHED_AT } from './quality-governor';

const BUDGET = 1000 / 72;
/** Feeds `frames` frames of `ms` each. */
const run = (g: QualityGovernor, frames: number, ms: number) => {
  for (let i = 0; i < frames; i++) g.update(ms);
};

describe('QualityGovernor', () => {
  it('starts with everything on and stays there while frames fit the budget', () => {
    const g = new QualityGovernor();
    run(g, 3000, BUDGET * 0.9);
    expect(g.level).toBe(0);
    for (const e of EFFECTS) expect(g.isOn(e)).toBe(true);
  });

  it('sheds a step when frames keep running over, then another, and stops at the top level', () => {
    const g = new QualityGovernor();
    run(g, 100, BUDGET * 2); // a window of frames at twice the budget
    expect(g.level).toBe(1);
    expect(g.isOn('propSketch')).toBe(false);
    expect(g.isOn('trail')).toBe(true); // the next step
    run(g, 200, BUDGET * 2);
    expect(g.level).toBeGreaterThanOrEqual(2);
    run(g, 2000, BUDGET * 2);
    expect(g.level).toBe(MAX_LEVEL);
    expect(g.isOn('backdrop')).toBe(false);
  });

  it('does not react to a few slow frames, a single long hitch, or a pause', () => {
    const g = new QualityGovernor();
    run(g, 200, BUDGET * 0.8);
    for (let i = 0; i < 6; i++) g.update(BUDGET * 3); // a handful of slow frames
    g.update(180); // one big hitch (a texture upload)
    run(g, 200, BUDGET * 0.8);
    expect(g.level).toBe(0);
    g.update(900); // the headset was off
    g.update(NaN);
    g.update(-4);
    expect(g.level).toBe(0);
  });

  it('brings things back slowly once frames are comfortably inside the budget, a step at a time', () => {
    const g = new QualityGovernor();
    run(g, 100, BUDGET * 2);
    run(g, 300, BUDGET * 2);
    const shed = g.level;
    expect(shed).toBeGreaterThanOrEqual(2);
    run(g, 500, BUDGET * 0.7); // not long enough to come back yet
    expect(g.level).toBe(shed);
    run(g, 6000, BUDGET * 0.7);
    expect(g.level).toBe(0);
  });

  it('does not flicker: a frame time that sits just over the line sheds once and stays', () => {
    const g = new QualityGovernor();
    const changes: number[] = [];
    let last = g.level;
    for (let i = 0; i < 6000; i++) {
      g.update(i % 3 === 0 ? BUDGET * 1.5 : BUDGET * 0.9); // a third of frames over
      if (g.level !== last) {
        changes.push(i);
        last = g.level;
      }
    }
    expect(changes.length).toBeLessThanOrEqual(MAX_LEVEL); // it went down the steps once and never came back up
    expect(g.level).toBeGreaterThanOrEqual(1);
  });

  it('takes its budget from the display (72, 90, 120 Hz) and ignores nonsense', () => {
    const g = new QualityGovernor();
    g.setRefreshRate(120);
    expect(g.settings.budgetMs).toBeCloseTo(1000 / 120, 5);
    g.setRefreshRate(0);
    g.setRefreshRate(NaN);
    expect(g.settings.budgetMs).toBeCloseTo(1000 / 120, 5);
    run(g, 100, 1000 / 90); // 90 Hz frames are over a 120 Hz budget
    expect(g.level).toBe(1);
  });

  it('can be reset, and every effect has a level at which it goes', () => {
    const g = new QualityGovernor();
    run(g, 400, BUDGET * 2);
    g.reset();
    expect(g.level).toBe(0);
    for (const e of EFFECTS) {
      expect(SHED_AT[e]).toBeGreaterThanOrEqual(1);
      expect(SHED_AT[e]).toBeLessThanOrEqual(MAX_LEVEL);
    }
  });
});
