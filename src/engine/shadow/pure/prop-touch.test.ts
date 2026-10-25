import { describe, expect, it } from 'vitest';
import { PropTouch } from './prop-touch';

const poly = (x0: number, y0: number, x1: number, y1: number) => ({
  vertices: Float32Array.of(x0, y0, x1, y0, x1, y1, x0, y1),
  vertexCount: 4,
});

describe('PropTouch', () => {
  it('reports a touch once as a hand reaches a prop, at the middle of the overlap', () => {
    const t = new PropTouch();
    t.setPolygons([poly(0, 0, 0.4, 0.2)]);
    expect(t.update(0, 1 / 60, true, 0.5, 0.5, 0.7, 0.7)).toBe(false);
    expect(t.update(0, 1 / 60, true, 0.3, 0.1, 0.6, 0.4)).toBe(true);
    expect(t.touchX).toBeCloseTo(0.35);
    expect(t.touchY).toBeCloseTo(0.15);
    expect(t.update(0, 1 / 60, true, 0.3, 0.1, 0.6, 0.4)).toBe(false); // still inside: not again
  });

  it('waits before the same hand can touch again, and each hand has its own', () => {
    const t = new PropTouch();
    t.setPolygons([poly(0, 0, 0.4, 0.2)]);
    expect(t.update(0, 1 / 60, true, 0.3, 0.1, 0.6, 0.4)).toBe(true);
    t.update(0, 0.1, true, 0.8, 0.8, 0.9, 0.9); // leaves
    expect(t.update(0, 0.1, true, 0.3, 0.1, 0.6, 0.4)).toBe(false); // back, but too soon
    expect(t.update(1, 1 / 60, true, 0.3, 0.1, 0.6, 0.4)).toBe(true); // the other hand is free
    t.update(0, 1, false, 0, 0, 0, 0);
    expect(t.update(0, 1 / 60, true, 0.3, 0.1, 0.6, 0.4)).toBe(true);
  });

  it('ignores a graze and a hand that is not on the stage', () => {
    const t = new PropTouch();
    t.setPolygons([poly(0, 0, 0.4, 0.2)]);
    expect(t.update(0, 1 / 60, true, 0.39, 0.1, 0.6, 0.4)).toBe(false);
    expect(t.update(0, 1 / 60, false, 0.1, 0.1, 0.3, 0.2)).toBe(false);
  });

  it('copes with no props and with a flat polygon', () => {
    const t = new PropTouch();
    t.setPolygons([]);
    expect(t.update(0, 1, true, 0, 0, 1, 1)).toBe(false);
    t.setPolygons([poly(0.1, 0.1, 0.1, 0.5)]);
    expect(t.update(0, 1, true, 0, 0, 1, 1)).toBe(false);
  });
});
