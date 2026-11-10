import { describe, expect, it } from 'vitest';
import { emptyRoomLayout, placement } from '../../stage/room-layout';
import { BedTrayView } from './bed-tray-view';

describe('BedTrayView', () => {
  it('creates the lap view within the <= 400 triangle budget', () => {
    const view = new BedTrayView();
    let meshes = 0;
    view.group.traverse((o) => void (o.type === 'Mesh' && meshes++));
    expect(meshes).toBe(8);
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

  it('puts the tray and the quilt where the layout says, and the candle on the tray wherever it is', () => {
    const layout = emptyRoomLayout();
    layout.lap.tray = placement([0, 0.03, -0.02]);
    layout.lap.quilt = placement([0, -0.1, 0.2], [-80, 0, 0]);
    const view = new BedTrayView(layout);
    const [tray, quilt] = view.editables();
    expect(tray.id).toBe('tray');
    expect(tray.object.position.y).toBeCloseTo(0.03, 6);
    expect(quilt.object.position.z).toBeCloseTo(0.2, 6);
    expect(quilt.object.rotation.x).toBeCloseTo((-80 * Math.PI) / 180, 6);
    expect(quilt.fallback.rotDeg[0]).toBeCloseTo(-180 / 2.3, 6);
    view.place(0, 0.7, -0.5, 0);
    const out = new Float64Array(3);
    view.getCandleSaucerPosition(out);
    expect(out[1]).toBeCloseTo(0.74, 6);
    expect(out[2]).toBeCloseTo(-0.52, 6);
  });

  it('disposes resources cleanly without error', () => {
    const view = new BedTrayView();
    expect(() => view.dispose()).not.toThrow();
  });
});
