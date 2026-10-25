import { Quaternion } from '@iwsdk/core';
import { describe, expect, it } from 'vitest';
import type { LanternLight } from '../../shadow/pure/lantern-light';
import { BedroomView, MOONLIGHT_COLOR } from './bedroom-view';

describe('BedroomView', () => {
  it('constructs room shell, props, and moonlight within budget', () => {
    const room = new BedroomView();

    // Group contains main shell, walls, window, pallet, tin can, and moonlight
    expect(room.group.children.length).toBeGreaterThan(10);
    expect(room.floorMesh).toBeDefined();
    expect(room.ceilingMesh).toBeDefined();
    expect(room.frontWallMesh).toBeDefined();
    expect(room.windowGroup.children.length).toBeGreaterThan(5);
    expect(room.strawPalletGroup.children.length).toBe(3);
    expect(room.tinCanGroup.children.length).toBe(2);

    // Moonlight
    expect(room.moonlight.color.getHex()).toBe(MOONLIGHT_COLOR);
    expect(room.moonlight.intensity).toBeCloseTo(0.45, 2);
  });

  it('aligns with player seated position and yaw and places front wall behind stage', () => {
    const room = new BedroomView();
    room.place([0.5, 1.15, -0.2], Math.PI / 4, 2.0);

    expect(room.group.position.x).toBeCloseTo(0.5, 3);
    expect(room.group.position.y).toBeCloseTo(0, 3);
    expect(room.group.position.z).toBeCloseTo(-0.2, 3);
    expect(room.group.rotation.y).toBeCloseTo(Math.PI / 4, 3);
    // 2.0m stage distance -> front wall at -(2.0 + 0.35) = -2.35m
    expect(room.frontWallMesh.position.z).toBeCloseTo(-2.35, 3);
  });

  it('transitions between lit warm candlelight and unlit blue moonlight', () => {
    const room = new BedroomView();
    const quat = new Quaternion();
    const light: LanternLight = {
      position: new Float64Array([0, 0.65, -0.45]),
      lit: false,
      intensity: 0,
      color: new Float32Array([1.0, 0.6, 0.2]),
      flicker: 0,
    };

    // Phase 1 (Unlit): Room bathed in moonlight
    room.update(light, quat);
    expect(room.moonlight.intensity).toBeCloseTo(0.45, 2);

    // Phase 2 (Lit): Room warms with candlelight
    light.lit = true;
    light.intensity = 1.0;
    room.update(light, quat);
    expect(room.moonlight.intensity).toBeCloseTo(0.22, 2);

    // Phase 3 (Flame Covered/Smothered): Dims back down to moonlight
    room.update(light, quat, 0.0);
    expect(room.moonlight.intensity).toBeCloseTo(0.45, 2);
  });

  it('disposes resources cleanly', () => {
    const room = new BedroomView();
    expect(() => room.dispose()).not.toThrow();
  });
});
