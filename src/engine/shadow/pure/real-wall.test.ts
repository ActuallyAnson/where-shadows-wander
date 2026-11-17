import { describe, expect, it } from 'vitest';
import { StageFrame } from '../../stage/stage-frame';
import { CAST_BACK_M, CAST_UP_M, castPoint } from './real-wall';
import { distanceToPlane } from './stage-plane';

describe('castPoint', () => {
  it('is behind the flame (away from the wall) and above it', () => {
    const stage = new StageFrame();
    stage.placeInFront([0, 1.2, 0], 0.7);
    const flame = [0.1, 0.75, -0.3];
    const out = castPoint(stage, flame, new Float64Array(3));
    const back = distanceToPlane(stage, out[0], out[1], out[2]) - distanceToPlane(stage, flame[0], flame[1], flame[2]);
    expect(back).toBeCloseTo(CAST_BACK_M, 9);
    expect(out[1] - flame[1]).toBeCloseTo(CAST_UP_M, 9);
  });
});
