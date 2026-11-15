import { describe, expect, it } from 'vitest';
import { emptyRoomLayout, placement } from '../../stage/room-layout';
import { BedTrayView, quiltHeight } from './bed-tray-view';

describe('BedTrayView', () => {
  it('creates the lap view within the <= 400 triangle budget', () => {
    const view = new BedTrayView();
    let meshes = 0;
    view.group.traverse((o) => void (o.type === 'Mesh' && !o.userData.pickOnly && meshes++));
    expect(meshes).toBe(8);
    expect(view.triangleCount).toBeLessThanOrEqual(400);
    expect(view.triangleCount).toBeGreaterThan(50);
  });

  it('lays the quilt from a fold at the waist, under the tray, over the knees and feet, and down over the foot of the bed', () => {
    expect(quiltHeight(0)).toBeCloseTo(-0.12, 3); // where the tray's legs stand
    expect(quiltHeight(0.29)).toBeGreaterThan(quiltHeight(0.2)); // the turned-back fold
    expect(quiltHeight(-0.27)).toBeGreaterThan(quiltHeight(0)); // the knees
    expect(quiltHeight(-0.67)).toBeGreaterThan(quiltHeight(-0.6)); // the feet
    expect(quiltHeight(-0.8)).toBeLessThan(-0.4); // hanging over the foot of the bed
    const view = new BedTrayView();
    const quilt = view.editables().find((p) => p.id === 'quilt')!.object as import('@iwsdk/core').Mesh;
    quilt.geometry.computeBoundingBox();
    const box = quilt.geometry.boundingBox!;
    expect(box.max.z).toBeCloseTo(0.34, 3);
    expect(box.min.z).toBeCloseTo(-0.8, 3);
    expect(box.max.y).toBeLessThan(-0.04); // never up through the tray
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
    // The candle stands 5 cm toward the player from the tray's middle, turned with the tray.
    expect(out[0]).toBeCloseTo(0.1 + 0.05 * Math.sin(0.2), 4);
    expect(out[1]).toBeCloseTo(0.71, 4);
    expect(out[2]).toBeCloseTo(-0.5 + 0.05 * Math.cos(0.2), 4);
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
    expect(quilt.fallback.rotDeg[0]).toBe(0); // its shape is made in the tray's space
    view.place(0, 0.7, -0.5, 0);
    const out = new Float64Array(3);
    view.getCandleSaucerPosition(out);
    expect(out[1]).toBeCloseTo(0.74, 6);
    expect(out[2]).toBeCloseTo(-0.52 + 0.05, 6);
  });

  it("stands the candle where the layout says, in the tray's space, so it goes with the tray", () => {
    const layout = emptyRoomLayout();
    layout.lap.tray = placement([0.1, 0, 0]);
    layout.lap.candle = placement([-0.15, 0.01, 0.05]);
    const view = new BedTrayView(layout);
    expect(view.editables().map((p) => p.id)).toEqual(['tray', 'quilt', 'candle']);
    view.place(0, 0.7, -0.5, 0);
    const out = new Float64Array(3);
    view.getCandleSaucerPosition(out);
    expect(out[0]).toBeCloseTo(-0.05, 6);
    expect(out[1]).toBeCloseTo(0.71, 6);
    expect(out[2]).toBeCloseTo(-0.45, 6);
  });

  it("casts no shadow from the candle's unseen click box", () => {
    const view = new BedTrayView();
    const cast: unknown[] = [];
    view.useCandleLight({ light: () => {}, cast: (m: unknown) => cast.push(m) } as never);
    expect(cast.length).toBe(8);
  });

  it('disposes resources cleanly without error', () => {
    const view = new BedTrayView();
    expect(() => view.dispose()).not.toThrow();
  });
});
