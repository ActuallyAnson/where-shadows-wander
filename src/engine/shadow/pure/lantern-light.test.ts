import { describe, expect, it } from 'vitest';
import { flicker } from './lantern-flicker';
import { LanternLightModel } from './lantern-light';

const FPS = 72;

describe('lantern flicker', () => {
  it('is repeatable: the same time and seed give the same value, other seeds differ', () => {
    expect(flicker(3.7, 4)).toBe(flicker(3.7, 4));
    expect(flicker(3.7, 4)).not.toBe(flicker(3.7, 5));
  });

  it('stays within -1..1 and averages about zero over a minute', () => {
    let sum = 0;
    const n = 60 * FPS;
    for (let i = 0; i < 100_000; i++) expect(Math.abs(flicker(i * 0.013, 2))).toBeLessThanOrEqual(1);
    for (let i = 0; i < n; i++) sum += flicker(i / FPS, 1);
    expect(Math.abs(sum / n)).toBeLessThan(0.1);
  });

  it('never jumps between frames at 72 Hz', () => {
    let worst = 0;
    for (let seed = 0; seed < 5; seed++)
      for (let i = 1; i < 60 * FPS; i++)
        worst = Math.max(worst, Math.abs(flicker(i / FPS, seed) - flicker((i - 1) / FPS, seed)));
    expect(worst).toBeLessThan(0.15);
  });

  it('is slow: it crosses zero fewer than 8 times a second', () => {
    let crossings = 0;
    let last = flicker(0, 1);
    for (let i = 1; i < 60 * FPS; i++) {
      const v = flicker(i / FPS, 1);
      if (Math.sign(v) !== Math.sign(last)) crossings++;
      last = v;
    }
    expect(crossings / 60).toBeLessThan(8);
  });
});

describe('lantern light', () => {
  const at = [0, 0.65, 0.35];

  it('is out until lit, then fades in', () => {
    const m = new LanternLightModel();
    m.update(0, at, false);
    expect(m.light.intensity).toBe(0);
    for (let i = 1; i <= FPS; i++) m.update(i / FPS, at, true);
    expect(m.light.lit).toBe(true);
    expect(m.light.intensity).toBeGreaterThan(0.9);
    expect(m.light.intensity).toBeLessThan(1.1);
  });

  it('goes out within the fade time (0.25 s) plus a frame when put out', () => {
    const m = new LanternLightModel();
    for (let i = 0; i <= FPS; i++) m.update(i / FPS, at, true);
    for (let i = 1; i <= Math.ceil(0.25 * FPS) + 1; i++) m.update(1 + i / FPS, at, false);
    expect(m.light.intensity).toBe(0);
  });

  it('no lantern (null position) is out', () => {
    const m = new LanternLightModel();
    for (let i = 0; i <= FPS; i++) m.update(i / FPS, at, true);
    for (let i = 1; i <= FPS; i++) m.update(1 + i / FPS, null, true);
    expect(m.light.lit).toBe(false);
    expect(m.light.intensity).toBe(0);
  });

  it('amplitude 0 is a steady light: intensity exactly 1 and the colour never changes', () => {
    const m = new LanternLightModel({ amplitude: 0 });
    m.update(0, at, true);
    const first = Array.from(m.light.color);
    for (let i = 1; i <= 3 * FPS; i++) {
      m.update(i / FPS, at, true);
      if (i > FPS) expect(m.light.intensity).toBe(1);
      expect(Array.from(m.light.color)).toEqual(first);
    }
  });

  it('steady calms the flicker and boost burns brighter, for now, over the setting', () => {
    const m = new LanternLightModel();
    m.steady = 1;
    m.boost = 0.2;
    for (let i = 0; i <= 3 * FPS; i++) {
      m.update(i / FPS, at, true);
      if (i > FPS) expect(m.light.intensity).toBeCloseTo(1.2, 6);
    }
    expect(m.settings.amplitude).toBe(1); // the setting itself is left alone
  });

  it('flickers within the configured depth and keeps colours in 0..1', () => {
    const m = new LanternLightModel();
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = 0; i <= 30 * FPS; i++) {
      m.update(i / FPS, at, true);
      if (i < FPS) continue;
      lo = Math.min(lo, m.light.intensity);
      hi = Math.max(hi, m.light.intensity);
      for (const c of m.light.color) {
        expect(c).toBeGreaterThanOrEqual(0);
        expect(c).toBeLessThanOrEqual(1);
      }
    }
    expect(hi).toBeLessThanOrEqual(1.08 + 1e-6);
    expect(lo).toBeGreaterThanOrEqual(0.92 - 1e-6);
    expect(hi - lo).toBeGreaterThan(0.05); // it does flicker
  });

  it('keeps the position steady: the flicker never moves it', () => {
    const m = new LanternLightModel();
    for (let i = 0; i <= 2 * FPS; i++) m.update(i / FPS, at, true);
    expect(Array.from(m.light.position)).toEqual(at);
  });

  it('a bad clock value changes nothing', () => {
    const m = new LanternLightModel();
    for (let i = 0; i <= FPS; i++) m.update(i / FPS, at, true);
    const before = m.light.intensity;
    m.update(NaN, at, true);
    m.update(Infinity, at, true);
    expect(m.light.intensity).toBe(before);
    m.update(1 + 1 / FPS, at, true);
    expect(Number.isFinite(m.light.intensity)).toBe(true);
  });
});
