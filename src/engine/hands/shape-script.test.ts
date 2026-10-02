import { describe, expect, it } from 'vitest';
import { SHAPES } from './shapes';
import { createPrompt, SETTLE_S, SHAPES_SCRIPT, ShapeScript, type ScriptStep } from './shape-script';

const STEPS: ScriptStep[] = [
  { hand: 'right', shape: 'relaxed', seconds: 2 },
  { hand: 'right', shape: 'fist', seconds: 3 },
  { hand: 'left', shape: 'cup', seconds: 2 },
  { hand: 'right', shape: null, seconds: 2 },
  { hand: 'left', shape: 'fox', seconds: 0.8 },
];

describe('shape script', () => {
  it('times each step from the end of the one before', () => {
    const s = new ShapeScript(STEPS);
    expect(s.starts).toEqual([0, 2, 5, 7, 9]);
    expect(s.duration).toBeCloseTo(9.8);
  });

  it('finds the step running at a time', () => {
    const s = new ShapeScript(STEPS);
    expect(s.stepAt(-0.1)).toBe(-1);
    expect(s.stepAt(0)).toBe(0);
    expect(s.stepAt(1.999)).toBe(0);
    expect(s.stepAt(2)).toBe(1);
    expect(s.stepAt(9.5)).toBe(4);
    expect(s.stepAt(9.8)).toBe(5);
  });

  it('finds the latest step for a hand and the one before it', () => {
    const s = new ShapeScript(STEPS);
    expect(s.lastStepFor('left', 1)).toBe(-1);
    expect(s.lastStepFor('right', 6)).toBe(1);
    expect(s.lastStepFor('left', 8)).toBe(2);
    expect(s.lastStepFor('right', 100)).toBe(3);
    expect(s.prevForHand).toEqual([-1, 0, -1, 1, 2]);
  });

  it('labels only the settled middle of each step', () => {
    const fist = new ShapeScript(STEPS).labels().find((l) => l.shape === 'fist')!;
    expect(fist).toEqual({ start: 2 + SETTLE_S, end: 5 - SETTLE_S, hand: 'right', shape: 'fist' });
  });

  it('labels rest as none, and skips hidden and too-short steps', () => {
    const labels = new ShapeScript(STEPS).labels();
    expect(labels.map((l) => `${l.hand} ${l.shape}`)).toEqual(['right none', 'right fist', 'left cup']);
  });

  it('prompts every shape on each hand with rest between, in about a minute', () => {
    const s = new ShapeScript(SHAPES_SCRIPT);
    expect(s.duration).toBe(84);
    for (const hand of ['left', 'right'] as const) {
      const shapes = s.labels().filter((l) => l.hand === hand && l.shape !== 'none');
      expect(shapes.map((l) => l.shape)).toEqual([...SHAPES]);
      shapes.forEach((l) => expect(l.end - l.start).toBeCloseTo(3.5));
      expect(s.labels().filter((l) => l.hand === hand && l.shape === 'none').length).toBe(SHAPES.length + 1);
    }
  });

  it('writes prompts into the same object and reuses step texts', () => {
    const s = new ShapeScript(STEPS);
    const p = createPrompt();
    expect(s.promptAt(-1, p)).toBe(p);
    expect(p.text).toBe(s.waitText);
    s.promptAt(3, p);
    expect(p.index).toBe(1);
    expect(p.text).toBe(s.texts[1]);
    expect(p.text).toContain('FIST');
    expect(p.remaining).toBeCloseTo(2);
    s.promptAt(20, p);
    expect(p.text).toBe(s.doneText);
  });

  it('rejects an empty script or a step with no length', () => {
    expect(() => new ShapeScript([])).toThrow(RangeError);
    expect(() => new ShapeScript([{ hand: 'left', shape: 'fist', seconds: 0 }])).toThrow(RangeError);
  });
});
