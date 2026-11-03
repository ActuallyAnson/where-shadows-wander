import { describe, expect, it } from 'vitest';
import { paintCavern, paintMountains } from './vista-art';

/** A canvas context that does nothing but count the calls and hand back gradients that take colour stops. */
function fakeContext() {
  let calls = 0;
  const gradient = { addColorStop: () => undefined };
  const target: Record<string | symbol, unknown> = {};
  const g = new Proxy(target, {
    get(_, key) {
      if (key === 'calls') return calls;
      if (key in target) return target[key];
      return (...args: unknown[]) => {
        calls++;
        void args;
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

describe.each([
  ['the misty mountains', paintMountains],
  ['the cavern pool', paintCavern],
])('%s', (_, paint) => {
  it('paints without error at any size, and the same way every time', () => {
    const a = fakeContext();
    const b = fakeContext();
    expect(() => paint(a, 640, 360)).not.toThrow();
    paint(b, 640, 360);
    expect(a.calls).toBeGreaterThan(500);
    expect(b.calls).toBe(a.calls);
    expect(() => paint(fakeContext(), 64, 36)).not.toThrow();
  });
});
