import { describe, expect, it } from 'vitest';
import { placeLantern, yawOf } from './test-rig';

describe('test rig', () => {
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

  it('reads yaw from a head orientation', () => {
    expect(yawOf(0, 0, 0, 1)).toBeCloseTo(0);
    const half = Math.PI / 4; // 90° about +Y
    expect(yawOf(0, Math.sin(half), 0, Math.cos(half))).toBeCloseTo(Math.PI / 2);
  });
});
