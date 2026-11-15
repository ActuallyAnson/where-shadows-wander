// How the frame is cleared for the session the game asks for. The game is a virtual room (immersive-vr, ADR 0005): the
// older passthrough mode is gone, but a browser could still report a see-through display, which is cleared to transparent.
// Plain TypeScript with no engine imports, so it is unit-tested in Node.

export interface ClearSetting {
  /** Scene background colour, or null for none. */
  readonly background: number | null;
  /** Frame clear alpha. */
  readonly alpha: number;
}

/** The room's dark backdrop. */
export const ROOM_BACKGROUND = 0x14161c;
const OPAQUE: ClearSetting = { background: ROOM_BACKGROUND, alpha: 1 };
const TRANSPARENT: ClearSetting = { background: null, alpha: 0 };

/** An opaque display (VR, or a browser that reports no blend mode) gets the room's backdrop; a see-through one clears to transparent. */
export function clearFor(blendMode: string | undefined): ClearSetting {
  return blendMode === undefined || blendMode === 'opaque' ? OPAQUE : TRANSPARENT;
}
