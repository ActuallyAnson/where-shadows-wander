import { describe, expect, it } from 'vitest';
import { LightHush } from './light-hush';

describe('LightHush', () => {
  it('starts at the candle’s own light', () => {
    expect(new LightHush().level).toBe(1);
  });

  it('eases down and back over the given seconds, stopping on its target', () => {
    const h = new LightHush();
    h.to(0.4, 0.2);
    h.update(0.1);
    expect(h.level).toBeCloseTo(0.7);
    h.update(1);
    expect(h.level).toBe(0.4);
    h.to(1, 0.6);
    h.update(0.3);
    expect(h.level).toBeCloseTo(0.7);
    h.update(5);
    expect(h.level).toBe(1);
  });

  it('jumps for no seconds, keeps the level within 0..1, and ignores bad steps', () => {
    const h = new LightHush();
    h.to(-3, 0);
    expect(h.level).toBe(0);
    h.to(9, 1);
    h.update(NaN);
    h.update(-1);
    expect(h.level).toBe(0);
    h.update(0.5);
    expect(h.level).toBeCloseTo(0.5);
  });

  it('resets to the full light at once', () => {
    const h = new LightHush();
    h.to(0.2, 0);
    h.reset();
    expect(h.level).toBe(1);
    h.update(1);
    expect(h.level).toBe(1);
  });
});
