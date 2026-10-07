import { Quaternion } from '@iwsdk/core';
import { describe, expect, it } from 'vitest';
import { createHandFrame, type HandFrame } from '../hands/hand';
import type { LanternLight } from '../shadow/pure/lantern-light';
import { CandleView } from './candle-view';

function setPalm(hand: HandFrame, x: number, y: number, z: number): void {
  hand.tracked = true;
  hand.validJoints = 25;
  // Joint 10 (metacarpal, index 30) and Joint 11 (proximal, index 33)
  hand.positions[30] = x;
  hand.positions[31] = y;
  hand.positions[32] = z;
  hand.positions[33] = x;
  hand.positions[34] = y;
  hand.positions[35] = z;
}

describe('CandleView', () => {
  it('builds the group with plate, rim, wax, wick, flame quad, point light, and feedback rings', () => {
    const candle = new CandleView();
    expect(candle.group.children).toHaveLength(8);
    expect(candle.pointLight.castShadow).toBe(false);
    expect(candle.pointLight.position.y).toBeCloseTo(0.095, 3);
    expect(candle.flame.mesh.position.y).toBeCloseTo(0.095, 3);
    expect(candle.lightIntensity).toBe(1.2);
    expect(candle.state).toBe('placed');
    expect(candle.isHeld).toBe(false);
  });

  it('places the candle group and syncs flamePosition', () => {
    const candle = new CandleView();
    candle.place([0.1, 0.75, -0.4]);
    expect(candle.group.position.x).toBeCloseTo(0.1, 4);
    expect(candle.group.position.y).toBeCloseTo(0.75, 4);
    expect(candle.group.position.z).toBeCloseTo(-0.4, 4);

    expect(candle.flamePosition[0]).toBeCloseTo(0.1, 4);
    expect(candle.flamePosition[1]).toBeCloseTo(0.75 + 0.095, 4);
    expect(candle.flamePosition[2]).toBeCloseTo(-0.4, 4);
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
    expect(candle.lightIntensity).toBeCloseTo(1.05 * 1.5, 4);
    expect(candle.pointLight.color.r).toBeCloseTo(1.0, 4);
    expect(candle.pointLight.color.g).toBeCloseTo(0.6, 4);
    expect(candle.pointLight.color.b).toBeCloseTo(0.2, 4);

    // When extinguished (lit = false, intensity = 0), point light goes to 0
    light.lit = false;
    light.intensity = 0;
    candle.update(light, cameraQuat);
    expect(candle.lightIntensity).toBe(0);
  });

  it('handles two-handed pickup, moving, and 1-second separation placement feedback', () => {
    const candle = new CandleView();
    candle.place([0, 0.75, -0.4]);

    const left = createHandFrame('left');
    const right = createHandFrame('right');

    // Hands positioned far away: no pickup
    setPalm(left, -0.4, 0.75, -0.4);
    setPalm(right, 0.4, 0.75, -0.4);
    let res = candle.updateInteraction({ left, right }, 0.016);
    expect(res.state).toBe('placed');
    expect(candle.isHeld).toBe(false);

    // Hands brought together near the candle (<0.22m from candle, <0.24m between hands)
    setPalm(left, -0.08, 0.76, -0.4);
    setPalm(right, 0.08, 0.76, -0.4);
    res = candle.updateInteraction({ left, right }, 0.016);
    expect(res.state).toBe('held');
    expect(res.justPickedUp).toBe(true);
    expect(candle.isHeld).toBe(true);
    expect(candle.flame.mesh.scale.x).toBeCloseTo(1.25, 2);

    // Hands move forward and to the right
    setPalm(left, 0.1, 0.8, -0.5);
    setPalm(right, 0.2, 0.8, -0.5);
    res = candle.updateInteraction({ left, right }, 0.1);
    expect(res.state).toBe('held');
    expect(candle.group.position.x).toBeGreaterThan(0.0);
    expect(candle.group.position.z).toBeLessThan(-0.4);
    expect(candle.flamePosition[1]).toBeCloseTo(candle.group.position.y + 0.095, 4);

    // Hands move far enough apart (>0.28m) -> triggers placement and 1-second feedback
    setPalm(left, -0.1, 0.8, -0.5);
    setPalm(right, 0.25, 0.8, -0.5); // 0.35m distance apart
    res = candle.updateInteraction({ left, right }, 0.016);
    expect(res.state).toBe('placing');
    expect(res.justPlaced).toBe(true);
    expect(candle.isPlacing).toBe(true);

    // Progress through feedback animation (0.5s elapsed)
    res = candle.updateInteraction({ left, right }, 0.5);
    expect(res.state).toBe('placing');
    expect(candle.isPlacing).toBe(true);

    // Finalize 1-second feedback (another 0.6s elapsed, total > 1.0s)
    res = candle.updateInteraction({ left, right }, 0.6);
    expect(res.state).toBe('placed');
    expect(candle.isPlacing).toBe(false);
    expect(candle.isHeld).toBe(false);
    expect(candle.flame.mesh.scale.x).toBeCloseTo(1.0, 2);
  });

  it('disposes resources cleanly without error', () => {
    const candle = new CandleView();
    expect(() => candle.dispose()).not.toThrow();
  });
});
