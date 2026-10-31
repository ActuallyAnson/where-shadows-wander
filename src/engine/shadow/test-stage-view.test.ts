import { describe, expect, it } from 'vitest';
import { TestStageView } from './test-stage-view';

describe('TestStageView set change', () => {
  const light: Parameters<TestStageView['applyLight']>[0] = {
    position: new Float64Array(3),
    lit: true,
    intensity: 1,
    color: new Float32Array([1, 0.8, 0.5]),
    flicker: 0,
  };
  const quat = { x: 0, y: 0, z: 0, w: 1 } as unknown as Parameters<TestStageView['applyLight']>[1];
  const shift = (v: TestStageView) =>
    (v as unknown as { paperMaterial: { uniforms: { uMidShift: { value: number } } } }).paperMaterial.uniforms.uMidShift
      .value;

  it('puts the first puzzle scenery up at once, then slides one set off and the next on, ending still', () => {
    const v = new TestStageView();
    v.setTheme(0);
    expect(shift(v)).toBe(0);
    v.setTheme(1);
    let peak = 0;
    for (let i = 0; i < 40; i++) {
      v.applyLight(light, quat, 1, undefined, 0.03);
      peak = Math.max(peak, Math.abs(shift(v)));
    }
    expect(peak).toBeGreaterThan(0.5); // it slid
    expect(Math.abs(shift(v))).toBe(0); // and came to rest
    v.setTheme(1); // the same set again changes nothing
    v.applyLight(light, quat, 1, undefined, 0.03);
    expect(shift(v)).toBe(0);
    v.setTheme(99); // a number past the last is the last
    v.setTheme(-5);
    v.dispose();
  });
});
