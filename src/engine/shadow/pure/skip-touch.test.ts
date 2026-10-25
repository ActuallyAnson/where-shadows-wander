import { describe, expect, it } from 'vitest';
import { SKIP_DWELL_S, SkipTouch, skipCentre } from './skip-touch';
import { createStagePlane } from './stage-plane';

const stage = createStagePlane();
stage.origin.set([0, 1, -1]);
stage.right.set([1, 0, 0]);
stage.up.set([0, 1, 0]);
stage.normal.set([0, 0, 1]);

function tip(dx: number, dy: number, dz: number): number[] {
  const c = skipCentre(stage, [0, 0]);
  return [c[0] + dx, 1 + c[1] + dy, -1 + dz];
}

describe('SkipTouch', () => {
  it('presses after the fingertip stays on the button', () => {
    const s = new SkipTouch();
    expect(s.update(SKIP_DWELL_S / 2, tip(0, 0, 0.02), 1, stage)).toBe(false);
    expect(s.progress).toBeCloseTo(0.5);
    expect(s.update(SKIP_DWELL_S / 2, tip(0, 0, 0.02), 1, stage)).toBe(true);
  });

  it('forgets a brush that leaves the button', () => {
    const s = new SkipTouch();
    s.update(SKIP_DWELL_S * 0.9, tip(0, 0, 0.02), 1, stage);
    s.update(0.016, tip(0.3, 0, 0.02), 1, stage);
    expect(s.progress).toBe(0);
    expect(s.update(SKIP_DWELL_S * 0.5, tip(0, 0, 0.02), 1, stage)).toBe(false);
  });

  it('ignores a fingertip well in front of the wall or far behind it', () => {
    const s = new SkipTouch();
    expect(s.update(1, tip(0, 0, 0.3), 1, stage)).toBe(false);
    expect(s.update(1, tip(0, 0, -0.2), 1, stage)).toBe(false);
  });

  it('counts any of the fingertips given', () => {
    const s = new SkipTouch();
    const t = [...tip(0.5, 0, 0), ...tip(0, 0, 0.01)];
    expect(s.update(1, t, 2, stage)).toBe(true);
  });
});
