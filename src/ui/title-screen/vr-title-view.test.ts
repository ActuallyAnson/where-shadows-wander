import { Quaternion } from '@iwsdk/core';
import { describe, expect, it } from 'vitest';
import { VrTitleView, DISSOLVE_DURATION_S } from './vr-title-view';

describe('VrTitleView', () => {
  it('initializes visible at default eye-level position', () => {
    const title = new VrTitleView();
    expect(title.group.children).toHaveLength(2); // the title and its hint line
    expect(title.group.visible).toBe(true);
    expect(title.opacity).toBe(1.0);
    expect(title.isDissolved).toBe(false);
    expect(title.group.position.y).toBeCloseTo(0.95, 2);
    expect(title.group.position.z).toBeCloseTo(-0.55, 2);
  });

  it('updates position and rotates toward camera', () => {
    const title = new VrTitleView();
    title.place(0.1, 1.0, -0.6);
    expect(title.group.position.x).toBeCloseTo(0.1, 4);

    const quat = new Quaternion();
    quat.setFromAxisAngle({ x: 0, y: 1, z: 0 }, 0.5);
    title.update(0.016, quat);
    expect(title.group.quaternion.y).toBeCloseTo(quat.y, 4);
  });

  it('dissolves over DISSOLVE_DURATION_S upon ignition and hides', () => {
    const title = new VrTitleView();
    title.ignite();

    // Halfway through dissolve
    title.update(DISSOLVE_DURATION_S * 0.5);
    expect(title.opacity).toBeCloseTo(0.5, 1);
    expect(title.isDissolved).toBe(false);
    expect(title.group.visible).toBe(true);

    // Complete dissolve
    title.update(DISSOLVE_DURATION_S * 0.6);
    expect(title.opacity).toBe(0.0);
    expect(title.isDissolved).toBe(true);
    expect(title.group.visible).toBe(false);
  });

  it('fades the hint in when asked, and out again, and not at all once lit', () => {
    const title = new VrTitleView();
    expect(title.hintOpacity).toBe(0);
    title.setHint(true);
    for (let i = 0; i < 120; i++) title.update(1 / 60);
    expect(title.hintOpacity).toBeGreaterThan(0.95);
    title.setHint(false);
    for (let i = 0; i < 180; i++) title.update(1 / 60);
    expect(title.hintOpacity).toBe(0);

    title.setHint(true);
    title.ignite(); // lighting the candle takes the hint away
    for (let i = 0; i < 120; i++) title.update(1 / 60);
    expect(title.hintOpacity).toBe(0);
  });

  it('disposes cleanly', () => {
    const title = new VrTitleView();
    expect(() => title.dispose()).not.toThrow();
  });
});
