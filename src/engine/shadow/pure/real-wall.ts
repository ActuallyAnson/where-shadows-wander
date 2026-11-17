// How hand shadows are projected onto the real paper wall (A's StageFrame, 2 m ahead). Plain TypeScript.
//
// blend 0.65 toward orthographic: the wall is fixed, so the size of a shadow only varies with how far a hand is
// from the lantern. At 0.9 that variation is tiny (+-2 %) but a puppet hand's shadow is only 10 x 24 cm on a
// 1.6 m wall; at 0.65 it is about 15 x 35 cm and still steady (+-8 %). (0.9 is the GDD value for keeping size
// steady when the WALL distance varies, which it does not here.) The edge blur is capped low: at the default
// 0.03 per metre every capsule of a hand 1.5 m from the wall gets the 2 cm maximum, 20 % of a shadow's width,
// and the gaps between fingers close.
// The blend alone changes a shadow's size only ~25 % across the arm's reach, which reads as no change at all; sizeLightBackM
// adds a near light's growth on top (about 2x between a hand at the flame and one at arm's length) without moving the shadow.
// A night light fixed behind the player (the bedroom proposal) would need these re-tuned.
// A hand behind the candle keeps a dim, blurred shadow (a third as dark, a 4 cm blur): out of focus, not gone, so the player
// sees where it is and brings it forward into focus.
import type { ShadowSettings } from './shadow-projector';

export const REAL_WALL_SHADOW_SETTINGS: Partial<ShadowSettings> = {
  blend: 0.65,
  blurPerM: 0.005,
  maxBlurM: 0.008,
  behindOpacity: 0.35,
  behindBlurM: 0.04,
  sizeLightBackM: 0.75,
};
