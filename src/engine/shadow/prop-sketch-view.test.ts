import { describe, expect, it } from 'vitest';
import { PropSketchView } from './prop-sketch-view';
import type { Prop } from './pure/prop-shadow';
import { createStagePlane } from './pure/stage-plane';

const stage = createStagePlane();
stage.origin.set([0, 1.2, -2]);
stage.right.set([1, 0, 0]);
stage.up.set([0, 1, 0]);
stage.normal.set([0, 0, 1]);
stage.width = 1.6;
stage.height = 1;
const light = [0.2, 0.9, -1.55]; // the candle, in front of the wall
const book = (x: number): Prop => ({
  shape: 'box',
  position: [x, 1.0, -1.96],
  size: [0.2, 0.14, 0.04],
  rotation: [0, 0, 0, 1],
});

describe('PropSketchView', () => {
  it('shows nothing until it has props, and nothing for a prop with no usable shadow', () => {
    const v = new PropSketchView();
    expect(v.props).toBe(0);
    v.update(1);
    expect(v.group.visible).toBe(false);
    v.setProps(
      [{ shape: 'box', position: [0, 1, -1.0], size: [0.2, 0.1, 0.04], rotation: [0, 0, 0, 1] }],
      light,
      stage,
      0.65,
    ); // in front of the light
    expect(v.props).toBe(0);
    v.dispose();
  });

  it('paints each prop with a fill and an edge, near where its shadow falls, and fades with the opacity it is given', () => {
    const v = new PropSketchView();
    v.setProps([book(-0.3), book(0.3)], light, stage, 0.65);
    expect(v.props).toBe(2);
    expect(v.group.children).toHaveLength(2);
    v.update(1);
    expect(v.group.visible).toBe(true);
    const fill = v.group.children[0] as unknown as {
      material: { opacity: number };
      geometry: { index: { count: number }; attributes: { position: { array: Float32Array } } };
    };
    expect(fill.material.opacity).toBeGreaterThan(0.1);
    expect(fill.material.opacity).toBeLessThan(0.6);
    expect(fill.geometry.index.count).toBeGreaterThanOrEqual(12); // at least two triangles each
    const xs = Array.from(
      { length: fill.geometry.attributes.position.array.length / 3 },
      (_, i) => fill.geometry.attributes.position.array[i * 3],
    );
    expect(Math.min(...xs)).toBeLessThan(-0.2);
    expect(Math.max(...xs)).toBeGreaterThan(0.2);
    v.update(0);
    expect(v.group.visible).toBe(false);
    v.dispose();
  });

  it('replaces its paintings when props are set again, and clears', () => {
    const v = new PropSketchView();
    v.setProps([book(0)], light, stage, 0.65);
    v.setProps([book(-0.4), book(0), book(0.4)], light, stage, 0.65);
    expect(v.props).toBe(3);
    expect(v.group.children).toHaveLength(2);
    v.clear();
    expect(v.props).toBe(0);
    expect(v.group.children).toHaveLength(0);
    v.dispose();
  });
});
