import { describe, expect, it } from 'vitest';
import { paintReadingPage, ReadingPageView } from './reading-page-view';

function recordingContext(): { g: CanvasRenderingContext2D; calls: () => number } {
  let n = 0;
  const store: Record<string | symbol, unknown> = {};
  const g = new Proxy(store, {
    get(t, prop) {
      if (prop === 'createRadialGradient' || prop === 'createLinearGradient') return () => ({ addColorStop() {} });
      if (prop in t) return t[prop];
      return () => {
        n++;
      };
    },
    set(t, prop, value) {
      t[prop] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  return { g, calls: () => n };
}
const head = { x: 0, y: 1.2, z: 0 };
const opacity = (v: ReadingPageView) =>
  (v.group.children[0] as unknown as { material: { opacity: number } }).material.opacity;
const run = (v: ReadingPageView, seconds: number) => {
  for (let t = 0; t < seconds - 1e-9; t += 0.05) v.update(0.05);
};

describe('the reading page', () => {
  it('paints the hand, the bridge and the words', () => {
    const { g, calls } = recordingContext();
    expect(() => paintReadingPage(g, 512, 384)).not.toThrow();
    expect(calls()).toBeGreaterThan(20);
  });

  it('is hidden until shown, held below and ahead of the head, faded in, then out, then gone', () => {
    const v = new ReadingPageView();
    expect(v.showing).toBe(false);
    expect(v.group.visible).toBe(false);
    v.show(head, 0, -1, 6);
    expect(v.showing).toBe(true);
    expect(v.group.position.y).toBeLessThan(head.y - 0.2);
    expect(v.group.position.z).toBeLessThan(-0.2); // ahead is -z here
    run(v, 0.6);
    expect(opacity(v)).toBeGreaterThan(0);
    expect(opacity(v)).toBeLessThan(1);
    run(v, 2.4);
    expect(opacity(v)).toBe(1);
    run(v, 5);
    expect(v.showing).toBe(false);
    expect(v.group.visible).toBe(false);
    v.dispose();
  });

  it('is held ahead of the way the head faces, can be cleared, and ignores bad frame times', () => {
    const v = new ReadingPageView();
    v.show(head, 1, 0, 6);
    expect(v.group.position.x).toBeGreaterThan(0.2);
    v.clear();
    expect(v.showing).toBe(false);
    v.show(head, 0, 0, 6); // no direction at all: still a finite place
    expect(Number.isFinite(v.group.position.x + v.group.position.z)).toBe(true);
    expect(() => {
      v.update(-1);
      v.update(NaN);
    }).not.toThrow();
    v.dispose();
  });
});
