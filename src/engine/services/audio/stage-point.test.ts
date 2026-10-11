import { describe, expect, it } from 'vitest';
import { createStagePlane } from '../../shadow/pure/stage-plane';
import { stagePoint } from './stage-point';

describe('stagePoint', () => {
  it('maps stage x and y along the wall, and the lift toward the player', () => {
    const stage = createStagePlane();
    stage.origin.set([1, 2, -3]);
    stage.right.set([0, 0, 1]); // a wall facing +x, width along z
    stage.up.set([0, 1, 0]);
    stage.normal.set([1, 0, 0]);
    const out = { x: 0, y: 0, z: 0 };
    stagePoint(stage, 0.5, 0.25, 0.05, out);
    expect(out.x).toBeCloseTo(1.05, 12);
    expect(out.y).toBeCloseTo(2.25, 12);
    expect(out.z).toBeCloseTo(-2.5, 12);
  });

  it('is the origin for (0, 0) with no lift', () => {
    const stage = createStagePlane();
    stage.origin.set([0.3, 0.9, -1.5]);
    const out = { x: 9, y: 9, z: 9 };
    stagePoint(stage, 0, 0, 0, out);
    expect([out.x, out.y, out.z]).toEqual([0.3, 0.9, -1.5]);
  });
});
