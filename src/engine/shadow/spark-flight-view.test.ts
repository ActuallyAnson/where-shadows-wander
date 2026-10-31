import { describe, expect, it } from 'vitest';
import { SparkFlightView } from './spark-flight-view';

const from = { x: 0, y: 1.2, z: -2 };
const to = { x: 1.8, y: 1.7, z: -1.2 };
const run = (v: SparkFlightView, seconds: number) => {
  for (let t = 0; t < seconds - 1e-9; t += 0.02) v.update(0.02);
};
const head = (v: SparkFlightView) => {
  const pos = (v.group.children[0] as unknown as { geometry: { attributes: { position: { array: Float32Array } } } })
    .geometry.attributes.position.array;
  return { x: pos[0], y: pos[1], z: pos[2] };
};

describe('SparkFlightView', () => {
  it('is hidden and not flying until it is launched', () => {
    const v = new SparkFlightView();
    expect(v.flying).toBe(false);
    expect(v.group.visible).toBe(false);
    expect(() => v.update(0.1)).not.toThrow();
    v.dispose();
  });

  it('flies from the start to the target, calls back once on landing, then bursts and is done', () => {
    const v = new SparkFlightView();
    let landed = 0;
    v.launch(from, to, () => landed++, 1.5);
    expect(v.flying).toBe(true);
    expect(v.group.visible).toBe(true);
    run(v, 0.75);
    expect(landed).toBe(0);
    expect(v.progress).toBeGreaterThan(0.3);
    expect(v.progress).toBeLessThan(0.7);
    run(v, 1);
    expect(landed).toBe(1);
    const h = head(v);
    expect(h.x).toBeCloseTo(to.x, 3);
    expect(h.y).toBeCloseTo(to.y, 3);
    run(v, 2);
    expect(landed).toBe(1);
    expect(v.flying).toBe(false);
    expect(v.group.visible).toBe(false);
    v.dispose();
  });

  it('rises above both ends on the way (an arc, not a straight line)', () => {
    const v = new SparkFlightView();
    v.launch(from, to, () => undefined, 1.5);
    let highest = 0;
    for (let i = 0; i < 70; i++) {
      v.update(0.02);
      highest = Math.max(highest, head(v).y);
    }
    expect(highest).toBeGreaterThan(Math.max(from.y, to.y) + 0.2);
    v.dispose();
  });

  it('eases: it moves slowly at first and at the end, faster in the middle', () => {
    const v = new SparkFlightView();
    v.launch(from, to, () => undefined, 2);
    run(v, 0.2);
    const early = v.progress;
    run(v, 0.8);
    const mid = v.progress;
    expect(early).toBeLessThan(0.1);
    expect(mid).toBeGreaterThan(0.4);
    v.dispose();
  });

  it('can be cleared in flight without calling back, and a new launch replaces a flying spark', () => {
    const v = new SparkFlightView();
    let a = 0;
    let b = 0;
    v.launch(from, to, () => a++, 1);
    run(v, 0.4);
    v.clear();
    run(v, 2);
    expect(a).toBe(0);
    v.launch(from, to, () => a++, 1);
    run(v, 0.3);
    v.launch(from, to, () => b++, 1);
    run(v, 1.5);
    expect(a).toBe(0);
    expect(b).toBe(1);
    v.dispose();
  });

  it('ignores a frame time that is negative or not a number', () => {
    const v = new SparkFlightView();
    v.launch(from, to, () => undefined, 1);
    expect(() => {
      v.update(-1);
      v.update(NaN);
    }).not.toThrow();
    expect(v.progress).toBe(0);
    v.dispose();
  });
});
