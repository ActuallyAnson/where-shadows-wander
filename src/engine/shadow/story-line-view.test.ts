import { describe, expect, it } from 'vitest';
import type { StagePlane } from './pure/stage-plane';
import { StoryLineView } from './story-line-view';

const stage = {
  origin: [0, 1.2, -2],
  right: [1, 0, 0],
  up: [0, 1, 0],
  normal: [0, 0, 1],
  width: 1.6,
  height: 1,
} as unknown as StagePlane;
const uniforms = (v: StoryLineView) =>
  (v.group.children[0] as unknown as { material: { uniforms: Record<string, { value: number }> } }).material.uniforms;
/** Runs the view for `seconds` in frames of 50 ms (one frame never counts for more than 100 ms). */
const run = (v: StoryLineView, seconds: number, opacity = 1) => {
  for (let t = 0; t < seconds - 1e-9; t += 0.05) v.update(0.05, stage, opacity);
};
const LONG = 'A small light has lost its way and walks on.'; // takes the longest to write

describe('StoryLineView', () => {
  it('shows nothing until it is told to say something', () => {
    const v = new StoryLineView();
    expect(v.active).toBe(false);
    run(v, 1);
    expect(uniforms(v).opacity.value).toBe(0);
    v.dispose();
  });

  it('waits, then writes along the line, holds it, fades it and is done', () => {
    const v = new StoryLineView();
    v.say(LONG, 2, 4);
    run(v, 1); // still waiting
    expect(v.progress).toBe(0);
    run(v, 2); // 1 s into the writing
    expect(v.progress).toBeGreaterThan(0);
    expect(v.progress).toBeLessThan(1);
    const early = v.progress;
    run(v, 0.5);
    expect(v.progress).toBeGreaterThan(early); // the ink only moves forward
    run(v, 4); // written and held
    expect(v.progress).toBe(1);
    expect(uniforms(v).opacity.value).toBe(1);
    run(v, 7); // fading, then gone
    expect(v.active).toBe(false);
    expect(uniforms(v).opacity.value).toBe(0);
    v.dispose();
  });

  it('writes a long line more slowly than a short one, but never past a few seconds', () => {
    const time = (text: string) => {
      const v = new StoryLineView();
      v.say(text, 0, 5);
      let t = 0;
      while (v.progress < 1 && t < 20) {
        v.update(0.05, stage, 1);
        t += 0.05;
      }
      v.dispose();
      return t;
    };
    expect(time('Sleep well.')).toBeLessThan(time(LONG));
    expect(time(LONG.repeat(4))).toBeLessThanOrEqual(3.6);
  });

  it('dims with the candle, can be cleared, and is replaced by the next line', () => {
    const v = new StoryLineView();
    v.say('one', 0, 5);
    run(v, 2, 0.5);
    expect(uniforms(v).opacity.value).toBeCloseTo(0.5, 5);
    v.say('two', 0, 5);
    v.update(0.1, stage, 1);
    expect(v.progress).toBeLessThan(0.2); // writing again from the start
    v.clear();
    expect(v.active).toBe(false);
    v.dispose();
  });

  it('can queue a line to start when the one on the wall is done, and a clear drops the queue', () => {
    const v = new StoryLineView();
    v.say('one', 0, 1);
    v.say('two', 0, 1, true);
    for (let i = 0; i < 60; i++) v.update(0.1, stage, 1); // 6 s: the first (about 1.4 + 1 + 0.9) ends, the second plays
    expect(v.active).toBe(true);
    for (let i = 0; i < 100; i++) v.update(0.1, stage, 1);
    expect(v.active).toBe(false);
    v.say('three', 0, 1);
    v.say('four', 0, 1, true);
    v.clear();
    for (let i = 0; i < 100; i++) v.update(0.1, stage, 1);
    expect(v.active).toBe(false);
    v.dispose();
  });

  it('ignores a frame time that is negative or not a number', () => {
    const v = new StoryLineView();
    v.say('x', 0, 5);
    expect(() => {
      v.update(-1, stage, 1);
      v.update(NaN, stage, 1);
    }).not.toThrow();
    expect(v.progress).toBe(0);
    v.dispose();
  });
});
