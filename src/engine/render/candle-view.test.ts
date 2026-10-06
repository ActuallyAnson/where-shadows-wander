import { Quaternion } from '@iwsdk/core';
import { describe, expect, it } from 'vitest';
import type { LanternLight } from '../shadow/pure/lantern-light';
import { CandleView } from './candle-view';

describe('CandleView', () => {
  it('builds the group with plate, rim, wax, wick, flame quad, and point light', () => {
    const candle = new CandleView();
    expect(candle.group.children).toHaveLength(6);
    expect(candle.pointLight.castShadow).toBe(false);
    expect(candle.pointLight.position.y).toBeCloseTo(0.095, 3);
    expect(candle.flame.mesh.position.y).toBeCloseTo(0.095, 3);
    expect(candle.lightIntensity).toBe(1.0);
  });

  it('places the candle group at world coordinates', () => {
    const candle = new CandleView();
    candle.place([0.1, 0.75, -0.4]);
    expect(candle.group.position.x).toBeCloseTo(0.1, 4);
    expect(candle.group.position.y).toBeCloseTo(0.75, 4);
    expect(candle.group.position.z).toBeCloseTo(-0.4, 4);
  });

  it('updates flame, point light color, and flicker intensity', () => {
    const candle = new CandleView();
    const cameraQuat = new Quaternion(0, 0, 0, 1);
    const light: LanternLight = {
      position: new Float64Array([0, 1, 0]),
      lit: true,
      intensity: 1.05,
      color: new Float32Array([1.0, 0.6, 0.2]),
      flicker: 0.05,
    };

    candle.update(light, cameraQuat);
    expect(candle.lightIntensity).toBeCloseTo(1.05 * 1.2, 4);
    expect(candle.pointLight.color.r).toBeCloseTo(1.0, 4);
    expect(candle.pointLight.color.g).toBeCloseTo(0.6, 4);
    expect(candle.pointLight.color.b).toBeCloseTo(0.2, 4);

    // When extinguished (lit = false, intensity = 0), point light goes to 0
    light.lit = false;
    light.intensity = 0;
    candle.update(light, cameraQuat);
    expect(candle.lightIntensity).toBe(0);
  });

  it('disposes resources cleanly without error', () => {
    const candle = new CandleView();
    expect(() => candle.dispose()).not.toThrow();
  });
});
