import { Group } from '@iwsdk/core';
import { describe, expect, it } from 'vitest';
import { type FixtureLike, FixturesView, MAX_FIXTURES } from './fixtures-view';

function list(...items: Partial<FixtureLike>[]) {
  const all: FixtureLike[] = items.map((f) => ({
    kind: 'gate',
    x: 0,
    y: 0,
    w: 0.1,
    h: 0.2,
    active: true,
    value: 0,
    ...f,
  }));
  return { count: all.length, at: (i: number) => all[i] };
}

describe('FixturesView', () => {
  it('draws one quad per fixture in the stage group, and hides the rest', () => {
    const parent = new Group();
    const view = new FixturesView(parent);
    expect(parent.children).toContain(view.group);
    view.update(list({ kind: 'gate' }, { kind: 'plate' }), 0.8, 1 / 60);
    const quads = view.group.children.slice(0, MAX_FIXTURES);
    expect(quads.filter((q) => q.visible)).toHaveLength(2);
  });

  it('swings an open gate up out of the doorway over a moment', () => {
    const view = new FixturesView();
    const gate = { kind: 'gate', x: 0.44, y: -0.16, w: 0.024, h: 0.2, active: false, value: 1 };
    view.update(list(gate), 1, 0.1);
    const quad = view.group.children[0];
    const early = quad.position.y;
    for (let i = 0; i < 60; i++) view.update(list(gate), 1, 1 / 60);
    expect(early).toBeGreaterThan(-0.16);
    expect(quad.position.y).toBeCloseTo(-0.16 + 0.2 * 0.9, 6);
  });

  it('lights the window warm when the night ends, whatever the shadows do', () => {
    const view = new FixturesView();
    view.update(list({ kind: 'window', active: true }), 0, 1 / 60);
    const mat = (view.group.children[0] as unknown as { material: { opacity: number; color: { getHex(): number } } })
      .material;
    expect(mat.opacity).toBeGreaterThan(0.5);
    expect(mat.color.getHex()).not.toBe(0x000000);
  });

  it('blows streaks through the wind, fainter when the traveller is sheltered', () => {
    const view = new FixturesView();
    const wind = { kind: 'wind', x: 0.27, y: 0, w: 1.05, h: 0.5, active: true, value: 1 };
    view.update(list(wind), 1, 1 / 60);
    const streak = view.group.children[MAX_FIXTURES] as unknown as { visible: boolean; material: { opacity: number } };
    const full = streak.material.opacity;
    expect(streak.visible).toBe(true);
    view.update(list({ ...wind, value: 0.2 }), 1, 1 / 60);
    expect(streak.material.opacity).toBeLessThan(full);
  });
});
