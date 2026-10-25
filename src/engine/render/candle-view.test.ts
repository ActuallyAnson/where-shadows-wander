import { Quaternion } from '@iwsdk/core';
import { describe, expect, it } from 'vitest';
import { createHandFrame, JOINT, type HandFrame } from '../hands/hand';
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

function setHandJointsDown(hand: HandFrame, x: number, y: number, z: number): void {
  hand.tracked = true;
  hand.validJoints = 25;
  for (let j = 0; j < 25; j++) {
    hand.positions[j * 3] = x;
    hand.positions[j * 3 + 1] = y;
    hand.positions[j * 3 + 2] = z;
  }
  // Setup wrist and knuckles for palm downward normal.
  // For a left hand facing palm down: forward is -Z, across (pinky - index) is -X.
  const wrist = JOINT.wrist * 3;
  const midMeta = JOINT['middle-finger-metacarpal'] * 3;
  const midProx = JOINT['middle-finger-phalanx-proximal'] * 3;
  const idxProx = JOINT['index-finger-phalanx-proximal'] * 3;
  const pnkProx = JOINT['pinky-finger-phalanx-proximal'] * 3;

  hand.positions[wrist] = x;
  hand.positions[wrist + 1] = y;
  hand.positions[wrist + 2] = z + 0.08;

  hand.positions[midMeta] = x;
  hand.positions[midMeta + 1] = y;
  hand.positions[midMeta + 2] = z;

  hand.positions[midProx] = x;
  hand.positions[midProx + 1] = y;
  hand.positions[midProx + 2] = z - 0.05;

  hand.positions[idxProx] = x + 0.04;
  hand.positions[idxProx + 1] = y;
  hand.positions[idxProx + 2] = z - 0.05;

  hand.positions[pnkProx] = x - 0.04;
  hand.positions[pnkProx + 1] = y;
  hand.positions[pnkProx + 2] = z - 0.05;
}

describe('CandleView', () => {
  it('builds the group with plate, rim, wax, wick, flame quad, point light, and feedback rings', () => {
    const candle = new CandleView();
    expect(candle.group.children).toHaveLength(9);
    expect(candle.pointLight.castShadow).toBe(false);
    expect(candle.pointLight.position.y).toBeCloseTo(0.095, 3);
    expect(candle.flame.mesh.position.y).toBeCloseTo(0.095, 3);
    expect(candle.lightIntensity).toBe(1.2);
    expect(candle.state).toBe('placed');
    expect(candle.isHeld).toBe(false);
    expect(candle.lit).toBe(true);
    expect(candle.isLocked).toBe(false);
    expect(candle.isCovered).toBe(false);
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

  it('handles unlit state and wick pinch ignition', () => {
    const candle = new CandleView();
    candle.place([0, 0.75, -0.4]);
    candle.lit = false;
    expect(candle.lit).toBe(false);
    expect(candle.lightIntensity).toBe(0);

    const hand = createHandFrame('right');
    hand.tracked = true;
    hand.validJoints = 25;

    // Hand far away
    for (let j = 0; j < 25; j++) {
      hand.positions[j * 3] = 0.5;
      hand.positions[j * 3 + 1] = 0.5;
      hand.positions[j * 3 + 2] = -0.4;
    }
    expect(candle.checkIgnition([hand])).toBe(false);

    // Touch index tip to wick (wick is at 0, 0.75 + 0.095 = 0.845, -0.4)
    const idx = JOINT['index-finger-tip'] * 3;
    hand.positions[idx] = 0;
    hand.positions[idx + 1] = 0.85;
    hand.positions[idx + 2] = -0.4;

    expect(candle.checkIgnition([hand])).toBe(true);

    // Once lit, ignition returns false
    candle.lit = true;
    expect(candle.checkIgnition([hand])).toBe(false);
  });

  it('disables pickup when locked', () => {
    const candle = new CandleView();
    candle.place([0, 0.75, -0.4]);
    candle.setLocked(true);
    expect(candle.isLocked).toBe(true);

    const left = createHandFrame('left');
    const right = createHandFrame('right');
    setPalm(left, -0.05, 0.76, -0.4);
    setPalm(right, 0.05, 0.76, -0.4);

    const res = candle.updateInteraction({ left, right }, 0.2);
    expect(res.state).toBe('placed');
    expect(candle.isHeld).toBe(false);
  });

  it('detects palm hovering over flame to trigger isCovered pause', () => {
    const candle = new CandleView();
    candle.place([0, 0.75, -0.4]);
    const left = createHandFrame('left');
    const right = createHandFrame('right');
    right.tracked = false;

    // Position palm 6 cm above wick with normal pointing downward
    // Wick is at y = 0.75 + 0.095 = 0.845
    setHandJointsDown(left, 0.0, 0.9, -0.4);

    // Step 0.2s: not yet covered (needs ~0.4s)
    candle.updateInteraction({ left, right }, 0.2);
    expect(candle.isCovered).toBe(false);

    // Step another 0.25s: now covered!
    candle.updateInteraction({ left, right }, 0.25);
    expect(candle.isCovered).toBe(true);

    // Removing hand: step 0.3s clears cover
    setPalm(left, 0.5, 0.9, -0.4);
    candle.updateInteraction({ left, right }, 0.3);
    expect(candle.isCovered).toBe(false);
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

    // Hands brought together grasping the saucer (<0.13m from candle, height matched)
    setPalm(left, -0.05, 0.76, -0.4);
    setPalm(right, 0.05, 0.76, -0.4);
    // Dwell step 1 (0.05s elapsed < 0.12s dwell requirement): preview aura, still placed
    res = candle.updateInteraction({ left, right }, 0.05);
    expect(res.state).toBe('placed');
    expect(candle.isHeld).toBe(false);

    // Dwell step 2 (additional 0.10s elapsed >= 0.12s): confirmed pickup!
    res = candle.updateInteraction({ left, right }, 0.1);
    expect(res.state).toBe('held');
    expect(res.justPickedUp).toBe(true);
    expect(candle.isHeld).toBe(true);
    expect(candle.flame.mesh.scale.x).toBeCloseTo(1.25, 2);

    // Hands move forward and to the right
    setPalm(left, 0.05, 0.78, -0.45);
    setPalm(right, 0.15, 0.78, -0.45);
    res = candle.updateInteraction({ left, right }, 0.1);
    expect(res.state).toBe('held');
    expect(candle.group.position.x).toBeGreaterThan(0.0);
    expect(candle.group.position.z).toBeLessThan(-0.4);
    expect(candle.flamePosition[1]).toBeCloseTo(candle.group.position.y + 0.095, 4);

    // Hands move far enough apart (>0.22m) -> triggers placement and 1-second feedback
    setPalm(left, -0.15, 0.78, -0.45);
    setPalm(right, 0.15, 0.78, -0.45); // 0.30m distance apart
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

  it('dims light when a hand is close to the flame (light occlusion)', () => {
    const candle = new CandleView();
    candle.place([0, 0.75, -0.4]);
    const cameraQuat = new Quaternion(0, 0, 0, 1);
    const light: LanternLight = {
      position: new Float64Array([0, 1, 0]),
      lit: true,
      intensity: 1.0,
      color: new Float32Array([1.0, 0.6, 0.2]),
      flicker: 0,
    };

    const left = createHandFrame('left');
    const right = createHandFrame('right');

    // Hands far from flame: full intensity (1.0 * 1.5 = 1.5)
    setPalm(left, -0.4, 0.75, -0.4);
    setPalm(right, 0.4, 0.75, -0.4);
    candle.updateInteraction({ left, right }, 0.016);
    candle.update(light, cameraQuat);
    expect(candle.occlusion).toBe(1.0);
    expect(candle.lightIntensity).toBeCloseTo(1.5, 3);

    // Hand placed right over the flame (flame at y = 0.75 + 0.095 = 0.845)
    setPalm(left, 0.0, 0.86, -0.4); // ~1.5 cm from flame (< 4cm)
    candle.updateInteraction({ left, right }, 0.016);
    candle.update(light, cameraQuat);
    expect(candle.occlusion).toBe(0.0);
    expect(candle.lightIntensity).toBe(0.0);

    // Hand intermediate distance (~10 cm from flame)
    setPalm(left, 0.0, 0.945, -0.4); // 10 cm from flame
    candle.updateInteraction({ left, right }, 0.016);
    candle.update(light, cameraQuat);
    expect(candle.occlusion).toBeGreaterThan(0.0);
    expect(candle.occlusion).toBeLessThan(1.0);

    // Single hand tracked cupping the flame still occludes
    right.tracked = false;
    setPalm(left, 0.0, 0.86, -0.4);
    candle.updateInteraction({ left, right }, 0.016);
    expect(candle.occlusion).toBe(0.0);
  });

  it('disposes resources cleanly without error', () => {
    const candle = new CandleView();
    expect(() => candle.dispose()).not.toThrow();
  });
});
