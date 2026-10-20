// Where the settings panel opens: within easy reach of a seated player, below the line of sight so it never hides
// the wall, and shifted toward their main hand. Plain TypeScript (no three.js); the panel turns the result into a
// position and a turn.
import type { Hand } from '../../engine/services/settings/settings';

/** How far in front of the head the panel's centre is (arm's length is about 0.6 m, so a poke needs no stretch). */
export const PANEL_DISTANCE_M = 0.5;
/** How far below the eyes. Tilted up toward the face, it stays readable without hiding the stage. */
export const PANEL_DROP_M = 0.3;
/** How far toward the main hand it sits, so that hand has the shorter reach to the nearer controls. */
export const PANEL_SIDE_M = 0.1;

export interface PanelPose {
  x: number;
  y: number;
  z: number;
  /** Rotation about the vertical axis, in radians, that makes the panel face the head (three.js convention: yaw 0 faces +z). */
  yaw: number;
  /** Tilt toward the eyes, in radians: rotation about the panel's own x axis, negative turns its face upward. Apply after the yaw (Euler order YXZ). */
  pitch: number;
}

/**
 * `head` is the eye position and (fx, fz) the horizontal direction it looks (any length; a head looking straight
 * up or down, or a bad value, falls back to looking along -z). The result is written into `out`.
 */
export function placeSettingsPanel(
  head: ArrayLike<number>,
  fx: number,
  fz: number,
  hand: Hand,
  out: PanelPose = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 },
): PanelPose {
  let len = Math.sqrt(fx * fx + fz * fz);
  if (!(len > 1e-4) || !Number.isFinite(len)) {
    fx = 0;
    fz = -1;
    len = 1;
  }
  fx /= len;
  fz /= len;
  // The head's right-hand side seen from above: forward (fx, fz) turned a quarter turn clockwise.
  const rx = -fz;
  const rz = fx;
  const side = hand === 'right' ? PANEL_SIDE_M : -PANEL_SIDE_M;
  out.x = head[0] + fx * PANEL_DISTANCE_M + rx * side;
  out.z = head[2] + fz * PANEL_DISTANCE_M + rz * side;
  out.y = head[1] - PANEL_DROP_M;
  // Face the head: the panel's front is +z, so turn from +z toward (head - panel).
  out.yaw = Math.atan2(head[0] - out.x, head[2] - out.z);
  out.pitch = -Math.atan2(PANEL_DROP_M, PANEL_DISTANCE_M);
  return out;
}
