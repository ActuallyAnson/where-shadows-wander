import { describe, expect, it } from 'vitest';
import { Hopper, HOPPER_LIFE_S } from './hopper';

function run(h: Hopper, seconds: number, onStep?: () => void): void {
  for (let i = 0; i < seconds * 60; i++) {
    h.update(1 / 60, 0.8);
    onStep?.();
  }
}

describe('Hopper', () => {
  it('is idle until spawned, then appears at its spot', () => {
    const h = new Hopper();
    expect(h.active).toBe(false);
    expect(h.alpha).toBe(0);
    h.spawn(0.2, -0.1, 1);
    expect(h.active).toBe(true);
    expect([h.x, h.y]).toEqual([0.2, -0.1]);
  });

  it('hops away in the way it faces, leaving the ground and coming back to it', () => {
    const h = new Hopper();
    h.spawn(0, 0, 1);
    let high = 0;
    let airborne = false;
    run(h, 2, () => {
      high = Math.max(high, h.y);
      airborne ||= h.frame === 1;
    });
    expect(high).toBeGreaterThan(0.04);
    expect(airborne).toBe(true);
    expect(h.x).toBeGreaterThan(0.1);
  });

  it('turns round at the edge and keeps inside the stage', () => {
    const h = new Hopper();
    h.spawn(0.6, 0, 1);
    let max = 0;
    run(h, HOPPER_LIFE_S - 0.1, () => (max = Math.max(max, Math.abs(h.x))));
    expect(max).toBeLessThan(0.8);
  });

  it('fades out and ends', () => {
    const h = new Hopper();
    h.spawn(0, 0, -1);
    run(h, HOPPER_LIFE_S - 0.5);
    expect(h.alpha).toBeLessThan(0.6);
    run(h, 1);
    expect(h.active).toBe(false);
  });

  it('ignores bad steps and can be stopped', () => {
    const h = new Hopper();
    h.spawn(0, 0, 1);
    h.update(-1, 0.8);
    h.update(NaN, 0.8);
    expect(h.age).toBe(0);
    h.stop();
    expect(h.active).toBe(false);
  });
});
