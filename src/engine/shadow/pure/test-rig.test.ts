import { describe, expect, it } from 'vitest';
import { distanceToPlane, createStagePlane } from './stage-plane';
import { MOCK_HEAD, placeLantern, placeTestRig, yawOf } from './test-rig';

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

  it('placeLantern puts the flame 15 cm ahead and 35 cm below the eyes, and turns with the player', () => {
    const l = new Float64Array(3);
    placeLantern([0, 1.2, 0], 0, l);
    expect(l[0]).toBeCloseTo(0, 12);
    expect(l[1]).toBeCloseTo(1.2 - 0.45 + 0.1, 12);
    expect(l[2]).toBeCloseTo(-0.15, 12);
    placeLantern([1, 1.2, 2], Math.PI / 2, l); // facing -X
    expect(l[0]).toBeCloseTo(0.85);
    expect(l[2]).toBeCloseTo(2);
  });

  it('gives placeTestRig the same lantern as placeLantern', () => {
    const a = new Float64Array(3);
    const b = new Float64Array(3);
    placeTestRig('wall', [0.2, 1.1, -0.3], 0.7, createStagePlane(), a);
    placeLantern([0.2, 1.1, -0.3], 0.7, b);
    for (let i = 0; i < 3; i++) expect(a[i]).toBeCloseTo(b[i], 12);
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
