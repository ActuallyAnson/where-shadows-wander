// A hand source fills both HandFrames each frame with mock hands (the Hand Lab), in
// place of the device's, in the game's session (ADR 0018). Every source writes the same HandFrame format as
// XRHandReader, so the rest of the game can't tell the difference.
import type { HandFrame, Handedness, Vec3 } from '../engine/hands/hand';
import type { PresetName } from '../engine/hands/synthetic-hand';

export interface HandSource {
  readonly name: string;
  /**
   * Fills both hands for mock time `t` (seconds since mock mode started; stops
   * while paused). Hands that the source doesn't show are left untracked.
   */
  update(t: number, left: HandFrame, right: HandFrame): void;
  /** The shape a hand is posed as, for sources that know it (synthetic, script); null when hidden. */
  shapeOf?(hand: Handedness): PresetName | null;
  /** A short live status line for the Hand Lab, e.g. the camera rate. */
  status?(): string;
  dispose?(): void;
}

/**
 * Where mock hands rest, in the desk rig's space (eyes at MOCK_HEAD, (0, 1, 0.5),
 * looking down -Z; desk-frame.ts moves them into the wearer's rig): 65 cm ahead and 20 cm below
 * the eyes, level with the middle of the paper wall, and about 20 cm in front of
 * the candle on the bed tray (main.ts placeRig), so the hands are between the
 * flame and the wall as a player's would be. Their shadows land just above the
 * middle of the wall.
 */
export const MOCK_WRIST: Readonly<Record<Handedness, Readonly<Vec3>>> = {
  left: [-0.08, 0.8, -0.15],
  right: [0.08, 0.8, -0.15],
};

export function clearHand(hand: HandFrame): void {
  hand.tracked = false;
  hand.validJoints = 0;
}
