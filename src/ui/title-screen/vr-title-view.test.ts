import { Quaternion } from '@iwsdk/core';
import { describe, expect, it } from 'vitest';
import { VrTitleView, DISSOLVE_DURATION_S, HINT_LINES } from './vr-title-view';

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

  it('shows the riddle, then the plainer line, then nothing', () => {
    const title = new VrTitleView();
    expect(title.hintOpacity).toBe(0);
    expect(title.hintText).toBe('');

    title.setHint(1);
    for (let i = 0; i < 120; i++) title.update(1 / 60);
    expect(title.hintText).toBe(HINT_LINES[1]);
    expect(title.hintOpacity).toBeGreaterThan(0.95);

    title.setHint(2); // a new line fades in afresh
    expect(title.hintText).toBe(HINT_LINES[2]);
    title.update(1 / 60);
    expect(title.hintOpacity).toBeLessThan(0.2);
    for (let i = 0; i < 120; i++) title.update(1 / 60);
    expect(title.hintOpacity).toBeGreaterThan(0.95);

    title.setHint(0);
    for (let i = 0; i < 180; i++) title.update(1 / 60);
    expect(title.hintOpacity).toBe(0);
  });

  it('takes the hint away once the candle is lit', () => {
    const title = new VrTitleView();
    title.setHint(2);
    title.ignite();
    for (let i = 0; i < 120; i++) title.update(1 / 60);
    expect(title.hintOpacity).toBe(0);
  });

  it('disposes cleanly', () => {
    const title = new VrTitleView();
    expect(() => title.dispose()).not.toThrow();
  });
});
