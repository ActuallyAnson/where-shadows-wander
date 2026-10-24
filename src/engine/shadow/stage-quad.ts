// Puts a unit quad on the stage plane: centred at (x, y) in stage coordinates (metres from the stage's centre), w wide
// and h tall (a negative w mirrors it), lifted `lift` metres toward the player. Builds nothing.
import type { Matrix4, Mesh } from '@iwsdk/core';
import type { StagePlane } from './pure/stage-plane';

export function placeOnStage(
  scratch: Matrix4,
  q: Mesh,
  stage: StagePlane,
  x: number,
  y: number,
  w: number,
  h: number,
  lift: number,
): void {
  const r = stage.right,
    u = stage.up,
    nn = stage.normal,
    o = stage.origin;
  // prettier-ignore
  scratch.set(
    r[0] * w, u[0] * h, nn[0], o[0] + r[0] * x + u[0] * y + nn[0] * lift,
    r[1] * w, u[1] * h, nn[1], o[1] + r[1] * x + u[1] * y + nn[1] * lift,
    r[2] * w, u[2] * h, nn[2], o[2] + r[2] * x + u[2] * y + nn[2] * lift,
    0, 0, 0, 1,
  );
  q.matrix.copy(scratch);
  q.matrixWorldNeedsUpdate = true;
}
