// A hand source fills both HandFrames each frame in mock mode (?mock=1), in
// place of the headset. Every source writes the same HandFrame format as
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
 * Where mock hands rest, in scene space. The desktop camera sits at (0, 1, 0.5)
 * (iwsdk.config.json), so this is about 0.45 m in front of it and a little below
 * eye height.
 */
export const MOCK_WRIST: Readonly<Record<Handedness, Readonly<Vec3>>> = {
  left: [-0.08, 0.95, 0.05],
  right: [0.08, 0.95, 0.05],
};

export function clearHand(hand: HandFrame): void {
  hand.tracked = false;
  hand.validJoints = 0;
}
