import { describe, expect, it } from 'vitest';
import { FixedStepLoop } from './fixed-step';

describe('FixedStepLoop', () => {
  it('steps at the fixed rate regardless of display rate', () => {
    for (const displayHz of [72, 90, 120]) {
      const loop = new FixedStepLoop(60, () => {});
      for (let i = 0; i < displayHz * 10; i++) loop.advance(1 / displayHz);
      expect(Math.abs(loop.steps - 600)).toBeLessThanOrEqual(1);
    }
  });

  it('returns an interpolation factor in [0, 1)', () => {
    const loop = new FixedStepLoop(50, () => {});
    expect(loop.advance(0.03)).toBeCloseTo(0.5, 5);
  });

  it('caps a long stall instead of spiralling', () => {
    const loop = new FixedStepLoop(60, () => {});
    loop.advance(5);
    expect(loop.steps).toBe(15);
  });
});

describe('FixedStepLoop caps and reset', () => {
  it('drops whole steps past maxStepsPerFrame and counts them', () => {
    const loop = new FixedStepLoop(60, () => {}, 4);
    loop.advance(0.1); // 6 steps' worth
    expect(loop.steps).toBe(4);
    expect(loop.droppedS).toBeCloseTo(2 / 60, 9);
  });

  it('counts time beyond the frame clamp as dropped', () => {
    const loop = new FixedStepLoop(60, () => {});
    loop.advance(1);
    expect(loop.droppedS).toBeCloseTo(0.75, 9);
  });

  it('remembers the last alpha', () => {
    const loop = new FixedStepLoop(50, () => {});
    const a = loop.advance(0.03);
    expect(loop.alpha).toBe(a);
  });

  it('reset clears the remainder so a resumed frame starts clean', () => {
    const loop = new FixedStepLoop(60, () => {});
    loop.advance(0.015); // just under one step pending
    loop.reset();
    loop.advance(0.005);
    expect(loop.steps).toBe(0);
    expect(loop.alpha).toBeCloseTo(0.3, 9);
  });

  it('rejects a cap below one step', () => {
    expect(() => new FixedStepLoop(60, () => {}, 0)).toThrow(RangeError);
  });
});
