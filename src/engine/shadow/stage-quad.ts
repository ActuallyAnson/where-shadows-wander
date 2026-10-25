// Puts a unit quad on the stage plane: centred at (x, y) in stage coordinates (metres from the stage's centre), w wide
// and h tall (a negative w mirrors it), turned `angle` radians about its centre (counter-clockwise seen from the player),
// lifted `lift` metres toward the player. Builds nothing.
import { CanvasTexture } from '@iwsdk/core';
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
  angle = 0,
): void {
  const r = stage.right,
    u = stage.up,
    nn = stage.normal,
    o = stage.origin;
  const c = Math.cos(angle),
    sn = Math.sin(angle);
  // The quad's own x axis is (c, sn) and its y axis (-sn, c), in the stage's right/up coordinates.
  const ax = (i: number) => (r[i] * c + u[i] * sn) * w;
  const ay = (i: number) => (-r[i] * sn + u[i] * c) * h;
  // prettier-ignore
  scratch.set(
    ax(0), ay(0), nn[0], o[0] + r[0] * x + u[0] * y + nn[0] * lift,
    ax(1), ay(1), nn[1], o[1] + r[1] * x + u[1] * y + nn[1] * lift,
    ax(2), ay(2), nn[2], o[2] + r[2] * x + u[2] * y + nn[2] * lift,
    0, 0, 0, 1,
  );
  q.matrix.copy(scratch);
  q.matrixWorldNeedsUpdate = true;
}

/** A texture from a drawn canvas that stays sharp when the wall is seen at a slant (the renderer lowers this to what the device allows). */
export function crispTexture(c: HTMLCanvasElement): CanvasTexture {
  const t = new CanvasTexture(c);
  t.anisotropy = 8;
  return t;
}
