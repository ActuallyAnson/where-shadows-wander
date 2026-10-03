import { describe, expect, it } from 'vitest';
import { createShapeState, ShapeEventQueue, type ShapeState } from '../../hands/shape-events';
import { ShadowSharpen } from './shadow-sharpen';

const FPS = 72;
const DT = 1 / FPS;

function states(): { left: ShapeState; right: ShapeState } {
  return { left: createShapeState('left'), right: createShapeState('right') };
}

/** Runs `seconds` of frames with the given state (events only on the first frame). */
function run(
  s: ShadowSharpen,
  st: { left: ShapeState; right: ShapeState },
  seconds: number,
  events = new ShapeEventQueue(),
) {
  for (let i = 0; i < Math.round(seconds * FPS); i++) {
    s.update(st, i === 0 ? events : new ShapeEventQueue(), DT);
  }
}

describe('shadow sharpen', () => {
  it('stays plain while idle', () => {
    const s = new ShadowSharpen();
    run(s, states(), 1);
    expect(s.value.right).toBe(0);
    expect(s.look.right).toEqual({ blurScale: 1, opacityBoost: 0 });
  });

  it('sharpens as a candidate holds: half way through gives smoothstep(0.5) of the candidate level', () => {
    const s = new ShadowSharpen();
    const st = states();
    st.right.phase = 'candidate';
    st.right.candidate = 'fist';
    st.right.progress = 0.5;
    run(s, st, 1);
    expect(s.value.right).toBeCloseTo(0.7 * 0.5, 2);
    expect(s.value.left).toBe(0);
    expect(s.look.right.blurScale).toBeLessThan(1);
    expect(s.look.left.blurScale).toBe(1);
  });

  it('a commit reaches full sharpness and fires one pulse', () => {
    const s = new ShadowSharpen();
    const st = states();
    st.right.phase = 'committed';
    st.right.committed = 'fist';
    const events = new ShapeEventQueue();
    events.push('commit', 'right', 'fist', 1, 1, 0.4, null);
    events.push('commit', 'right', 'fist', 1, 1, 0.4, null); // two commits in one update: still one pulse
    s.update(st, events, DT);
    expect(s.pulse.right).toBeGreaterThan(0.9);
    run(s, st, 0.5);
    expect(s.value.right).toBeGreaterThan(0.99);
    expect(s.pulse.right).toBeLessThan(0.05);
    expect(s.look.right.blurScale).toBeCloseTo(0.3, 1);
    expect(s.look.right.opacityBoost).toBeCloseTo(0.08, 2);
  });

  it('a cancel relaxes smoothly, never rising again', () => {
    const s = new ShadowSharpen();
    const st = states();
    st.right.phase = 'candidate';
    st.right.candidate = 'flat';
    st.right.progress = 1;
    run(s, st, 0.5);
    const before = s.value.right;
    expect(before).toBeGreaterThan(0.65);
    st.right.phase = 'idle';
    st.right.candidate = null;
    st.right.progress = 0;
    let last = before;
    for (let i = 0; i < Math.round(0.6 * FPS); i++) {
      s.update(st, new ShapeEventQueue(), DT);
      expect(s.value.right).toBeLessThanOrEqual(last + 1e-9);
      last = s.value.right;
    }
    expect(last).toBeLessThan(0.07);
  });

  it('stays sharp while another shape is being held during a switch', () => {
    const s = new ShadowSharpen();
    const st = states();
    st.right.phase = 'committed';
    st.right.committed = 'flat';
    run(s, st, 0.5);
    // The classifier reports the new shape as a candidate while flat's role is still in force.
    st.right.phase = 'candidate';
    st.right.candidate = 'fist';
    st.right.progress = 0.1;
    run(s, st, 0.3);
    expect(s.value.right).toBeGreaterThan(0.99);
  });

  it('holds its value while tracking is paused with the shape still in force', () => {
    const s = new ShadowSharpen();
    const st = states();
    st.right.phase = 'committed';
    st.right.committed = 'fist';
    run(s, st, 0.5);
    st.right.phase = 'paused'; // the classifier keeps the committed shape while it waits
    run(s, st, 1);
    expect(s.value.right).toBeGreaterThan(0.99);
  });

  it('strength 0 turns the effect off', () => {
    const s = new ShadowSharpen({ strength: 0 });
    const st = states();
    st.right.phase = 'committed';
    st.right.committed = 'fist';
    const events = new ShapeEventQueue();
    events.push('commit', 'right', 'fist', 1, 1, 0.4, null);
    s.update(st, events, DT);
    run(s, st, 0.5);
    expect(s.look.right).toEqual({ blurScale: 1, opacityBoost: 0 });
  });

  it('never gets sharper than the minimum, whatever the settings', () => {
    const s = new ShadowSharpen({ crispBlurScale: 0, pulseS: 1 });
    const st = states();
    st.right.phase = 'committed';
    st.right.committed = 'fist';
    const events = new ShapeEventQueue();
    events.push('commit', 'right', 'fist', 1, 1, 0.4, null);
    s.update(st, events, DT);
    run(s, st, 0.5);
    expect(s.look.right.blurScale).toBeGreaterThanOrEqual(0.15);
  });

  it('reset returns to plain shadows', () => {
    const s = new ShadowSharpen();
    const st = states();
    st.right.phase = 'committed';
    st.right.committed = 'fist';
    run(s, st, 0.5);
    s.reset();
    expect(s.value.right).toBe(0);
    expect(s.look.right.blurScale).toBe(1);
  });

  it('a hand lost for good (paused with nothing held) relaxes instead of staying crisp', () => {
    const s = new ShadowSharpen();
    const st = states();
    st.right.phase = 'committed';
    st.right.committed = 'fist';
    run(s, st, 0.5);
    st.right.phase = 'paused';
    st.right.committed = null; // the classifier released it: lost
    run(s, st, 1);
    expect(s.value.right).toBeLessThan(0.05);
  });

  it('ignores a NaN or negative time step', () => {
    const s = new ShadowSharpen();
    const st = states();
    st.right.phase = 'committed';
    st.right.committed = 'fist';
    run(s, st, 0.2);
    const before = s.value.right;
    s.update(st, new ShapeEventQueue(), NaN);
    s.update(st, new ShapeEventQueue(), -1);
    expect(s.value.right).toBe(before);
    expect(Number.isFinite(s.look.right.blurScale)).toBe(true);
  });
});
