import { Quaternion, Vector3 } from '@iwsdk/core';
import { describe, expect, it } from 'vitest';
import type { LanternLight } from '../../shadow/pure/lantern-light';
import { emptyRoomLayout, placement } from '../../stage/room-layout';
import { BedroomView, MOONLIGHT_COLOR, PLAYER_SPOT_LIMITS } from './bedroom-view';

describe('BedroomView', () => {
  it('constructs room shell, props, and moonlight within budget', () => {
    const room = new BedroomView();

    // Group contains main shell, walls, window, pallet, tin can, and moonlight
    expect(room.group.children.length).toBeGreaterThan(10);
    expect(room.floorMesh).toBeDefined();
    expect(room.ceilingMesh).toBeDefined();
    expect(room.frontWallMesh).toBeDefined();
    expect(room.windowGroup.children.length).toBeGreaterThanOrEqual(3); // the merged frame, the sky, the moon wash
    expect(room.strawPalletGroup.children.length).toBe(3);
    expect(room.tinCanGroup.children.length).toBe(2);

    // Moonlight
    expect(room.moonlight.color.getHex()).toBe(MOONLIGHT_COLOR);
    expect(room.moonlight.intensity).toBeCloseTo(0.05, 2);
  });

  it('aligns with player seated position and yaw and places front wall behind stage', () => {
    const room = new BedroomView();
    room.place([0.5, 1.15, -0.2], Math.PI / 4, 2.0);

    expect(room.group.position.x).toBeCloseTo(0.5, 3);
    expect(room.group.position.y).toBeCloseTo(0, 3);
    expect(room.group.position.z).toBeCloseTo(-0.2, 3);
    expect(room.group.rotation.y).toBeCloseTo(Math.PI / 4, 3);
    // 2.0m stage distance -> the front wall just behind the stage, which is on it: -(2.0 + 0.02) = -2.02m
    expect(room.frontWallMesh.position.z).toBeCloseTo(-2.02, 3);
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

    // Phase 1 (Unlit): Room dark in subtle moonlight
    room.update(light, quat);
    expect(room.moonlight.intensity).toBeCloseTo(0.05, 2);

    // Phase 2 (Lit): Room warms with candlelight
    light.lit = true;
    light.intensity = 1.0;
    room.update(light, quat);
    expect(room.moonlight.intensity).toBeCloseTo(0.2, 2);

    // Phase 3 (Flame Covered/Smothered): Dims back down to dark
    room.update(light, quat, 0.0);
    expect(room.moonlight.intensity).toBeCloseTo(0.05, 2);
  });

  it('disposes resources cleanly', () => {
    const room = new BedroomView();
    expect(() => room.dispose()).not.toThrow();
  });

  it('stands the tin can where the room layout says (its default by the bed)', () => {
    expect(new BedroomView().tinCanGroup.position.toArray()).toEqual([0.95, 0, -0.4]);
    const layout = emptyRoomLayout();
    layout.room['tin-can'] = placement([1.1, 0, 0.2], [0, 30, 0]);
    const v = new BedroomView(layout);
    expect(v.editables().map((p) => p.id)).toEqual(['tin-can', 'player']);
    expect(v.tinCanGroup.position.toArray()).toEqual([1.1, 0, 0.2]);
    expect(v.tinCanGroup.rotation.y).toBeCloseTo(Math.PI / 6, 6);
  });

  it("stands the room so the player's spot is under the head, with the front wall the stage's distance ahead of it", () => {
    const layout = emptyRoomLayout();
    layout.room.player = placement([0.5, 0, 0.05]);
    const v = new BedroomView(layout);
    v.place([1, 1.2, 2], Math.PI / 2, 2.0);
    v.group.updateMatrixWorld(true);
    const spot = v.playerSpot.getWorldPosition(new Vector3());
    expect(spot.x).toBeCloseTo(1, 6);
    expect(spot.z).toBeCloseTo(2, 6);
    expect(v.frontWallMesh.position.z).toBeCloseTo(0.05 - 2.02, 6);
  });

  it("keeps the player's spot inside the room", () => {
    const layout = emptyRoomLayout();
    layout.room.player = placement([5, 0, -5]);
    const v = new BedroomView(layout);
    expect(v.playerX()).toBe(PLAYER_SPOT_LIMITS.x);
    expect(v.playerZ()).toBe(PLAYER_SPOT_LIMITS.zMin);
  });

  it("tells main.ts when the editor moves the player's spot, and not for other pieces", () => {
    const v = new BedroomView();
    let told = 0;
    v.onPlayerMoved = () => told++;
    const [can, player] = v.editables();
    v.moved(can);
    v.moved(player);
    expect(told).toBe(1);
  });
});
