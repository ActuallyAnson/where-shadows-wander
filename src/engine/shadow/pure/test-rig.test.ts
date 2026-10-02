import { describe, expect, it } from 'vitest';
import { distanceToPlane, createStagePlane } from './stage-plane';
import { MOCK_HEAD, placeTestRig, yawOf } from './test-rig';

describe('test rig', () => {
  it.each(['table', 'wall'] as const)('%s: the stage faces the player, with the lantern between them', (mode) => {
    const stage = createStagePlane();
    const lantern = new Float64Array(3);
    placeTestRig(mode, MOCK_HEAD, 0, stage, lantern);
    const head = distanceToPlane(stage, MOCK_HEAD[0], MOCK_HEAD[1], MOCK_HEAD[2]);
    const light = distanceToPlane(stage, lantern[0], lantern[1], lantern[2]);
    expect(light).toBeGreaterThan(0);
    expect(head).toBeGreaterThan(light);
    expect(lantern[1]).toBeLessThan(MOCK_HEAD[1]);
  });

  it('turns with the player', () => {
    const stage = createStagePlane();
    const lantern = new Float64Array(3);
    placeTestRig('table', [0, 1.2, 0], Math.PI / 2, stage, lantern); // facing -X
    expect(stage.origin[0]).toBeLessThan(-0.5);
    expect(stage.normal[0]).toBeCloseTo(1);
  });

  it('reads yaw from a head orientation', () => {
    expect(yawOf(0, 0, 0, 1)).toBeCloseTo(0);
    const half = Math.PI / 4; // 90° about +Y
    expect(yawOf(0, Math.sin(half), 0, Math.cos(half))).toBeCloseTo(Math.PI / 2);
  });
});
