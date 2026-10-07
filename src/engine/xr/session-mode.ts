// Which kind of XR session the game asks for, and the few things that follow from it.
// The game is a virtual room (immersive-vr, ADR 0005); ?xr=ar keeps the older passthrough
// mode reachable. Plain TypeScript with no engine imports, so it is unit-tested in Node.

export type XrMode = 'vr' | 'ar';

/** VR unless the page was opened with ?xr=ar. */
export function xrModeFromUrl(search: string): XrMode {
  return new URLSearchParams(search).get('xr') === 'ar' ? 'ar' : 'vr';
}

export function sessionModeOf(mode: XrMode): 'immersive-vr' | 'immersive-ar' {
  return mode === 'ar' ? 'immersive-ar' : 'immersive-vr';
}

/**
 * Whether the hand occluder (a depth-only hand that keeps real hands in front of the paper over
 * passthrough) is on. It follows the session: a VR session reports an opaque display, where the
 * occluder would cut a hole in the room, so it is off; a passthrough session (alpha-blend or
 * additive) turns it on. With no session yet, or in mock mode (no passthrough), it is off.
 * `?occlude=1` or `?occlude=0` overrides this for testing.
 */
export function occluderDefault(blendMode: string | undefined, mock: boolean, occludeParam: string | null): boolean {
  if (occludeParam === '1') return true;
  if (occludeParam === '0') return false;
  return !mock && blendMode !== undefined && blendMode !== 'opaque';
}

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

/**
 * An opaque display (VR) gets a solid background; passthrough (alpha-blend, additive) clears to transparent.
 * A browser that does not report a blend mode gets the room backdrop in VR and none in AR, by the page's mode.
 */
export function clearFor(blendMode: string | undefined, mode: XrMode): ClearSetting {
  if (blendMode === undefined) return mode === 'vr' ? OPAQUE : TRANSPARENT;
  return blendMode === 'opaque' ? OPAQUE : TRANSPARENT;
}
