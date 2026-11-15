import { Quaternion } from '@iwsdk/core';
import { describe, expect, it } from 'vitest';
import { createHandFrame, JOINT } from '../hands/hand';
import { TitleLighterView } from './title-lighter-view';

describe('TitleLighterView', () => {
  it('creates lighter with stick, head, flame, and point light', () => {
    const lighter = new TitleLighterView();
    expect(lighter.group.children).toHaveLength(4);
    expect(lighter.visible).toBe(false);
    expect(lighter.pointLight.castShadow).toBe(false);
  });

  it('sits in the pinch, between the thumb and index tips', () => {
    const lighter = new TitleLighterView();
    lighter.visible = true;
    const hand = createHandFrame('right');
    hand.tracked = true;
    hand.validJoints = 25;

    const idx = JOINT['index-finger-tip'] * 3;
    hand.positions[idx] = 0.15;
    hand.positions[idx + 1] = 0.82;
    hand.positions[idx + 2] = -0.35;
    const thb = JOINT['thumb-tip'] * 3;
    hand.positions[thb] = 0.13;
    hand.positions[thb + 1] = 0.8;
    hand.positions[thb + 2] = -0.33;

    const cameraQuat = new Quaternion();
    lighter.update(hand, cameraQuat, 1.0);

    expect(lighter.group.position.x).toBeCloseTo(0.14, 4);
    expect(lighter.group.position.y).toBeCloseTo(0.81, 4);
    expect(lighter.group.position.z).toBeCloseTo(-0.34, 4);

    expect(lighter.flamePosition[0]).toBeCloseTo(0.14, 4);
    expect(lighter.flamePosition[1]).toBeCloseTo(0.81 + 0.065, 4);
    expect(lighter.flamePosition[2]).toBeCloseTo(-0.34, 4);
    expect(lighter.pointLight.intensity).toBeGreaterThan(0.5);
  });

  it('hides cleanly and zeros light intensity', () => {
    const lighter = new TitleLighterView();
    lighter.visible = true;
    expect(lighter.visible).toBe(true);
    lighter.visible = false;
    expect(lighter.visible).toBe(false);
    expect(lighter.pointLight.intensity).toBe(0);
  });

  it('disposes resources cleanly', () => {
    const lighter = new TitleLighterView();
    expect(() => lighter.dispose()).not.toThrow();
  });
});
