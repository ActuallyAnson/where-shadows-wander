// Where the hands' shadows are cast from on the room's wall. Plain TypeScript.
//
// The shadows are real: the hands' meshes are drawn from a light into a shadow map each frame, and the wall (and anything else
// the candle lights) is darker where they block it (hand-shadow-map.ts). But they are not cast from the flame itself. The candle
// stands on the lap tray, low and only a hand's breadth behind where hands rest, so from the flame a resting hand's shadow would
// be thrown metres up, onto the ceiling. They are cast instead from a point CAST_BACK_M behind the flame (away from the wall) and
// CAST_UP_M above it, about level with resting hands, as a lamp behind a shadow puppeteer would: a resting hand's shadow then
// falls on the middle of the stage, about 20 by 47 cm, a little bigger as it nears the light and smaller as it goes toward the
// wall. The candle still lights the wall; its light is what the shadow takes away.
//
// The projector (shadow-projector.ts) projects the joints from the same point in plain perspective (these settings), so where the
// story places her hand and the memories, and the shapes' rings, match the shadow that is drawn.
import type { ShadowSettings } from './shadow-projector';
import type { StagePlane } from './stage-plane';

/** How far behind the flame (away from the wall) and above it the hands' shadows are cast from, metres. Tune in the headset. */
export const CAST_BACK_M = 1.2;
export const CAST_UP_M = 0.3;

export const REAL_WALL_SHADOW_SETTINGS: Partial<ShadowSettings> = {
  blend: 0,
  behindOpacity: 0,
  behindBlurM: 0,
  sizeLightBackM: 0,
};

/** Writes the point the hands' shadows are cast from (world, m), for the flame at `flame` and the wall `stage`. Allocates nothing. */
export function castPoint(stage: StagePlane, flame: Readonly<ArrayLike<number>>, out: Float64Array): Float64Array {
  for (let i = 0; i < 3; i++) out[i] = flame[i] + stage.normal[i] * CAST_BACK_M + stage.up[i] * CAST_UP_M;
  return out;
}
