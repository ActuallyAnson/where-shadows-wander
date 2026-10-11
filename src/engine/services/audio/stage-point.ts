// Where a point in stage space is in the room, so a sound can come from the wall. Stage space is the shadow
// projector's: metres from the stage's centre, x along its width and y along its height.
// Plain TypeScript.
import type { StagePlane } from '../../shadow/pure/stage-plane';

/** Writes the scene-space position of stage point (sx, sy), lifted `lift` metres toward the player, into `out`. */
export function stagePoint(
  stage: StagePlane,
  sx: number,
  sy: number,
  lift: number,
  out: { x: number; y: number; z: number },
): void {
  const o = stage.origin,
    r = stage.right,
    u = stage.up,
    n = stage.normal;
  out.x = o[0] + r[0] * sx + u[0] * sy + n[0] * lift;
  out.y = o[1] + r[1] * sx + u[1] * sy + n[1] * lift;
  out.z = o[2] + r[2] * sx + u[2] * sy + n[2] * lift;
}
