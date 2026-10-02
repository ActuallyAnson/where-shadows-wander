// A stand-in stage and lantern, until Teammate A's StageFrame and Teammate B's
// lantern exist: placed once from where the player sits and faces. Plain TypeScript.
//
// table: the tabletop theatre (GDD): a 50 × 42 cm paper screen standing on the
//   table about 75 cm ahead, tall enough for hands turned up toward it, the
//   lantern on the near edge of the table, the hands in between.
// wall: a larger screen 1.5 m ahead, as on a wall.
import type { Vec3 } from '../../hands/hand';
import type { MutableStagePlane } from './stage-plane';

type V3 = Readonly<ArrayLike<number>>;
export type StageMode = 'table' | 'wall';

/** The desktop camera in mock mode (iwsdk.config.json). */
export const MOCK_HEAD: Readonly<Vec3> = [0, 1, 0.5];
/** How far the table top is below a seated player's eyes. */
const TABLE_BELOW_EYES_M = 0.45;

/**
 * Places the stage and lantern for a player whose eyes are at `head`, facing
 * `yawRad` (0 = looking down -Z). Writes into `stage` and `lantern`.
 */
export function placeTestRig(
  mode: StageMode,
  head: V3,
  yawRad: number,
  stage: MutableStagePlane,
  lantern: Float64Array | Vec3,
): void {
  const fx = -Math.sin(yawRad),
    fz = -Math.cos(yawRad); // forward, level
  const table = head[1] - TABLE_BELOW_EYES_M;
  // The lantern's flame: on the near edge of the table, 10 cm up.
  lantern[0] = head[0] + fx * 0.15;
  lantern[1] = table + 0.1;
  lantern[2] = head[2] + fz * 0.15;
  const [ahead, width, height, centreY] =
    mode === 'table' ? [0.75, 0.5, 0.42, table + 0.24] : [1.5, 0.9, 0.7, head[1] - 0.2];
  stage.origin[0] = head[0] + fx * ahead;
  stage.origin[1] = centreY;
  stage.origin[2] = head[2] + fz * ahead;
  stage.normal.set([-fx, 0, -fz]); // toward the player
  stage.right.set([-fz, 0, fx]);
  stage.up.set([0, 1, 0]);
  stage.width = width;
  stage.height = height;
}

/** Yaw (radians, 0 = facing -Z) from a head orientation quaternion. */
export function yawOf(qx: number, qy: number, qz: number, qw: number): number {
  // The head's forward (-Z) rotated by q, flattened.
  const fx = -2 * (qx * qz + qw * qy);
  const fz = -(1 - 2 * (qx * qx + qy * qy));
  return Math.atan2(-fx, -fz);
}
