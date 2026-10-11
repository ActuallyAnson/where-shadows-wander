// Fade for a drawn hand: quick in when tracking starts, slower out when it stops, so a hand that flickers
// in and out of tracking does not blink. Plain TypeScript: no IWSDK, no three.js.

export const FADE_IN_S = 0.15;
export const FADE_OUT_S = 0.4;

/**
 * Moves `value` (0 to 1) toward 1 if `visible`, else toward 0, over `dt` seconds. CapsuleHandVisual does the same
 * arithmetic inline (a call with decimal arguments allocates on some engines), and its test checks the two agree.
 */
export function stepFade(value: number, visible: boolean, dt: number): number {
  if (visible) return Math.min(1, value + dt / FADE_IN_S);
  return Math.max(0, value - dt / FADE_OUT_S);
}
