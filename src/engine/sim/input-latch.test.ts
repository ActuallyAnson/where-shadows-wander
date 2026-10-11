import { describe, expect, it } from 'vitest';
import { GestureEventQueue } from '../hands/gesture-events';
import { ShapeEventQueue } from '../hands/shape-events';
import { FixedStepLoop } from './fixed-step';
import { InputLatch } from './input-latch';

describe('InputLatch', () => {
  it('copies events so they survive the source queue being cleared', () => {
    const src = new ShapeEventQueue();
    const latch = new InputLatch();
    src.push('commit', 'left', 'flat', 1.5, 0.3, 0.4);
    latch.capture(src, null);
    src.clear();
    src.push('candidate', 'right', 'fist', 2, 0, 0);
    expect(latch.shapes.count).toBe(1);
    const e = latch.shapes.at(0);
    expect([e.type, e.hand, e.shape, e.t, e.heldS]).toEqual(['commit', 'left', 'flat', 1.5, 0.4]);
  });

  it('copies gesture positions by value', () => {
    const src = new GestureEventQueue();
    const latch = new InputLatch();
    src.push('pinch-release', 'right', 3, 0.1, 0.2, 0.3, 0.2);
    latch.capture(null, src);
    src.push('cover-flame', 'left', 4, 9, 9, 9, 0.5);
    expect(Array.from(latch.gestures.at(0).position)).toEqual([0.1, 0.2, 0.3]);
  });

  it('delivers each event to exactly one sim step, at any display rate', () => {
    for (const displayHz of [30, 72, 90, 120]) {
      const latch = new InputLatch();
      const src = new ShapeEventQueue();
      let seen = 0;
      const loop = new FixedStepLoop(60, () => {
        seen += latch.shapes.count;
        latch.consume();
      });
      for (let f = 0; f < displayHz * 2; f++) {
        src.clear();
        if (f % 7 === 0) src.push('commit', 'right', 'cup', f, 0, 0.4);
        latch.capture(src, null);
        loop.advance(1 / displayHz);
      }
      // Events captured on the last frame may still be waiting for a step.
      const sent = Math.floor((displayHz * 2 - 1) / 7) + 1;
      expect(seen + latch.shapes.count).toBe(sent);
    }
  });

  it('keeps order across frames that take no step', () => {
    const latch = new InputLatch();
    const src = new ShapeEventQueue();
    src.push('candidate', 'left', 'fist', 1, 0, 0);
    latch.capture(src, null);
    src.clear();
    src.push('commit', 'left', 'fist', 2, 0, 0.4);
    latch.capture(src, null);
    expect([latch.shapes.at(0).type, latch.shapes.at(1).type]).toEqual(['candidate', 'commit']);
  });
});
