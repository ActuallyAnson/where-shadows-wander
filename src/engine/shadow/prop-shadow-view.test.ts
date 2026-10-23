import { describe, expect, it } from 'vitest';
import { createSilhouette, projectProp, type Prop } from './pure/prop-shadow';
import { MAX_PROP_SHADOWS } from './pure/prop-shadow-mesh';
import { createStagePlane } from './pure/stage-plane';
import { PropShadowView } from './prop-shadow-view';

const stage = createStagePlane();
const light = [0, 0, 0.6];
const BLEND = 0.9;
const box: Prop = { shape: 'box', position: [0, 0.05, 0.3], size: [0.2, 0.1, 0.1], rotation: [0, 0, 0, 1] };

describe('PropShadowView', () => {
  it('starts hidden with nothing to draw', () => {
    const v = new PropShadowView();
    expect(v.mesh.visible).toBe(false);
    expect(v.count).toBe(0);
    expect(v.mesh.geometry.drawRange.count).toBe(0);
  });

  it('draws a fan and a rim for each prop with a shadow', () => {
    const v = new PropShadowView();
    const sil = createSilhouette();
    const n = projectProp(box, light, stage, BLEND, sil);
    expect(v.setProps([box], light, stage, BLEND)).toBe(1);
    expect(v.mesh.geometry.drawRange.count).toBe((n - 2) * 3 + n * 6);
  });

  it('skips a prop with no shadow and counts the rest', () => {
    const v = new PropShadowView();
    const behindWall: Prop = { ...box, position: [0, 0, -0.3] };
    expect(v.setProps([behindWall, box, behindWall], light, stage, BLEND)).toBe(1);
  });

  it('draws no more than it has room for', () => {
    const v = new PropShadowView();
    const many = Array.from({ length: MAX_PROP_SHADOWS + 4 }, () => box);
    expect(v.setProps(many, light, stage, BLEND)).toBe(MAX_PROP_SHADOWS);
  });

  it('rebuilds from scratch each time', () => {
    const v = new PropShadowView();
    v.setProps([box, box], light, stage, BLEND);
    expect(v.setProps([box], light, stage, BLEND)).toBe(1);
    expect(v.setProps([], light, stage, BLEND)).toBe(0);
    expect(v.mesh.geometry.drawRange.count).toBe(0);
  });

  it('is shown at the given opacity and hidden at 0', () => {
    const v = new PropShadowView();
    v.setProps([box], light, stage, BLEND);
    v.update(stage, 0.88);
    expect(v.mesh.visible).toBe(true);
    expect((v.mesh.material as { opacity: number }).opacity).toBeCloseTo(0.88, 6);
    v.update(stage, 0);
    expect(v.mesh.visible).toBe(false);
  });

  it('stays hidden when there is nothing to draw, whatever the opacity', () => {
    const v = new PropShadowView();
    v.update(stage, 1);
    expect(v.mesh.visible).toBe(false);
  });

  it('sits on the stage, a little toward the player', () => {
    const v = new PropShadowView();
    const wall = createStagePlane();
    wall.origin.set([0, 0, -2]);
    v.setProps([{ ...box, position: [0, 0.05, -1.7] }], [0, 0, -1.4], wall, BLEND);
    v.update(wall, 1);
    const e = v.mesh.matrix.elements;
    expect(e[12]).toBeCloseTo(0, 6);
    expect(e[14]).toBeCloseTo(-2 + 0.002, 6);
  });

  it('draws in the same layer as the hands, so they sort together', () => {
    expect(new PropShadowView().mesh.renderOrder).toBe(2);
  });
});
