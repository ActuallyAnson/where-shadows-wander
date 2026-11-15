// The player's rig helpers: the desk rig's head (the room editor, and the space mock hands are posed in), a first lantern
// placement, and the yaw of a head pose. The stage itself is StageFrame (src/engine/stage), in a headset and at the desk alike.
// Plain TypeScript.
import type { Vec3 } from '../../hands/hand';

type V3 = Readonly<ArrayLike<number>>;

/** The desk rig's eyes: the room editor's head, and the space every mock hand source poses its hands in (desk-frame.ts). */
export const MOCK_HEAD: Readonly<Vec3> = [0, 1, 0.5];
/** How far the table top is below a seated player's eyes. */
const TABLE_BELOW_EYES_M = 0.45;

/**
 * Puts the lantern's flame on the near edge of the table, 15 cm in front of a player whose eyes are at `head`
 * facing `yawRad` (0 = looking down -Z), 10 cm above the table top. Used by the real wall too, until the
 * lantern flow places it. Writes into `lantern`.
 */
export function placeLantern(head: V3, yawRad: number, lantern: Float64Array | Vec3): void {
  const fx = -Math.sin(yawRad),
    fz = -Math.cos(yawRad);
  lantern[0] = head[0] + fx * 0.15;
  lantern[1] = head[1] - TABLE_BELOW_EYES_M + 0.1;
  lantern[2] = head[2] + fz * 0.15;
}

/** Yaw (radians, 0 = facing -Z) from a head orientation quaternion. */
export function yawOf(qx: number, qy: number, qz: number, qw: number): number {
  // The head's forward (-Z) rotated by q, flattened.
  const fx = -2 * (qx * qz + qw * qy);
  const fz = -(1 - 2 * (qx * qx + qy * qy));
  return Math.atan2(-fx, -fz);
}
