import { Group } from '@iwsdk/core';
import { describe, expect, it } from 'vitest';
import type { PropPolygon } from './prop-projector';
import { PROP_SHADOW_RENDER_ORDER, PROP_SHADOW_Z_OFFSET, PropShadowView } from './prop-shadow-view';

describe('PropShadowView', () => {
  it('initializes with correct material and render order', () => {
    const parent = new Group();
    const view = new PropShadowView(parent);

    expect(view.mesh.parent).toBe(parent);
    expect(view.mesh.renderOrder).toBe(PROP_SHADOW_RENDER_ORDER);
    expect(view.material.color.getHex()).toBe(0x000000);
    expect(view.material.opacity).toBeCloseTo(0.88);
    expect(view.material.transparent).toBe(true);
    expect(view.material.depthWrite).toBe(false);
    expect(view.isBaked).toBe(false);

    view.dispose();
  });

  it('triangulates convex polygon into flat mesh with correct Z offset', () => {
    const view = new PropShadowView();

    // A simple rectangular quad (4 vertices): (-0.5, -0.2), (0.5, -0.2), (0.5, 0.2), (-0.5, 0.2)
    const quad: PropPolygon = {
      propId: 'quad_1',
      vertexCount: 4,
      vertices: new Float32Array([-0.5, -0.2, 0.5, -0.2, 0.5, 0.2, -0.5, 0.2]),
    };

    view.updatePolygons([quad]);

    expect(view.isBaked).toBe(true);

    const posAttr = view.geometry.getAttribute('position');
    expect(posAttr).toBeDefined();

    // 4 vertices -> (4 - 2) = 2 triangles = 6 vertices
    expect(posAttr.count).toBe(6);

    const array = posAttr.array as Float32Array;
    expect(array.length).toBe(18); // 6 vertices * 3 components

    // Verify all Z coordinates equal PROP_SHADOW_Z_OFFSET
    for (let i = 0; i < 6; i++) {
      expect(array[i * 3 + 2]).toBeCloseTo(PROP_SHADOW_Z_OFFSET);
    }

    view.dispose();
  });

  it('handles multiple polygons and empty updates', () => {
    const view = new PropShadowView();

    const poly1: PropPolygon = {
      propId: 'p1',
      vertexCount: 3, // 1 triangle = 3 vertices
      vertices: new Float32Array([0, 0, 1, 0, 0, 1]),
    };
    const poly2: PropPolygon = {
      propId: 'p2',
      vertexCount: 5, // 3 triangles = 9 vertices
      vertices: new Float32Array([0, 0, 1, 0, 1, 1, 0.5, 1.5, 0, 1]),
    };

    view.updatePolygons([poly1, poly2]);
    expect(view.isBaked).toBe(true);
    expect(view.geometry.getAttribute('position').count).toBe(3 + 9);

    // Empty update
    view.updatePolygons([]);
    expect(view.isBaked).toBe(true);
    expect(view.geometry.getAttribute('position').count).toBe(0);

    view.dispose();
  });

  it('cleans up on dispose', () => {
    const parent = new Group();
    const view = new PropShadowView(parent);

    expect(parent.children).toContain(view.mesh);
    view.dispose();
    expect(parent.children).not.toContain(view.mesh);
  });
});
