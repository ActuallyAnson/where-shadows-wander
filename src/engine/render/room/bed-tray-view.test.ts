import { describe, expect, it } from 'vitest';
import { BedTrayView } from './bed-tray-view';

describe('BedTrayView', () => {
  it('creates the lap view within the <= 400 triangle budget', () => {
    const view = new BedTrayView();
    expect(view.group.children).toHaveLength(8);
    expect(view.triangleCount).toBeLessThanOrEqual(400);
    expect(view.triangleCount).toBeGreaterThan(50);
  });

  it('initializes at default lap position (Y ≈ 0.65m, Z ≈ -0.45m)', () => {
    const view = new BedTrayView();
    expect(view.group.position.y).toBeCloseTo(0.65, 2);
    expect(view.group.position.z).toBeCloseTo(-0.45, 2);
  });

  it('updates placement and provides candle saucer resting coordinates', () => {
    const view = new BedTrayView();
    view.place(0.1, 0.7, -0.5, 0.2);
    expect(view.group.position.x).toBeCloseTo(0.1, 4);
    expect(view.group.position.y).toBeCloseTo(0.7, 4);
    expect(view.group.position.z).toBeCloseTo(-0.5, 4);
    expect(view.group.rotation.y).toBeCloseTo(0.2, 4);

    const out = new Float64Array(3);
    view.getCandleSaucerPosition(out);
    expect(out[0]).toBeCloseTo(0.1, 4);
    expect(out[1]).toBeCloseTo(0.71, 4);
    expect(out[2]).toBeCloseTo(-0.5, 4);
  });

  it('disposes resources cleanly without error', () => {
    const view = new BedTrayView();
    expect(() => view.dispose()).not.toThrow();
  });
});
