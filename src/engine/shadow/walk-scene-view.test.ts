import { describe, expect, it } from 'vitest';
import { ARRIVAL_S, WAKING_S } from './pure/walk-timeline';
import { WalkSceneView } from './walk-scene-view';

const HEAD = { x: 0, y: 1.2, z: 0 };

describe('WalkSceneView', () => {
  it('is hidden until a scene starts, then plays the arrival to its end and says so', () => {
    const v = new WalkSceneView();
    expect(v.group.visible).toBe(false);
    expect(v.playing).toBe(false);
    v.start(HEAD, 0, -1, 'castle', 'arrive');
    expect(v.group.visible).toBe(true);
    expect(v.playing).toBe(true);
    expect(v.length).toBeCloseTo(ARRIVAL_S, 6);
    let t = 0;
    while (v.playing && t < ARRIVAL_S + 2) {
      v.update(1 / 72);
      t += 1 / 72;
    }
    expect(v.finished).toBe(true);
    expect(t).toBeGreaterThanOrEqual(ARRIVAL_S - 0.1);
    expect(t).toBeLessThan(ARRIVAL_S + 0.5);
    v.dispose();
  });

  it('plays the waking in the same land, and a different land afterwards (it paints what it needs each time)', () => {
    const v = new WalkSceneView();
    v.start(HEAD, 0, -1, 'cave', 'wake');
    expect(v.length).toBeCloseTo(WAKING_S, 6);
    for (let i = 0; i < 72 * 4; i++) v.update(1 / 72);
    expect(v.finished).toBe(true);
    v.start(HEAD, 1, 0, 'pass', 'arrive'); // another land, another way the head faces
    expect(v.finished).toBe(false);
    expect(v.group.rotation.y).toBeCloseTo(Math.atan2(-1, 0), 6);
    v.dispose();
  });

  it('turns its face to where the head faces, can be skipped, and frees everything on leaving', () => {
    const v = new WalkSceneView();
    v.start(HEAD, 0, -1, 'heights', 'arrive');
    v.skip();
    expect(v.finished).toBe(true);
    v.leave();
    expect(v.group.visible).toBe(false);
    expect(v.group.children.length).toBe(1); // only the (empty) world group stays
    expect(() => v.update(0.1)).not.toThrow(); // and nothing happens when it is not built
    v.start(HEAD, 0, -1, 'heights', 'arrive'); // it can start again after leaving
    expect(v.playing).toBe(true);
    v.dispose();
  });

  it('ignores a frame time that is negative or not a number', () => {
    const v = new WalkSceneView();
    v.start(HEAD, 0, -1, 'pass', 'arrive');
    expect(() => {
      v.update(-1);
      v.update(NaN);
    }).not.toThrow();
    v.dispose();
  });
});
