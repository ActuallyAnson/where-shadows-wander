import { describe, expect, it } from 'vitest';
import { LAND_IDS, LAND_SIZE, LANDS, landPathPoint, paintLandLayer, type LandLayer } from './walk-lands';

function fakeContext() {
  let calls = 0;
  const gradient = { addColorStop: () => undefined };
  const target: Record<string | symbol, unknown> = {};
  const g = new Proxy(target, {
    get(_, key) {
      if (key === 'calls') return calls;
      if (key in target) return target[key];
      return () => {
        calls++;
        return typeof key === 'string' && key.startsWith('create') ? gradient : undefined;
      };
    },
    set(_, key, value) {
      target[key] = value;
      return true;
    },
  });
  return g as unknown as CanvasRenderingContext2D & { calls: number };
}

describe.each(LAND_IDS)('the land %s', (land) => {
  it('paints every layer, the same way every time', () => {
    for (const layer of Object.keys(LAND_SIZE) as LandLayer[]) {
      const a = fakeContext();
      const b = fakeContext();
      paintLandLayer(land, layer, a, 400, 300, 400);
      paintLandLayer(land, layer, b, 400, 300, 400);
      expect(a.calls, layer).toBeGreaterThan(3);
      expect(b.calls, layer).toBe(a.calls);
    }
  });

  it('has a path that only goes forward, with its landmarks along it in order', () => {
    const style = LANDS[land];
    const p = { x: 0, y: 0 };
    let last = -1;
    for (let u = 0; u <= 1; u += 0.05) {
      landPathPoint(land, u, 1000, 1000, p);
      expect(p.x).toBeGreaterThanOrEqual(last);
      last = p.x;
    }
    const at = style.landmarks.map((l) => l.at);
    expect([...at].sort()).toEqual(at);
    expect(style.name.length).toBeGreaterThan(5);
  });
});
