// The candle's pool of light on the room's wall. The stage (the puzzles' 1.6 by 1 m) is not a sheet pinned to the wall: it is
// the middle of a big, round pool of candlelight that covers most of the wall and fades into the wallpaper, centred toward the
// candle (which sits low, on the tray), and cut off where the wall meets the floor, the ceiling and the side walls. Shared by the
// paper's shader (test-stage-view.ts) and the hands' shadow shader (shadow-shader.ts), so the shadows end where the light does.

/** The room's wall the light falls on, metres (BedroomView's front wall: 4 m wide, floor to a 2.5 m ceiling). */
export const ROOM_WALL_WIDTH_M = 4.0;
export const ROOM_WALL_HEIGHT_M = 2.5;
/** The pool of light's radii, metres: wide enough to cover most of the wall, and taller than the wall, so the floor and ceiling cut it. */
export const LIGHT_POOL_RX_M = 1.9;
export const LIGHT_POOL_RY_M = 1.45;

/**
 * Where the light is drawn, in stage metres (from the stage's centre): the whole wall the stage is on, for a stage centred
 * `stageY` metres above the floor (the wall's centre is straight across from the stage's). Writes [width, height, centreX, centreY].
 * With `onWall` false (the Hand Lab's stand-in stages, which hang in no room) it is just the stage.
 */
export function lightArea(
  onWall: boolean,
  stageY: number,
  stageW: number,
  stageH: number,
  out: Float64Array,
): Float64Array {
  if (!onWall) {
    out[0] = stageW;
    out[1] = stageH;
    out[2] = 0;
    out[3] = 0;
    return out;
  }
  out[0] = ROOM_WALL_WIDTH_M - 0.04;
  out[1] = ROOM_WALL_HEIGHT_M - 0.02;
  out[2] = 0;
  out[3] = ROOM_WALL_HEIGHT_M / 2 - stageY;
  return out;
}

/**
 * GLSL:
 * - `stageEdge(p, size, fade)` is 1 inside a rounded rectangle `size` (metres, centred) and falls to 0 at its edge across `fade`.
 * - `lightPool(p, flame, radius)` is how much of the candle's pool of light reaches `p` (1 in the middle, 0 at the rim): an ellipse
 *   with radii `radius`, its centre halfway from the stage's centre to `flame` (the point of the wall nearest the flame).
 * `p` and `flame` are in metres from the stage's centre.
 */
export const stageEdgeGlsl = /* glsl */ `
  float stageEdge(vec2 p, vec2 size, float fade) {
    if (fade <= 0.0) return 1.0;
    float r = min(0.32, 0.5 * min(size.x, size.y));
    vec2 q = abs(p) - (0.5 * size - r);
    float inside = -(length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r);
    return smoothstep(0.0, fade, inside);
  }
  // How far out in the pool \`p\` is: 0 at its centre, 1 at its rim.
  float poolDist(vec2 p, vec2 flame, vec2 radius) {
    vec2 c = clamp(flame * 0.5, vec2(-0.4), vec2(0.4));
    return length((p - c) / radius);
  }
  float lightPool(vec2 p, vec2 flame, vec2 radius) {
    return 1.0 - smoothstep(0.5, 1.0, poolDist(p, flame, radius));
  }
`;
