import { describe, expect, it } from 'vitest';
import { PANEL_DISTANCE_M, PANEL_DROP_M, PANEL_SIDE_M, placeSettingsPanel } from './placement';

describe('placeSettingsPanel', () => {
  const head = [0, 1.2, 0];

  it('puts the panel in front of the head, below the eyes, facing back at them', () => {
    const p = placeSettingsPanel(head, 0, -1, 'right');
    expect(p.z).toBeCloseTo(-PANEL_DISTANCE_M);
    expect(p.y).toBeCloseTo(1.2 - PANEL_DROP_M);
    // Looking along -z the panel's front must face +z: a yaw near 0 (slightly toward the head's side).
    expect(Math.abs(p.yaw)).toBeLessThan(0.25);
    expect(p.pitch).toBeLessThan(0);
  });

  it('shifts toward the main hand: right of the view for the right hand, left for the left', () => {
    expect(placeSettingsPanel(head, 0, -1, 'right').x).toBeCloseTo(PANEL_SIDE_M);
    expect(placeSettingsPanel(head, 0, -1, 'left').x).toBeCloseTo(-PANEL_SIDE_M);
  });

  it('follows the way the head looks, whatever the direction, at the same distance', () => {
    for (const a of [0, 1, 2.5, -2]) {
      const fx = Math.sin(a);
      const fz = -Math.cos(a);
      const p = placeSettingsPanel(head, fx * 3, fz * 3, 'right');
      const along = (p.x - head[0]) * fx + (p.z - head[2]) * fz;
      expect(along).toBeCloseTo(PANEL_DISTANCE_M);
      expect(Math.hypot(p.x, p.z)).toBeCloseTo(Math.hypot(PANEL_DISTANCE_M, PANEL_SIDE_M));
    }
  });

  it('turns the panel face to the head', () => {
    const p = placeSettingsPanel(head, 1, 0, 'right'); // looking along +x
    // The panel's front is +z turned by yaw: (sin yaw, cos yaw). It must point from the panel to the head.
    const toHead = [head[0] - p.x, head[2] - p.z];
    const len = Math.hypot(toHead[0], toHead[1]);
    expect(Math.sin(p.yaw)).toBeCloseTo(toHead[0] / len);
    expect(Math.cos(p.yaw)).toBeCloseTo(toHead[1] / len);
  });

  it('falls back to looking along -z for a head looking straight up, down or at nothing', () => {
    for (const [fx, fz] of [
      [0, 0],
      [1e-9, 0],
      [NaN, 1],
      [Infinity, 0],
    ]) {
      const p = placeSettingsPanel(head, fx, fz, 'right');
      expect(Number.isFinite(p.x + p.y + p.z + p.yaw + p.pitch)).toBe(true);
      expect(p.z).toBeCloseTo(-PANEL_DISTANCE_M);
    }
  });

  it('reuses the output object it is given', () => {
    const out = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 };
    expect(placeSettingsPanel(head, 0, -1, 'left', out)).toBe(out);
  });
});
