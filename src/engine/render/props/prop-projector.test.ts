import { describe, expect, it } from 'vitest';
import { createStagePlane } from '../../shadow/pure/stage-plane';
import {
  DEFAULT_PROP_TERRAIN_RADIUS,
  InvisibleProp,
  LEDGE_NORMAL_Y_THRESHOLD,
  PropProjector,
  TUTORIAL_PROPS,
} from './prop-projector';

describe('PropProjector', () => {
  it('projects a 3D box onto stage plane and extracts top walkable ledge', () => {
    const projector = new PropProjector();
    // Default stage at origin (0, 0, 0), normal facing +Z (0, 0, 1)
    const stage = createStagePlane();
    stage.width = 2.0;
    stage.height = 1.5;

    // Light at (0, 0, 1.0)
    const flame = [0, 0, 1.0] as const;

    // Prop placed between light (Z=1.0) and wall (Z=0) at Z=0.5
    // Box centered at (-0.3, 0.2, 0.5), size 0.4 wide, 0.2 high, 0.2 deep
    const prop: InvisibleProp = {
      id: 'test_box',
      position: [-0.3, 0.2, 0.5],
      size: [0.4, 0.2, 0.2],
    };

    const result = projector.project([prop], stage, flame);

    expect(result.polygons).toHaveLength(1);
    const poly = result.polygons[0];
    expect(poly.propId).toBe('test_box');
    expect(poly.vertexCount).toBeGreaterThanOrEqual(4);

    // Verify convex hull vertices are in CCW order
    // In CCW, cross product of consecutive edges must be non-negative
    for (let i = 0; i < poly.vertexCount; i++) {
      const j = (i + 1) % poly.vertexCount;
      const k = (i + 2) % poly.vertexCount;
      const ax = poly.vertices[i * 2],
        ay = poly.vertices[i * 2 + 1];
      const bx = poly.vertices[j * 2],
        by = poly.vertices[j * 2 + 1];
      const cx = poly.vertices[k * 2],
        cy = poly.vertices[k * 2 + 1];
      const cross = (bx - ax) * (cy - by) - (by - ay) * (cx - bx);
      expect(cross).toBeGreaterThanOrEqual(-1e-6);
    }

    // Verify terrain capsule was extracted for the top edge
    expect(result.terrainCapsules.length).toBeGreaterThanOrEqual(1);
    const capsule = result.terrainCapsules[0];
    expect(capsule.radius).toBe(DEFAULT_PROP_TERRAIN_RADIUS);

    // The top ledge should have y > 0 and be oriented left-to-right
    expect(capsule.ax).toBeLessThanOrEqual(capsule.bx);
    expect(capsule.ay).toBeGreaterThan(0.2); // top edge is at or above center y=0.2
    expect(capsule.by).toBeGreaterThan(0.2);

    // Normal pointing upwards
    const dx = capsule.bx - capsule.ax;
    const dy = capsule.by - capsule.ay;
    const len = Math.hypot(dx, dy);
    const ny = dx / len; // left-to-right edge upward normal y component
    expect(ny).toBeGreaterThan(LEDGE_NORMAL_Y_THRESHOLD);
  });

  it('projects TUTORIAL_PROPS and preserves central gap', () => {
    const projector = new PropProjector();
    const stage = createStagePlane();
    stage.origin[0] = 0;
    stage.origin[1] = 1.4;
    stage.origin[2] = -2.0;
    stage.normal[0] = 0;
    stage.normal[1] = 0;
    stage.normal[2] = 1;
    stage.width = 1.6;
    stage.height = 1.0;

    // Flame at (0, 1.4, -0.6)
    const flame = [0, 1.4, -0.6] as const;

    const result = projector.project(TUTORIAL_PROPS, stage, flame);

    expect(result.polygons).toHaveLength(2);
    expect(result.polygons.map((p) => p.propId)).toEqual(['book_stack_left', 'toy_block_right']);

    // Should have top ledges for both props
    expect(result.terrainCapsules.length).toBeGreaterThanOrEqual(2);

    // Left book stack is at X < 0, right toy block is at X > 0
    const leftCapsules = result.terrainCapsules.filter((c) => c.bx < 0);
    const rightCapsules = result.terrainCapsules.filter((c) => c.ax > 0);
    expect(leftCapsules.length).toBeGreaterThanOrEqual(1);
    expect(rightCapsules.length).toBeGreaterThanOrEqual(1);

    // There should be a gap between the two ledges around X = 0
    const maxLeftX = Math.max(...leftCapsules.map((c) => c.bx));
    const minRightX = Math.min(...rightCapsules.map((c) => c.ax));
    expect(minRightX - maxLeftX).toBeGreaterThan(0.2); // at least 20cm gap for the hand bridge
  });

  it('handles Y-axis rotation on props', () => {
    const projector = new PropProjector();
    const stage = createStagePlane();
    const flame = [0, 0, 1.0] as const;

    const propRotated: InvisibleProp = {
      id: 'rotated_box',
      position: [0, 0.2, 0.5],
      size: [0.4, 0.2, 0.2],
      rotationY: Math.PI / 4, // 45 deg
    };

    const result = projector.project([propRotated], stage, flame);
    expect(result.polygons).toHaveLength(1);
    expect(result.polygons[0].vertexCount).toBeGreaterThanOrEqual(4);
    expect(result.terrainCapsules.length).toBeGreaterThanOrEqual(1);
  });

  it('gracefully skips props placed behind the light', () => {
    const projector = new PropProjector();
    const stage = createStagePlane();
    const flame = [0, 0, 1.0] as const;

    const propBehind: InvisibleProp = {
      id: 'behind_light',
      position: [0, 0, 2.0], // Behind the light (stage is at 0, light at 1.0)
      size: [0.4, 0.2, 0.2],
    };

    const result = projector.project([propBehind], stage, flame);
    expect(result.polygons).toHaveLength(0);
    expect(result.terrainCapsules).toHaveLength(0);
  });
});
