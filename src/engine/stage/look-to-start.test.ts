import { describe, expect, it } from 'vitest';
import { LOOK_TO_START, LookToStart, looksAtStage } from './look-to-start';

// A wall 2 m ahead (the player looks down -z), its centre 0.2 m below the eyes at y 1.2.
const stage = { origin: [0, 1.0, -2], right: [1, 0, 0], up: [0, 1, 0], normal: [0, 0, 1] };
const eye = [0, 1.2, 0];

describe('looksAtStage', () => {
  it('sees the wall when looking straight ahead or a little down', () => {
    expect(looksAtStage(stage, eye, [0, 0, -1], 2, 1.25)).toBe(true);
    expect(looksAtStage(stage, eye, [0, -0.1, -1], 2, 1.25)).toBe(true);
  });

  it('does not see it while looking down at the candle in the lap', () => {
    expect(looksAtStage(stage, eye, [0, -0.55, -0.38], 2, 1.25)).toBe(false);
  });

  it('does not see it looking away, sideways past its edge, or along it', () => {
    expect(looksAtStage(stage, eye, [0, 0, 1], 2, 1.25)).toBe(false);
    expect(looksAtStage(stage, eye, [-1, 0, -0.5], 2, 1.25)).toBe(false);
    expect(looksAtStage(stage, eye, [1, 0, 0], 2, 1.25)).toBe(false);
  });
});

function run(l: LookToStart, seconds: number, looking: boolean): boolean {
  let started = false;
  for (let t = 0; t < seconds; t += 0.05) started = l.update(0.05, looking) || started;
  return started;
}

describe('LookToStart', () => {
  it('waits for as long as the player looks away, calling with the light', () => {
    const l = new LookToStart();
    l.start();
    expect(run(l, 60, false)).toBe(false);
    expect(l.waiting).toBe(true);
    let top = 0;
    for (let t = 0; t < LOOK_TO_START.pulseS; t += 0.05) {
      l.update(0.05, false);
      top = Math.max(top, l.pulse);
    }
    expect(top).toBeGreaterThan(0.95);
  });

  it('does not call at first, while the light spreads', () => {
    const l = new LookToStart();
    l.start();
    run(l, LOOK_TO_START.callAfterS - 0.2, false);
    expect(l.pulse).toBe(0);
  });

  it('starts once the eyes have rested on the wall long enough, a glance away holding the count', () => {
    const l = new LookToStart();
    l.start();
    expect(run(l, LOOK_TO_START.lookS * 0.6, true)).toBe(false);
    run(l, 3, false);
    expect(l.waiting).toBe(true);
    expect(run(l, LOOK_TO_START.lookS * 0.5, true)).toBe(true);
    expect(l.waiting).toBe(false);
  });

  it('lets the call fade away once the story has started', () => {
    const l = new LookToStart();
    l.start();
    run(l, 6, false);
    run(l, LOOK_TO_START.lookS + 0.1, true);
    run(l, 3, false);
    expect(l.pulse).toBe(0);
  });

  it('does nothing until started', () => {
    const l = new LookToStart();
    expect(run(l, 10, true)).toBe(false);
    expect(l.pulse).toBe(0);
  });
});
