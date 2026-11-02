import { describe, expect, it } from 'vitest';
import { BuntingView, CALM_WIND, FAN_WIND } from './bunting-view';

const run = (v: BuntingView, seconds: number) => {
  for (let t = 0; t < seconds; t += 1 / 60) v.update(1 / 60);
};
const positions = (v: BuntingView) =>
  Array.from((v.mesh.geometry.attributes.position as unknown as { array: Float32Array }).array);

describe('BuntingView', () => {
  it('is one mesh: nine flags and a rope in each of two strands', () => {
    const v = new BuntingView();
    const index = v.mesh.geometry.index!;
    expect(index.count).toBe(2 * (9 * 3 + 18 * 6));
    expect(positions(v).every(Number.isFinite)).toBe(true);
    v.dispose();
  });

  it('sags and sways: after a few seconds the flags have moved from where they started, and the breeze keeps them moving', () => {
    const v = new BuntingView();
    const start = positions(v);
    run(v, 4);
    const later = positions(v);
    let moved = 0;
    for (let i = 0; i < start.length; i++) moved = Math.max(moved, Math.abs(start[i] - later[i]));
    expect(moved).toBeGreaterThan(0.05); // it sagged
    expect(v.motion).toBeGreaterThan(0); // and the breeze moves it
    v.dispose();
  });

  it('is blown much harder by the fan wind than by the calm breeze, and settles back when the wind drops', () => {
    const calm = new BuntingView();
    const fan = new BuntingView();
    calm.setWind(CALM_WIND);
    fan.setWind(FAN_WIND);
    run(calm, 8);
    run(fan, 8);
    const mid = (v: BuntingView) => positions(v)[(9 * 3 + 9 * 4) * 3]; // the middle of the first rope, x
    expect(Math.abs(mid(fan) - mid(calm))).toBeGreaterThan(0.01);
    fan.setWind(0);
    run(fan, 20);
    expect(fan.motion).toBeLessThan(0.1);
    calm.dispose();
    fan.dispose();
  });

  it('ripples when something lands on it, and the ripple dies away', () => {
    const v = new BuntingView();
    v.setWind(0);
    run(v, 15);
    const still = v.motion;
    v.ripple(-1.0, 2.02, 4);
    run(v, 0.4);
    expect(v.motion).toBeGreaterThan(still * 2 + 0.01);
    run(v, 25);
    expect(v.motion).toBeLessThan(0.1);
    v.dispose();
  });

  it('sits where it is placed, ignores bad times and bad wind, and never goes non-finite', () => {
    const v = new BuntingView();
    v.place(-2.3);
    expect(v.mesh.position.z).toBe(-2.3);
    v.setWind(NaN);
    v.update(-1);
    v.update(NaN);
    v.update(9);
    expect(positions(v).every(Number.isFinite)).toBe(true);
    v.dispose();
  });
});
