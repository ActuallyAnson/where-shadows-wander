import { describe, expect, it } from 'vitest';
import { CLIMB_LANDMARKS, CLIMB_PATH, CLIMB_SIZE, paintClimbLayer, pathPoint, type ClimbLayer } from './climb-art';

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

describe('the climb', () => {
  it('paints every layer, the same way every time', () => {
    for (const layer of Object.keys(CLIMB_SIZE) as ClimbLayer[]) {
      const a = fakeContext();
      const b = fakeContext();
      paintClimbLayer(a, layer, 400, 300, 400);
      paintClimbLayer(b, layer, 400, 300, 400);
      expect(a.calls, layer).toBeGreaterThan(5);
      expect(b.calls, layer).toBe(a.calls);
    }
  });

  it('walks the path from its start to its end, rising as it goes', () => {
    const p = { x: 0, y: 0 };
    pathPoint(0, 1000, 1000, p);
    expect(p.x).toBeCloseTo(CLIMB_PATH[0][0] * 1000, 3);
    expect(p.y).toBeCloseTo(CLIMB_PATH[0][1] * 1000, 3);
    const first = { ...p };
    pathPoint(1, 1000, 1000, p);
    expect(p.x).toBeCloseTo(CLIMB_PATH[CLIMB_PATH.length - 1][0] * 1000, 3);
    expect(p.y).toBeLessThan(first.y); // higher up (smaller y)
    let lastX = -1;
    for (let u = 0; u <= 1; u += 0.05) {
      pathPoint(u, 1000, 1000, p);
      expect(p.x).toBeGreaterThanOrEqual(lastX);
      lastX = p.x;
    }
  });

  it('puts the landmarks along the path, in order', () => {
    const at = CLIMB_LANDMARKS.map((l) => l.at);
    expect([...at].sort()).toEqual(at);
    for (const l of CLIMB_LANDMARKS) expect(l.at).toBeGreaterThan(0);
  });
});
