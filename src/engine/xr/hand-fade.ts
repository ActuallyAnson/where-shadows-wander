// Fade for a drawn hand: quick in when tracking starts, slower out when it stops, so a hand that flickers
// in and out of tracking does not blink. Plain TypeScript: no IWSDK, no three.js.

export const FADE_IN_S = 0.15;
export const FADE_OUT_S = 0.4;

/** A drawn hand fades out as it comes close to the eyes (a palm turned toward the face would otherwise fill the view): gone inside the first, whole beyond the second. Metres. */
export const NEAR_HIDE_M = 0.2;
export const NEAR_SHOW_M = 0.42;

/** How much of a drawn hand to show, 0 to 1, when its nearest joint is `distance` metres from the eyes. */
export function nearFade(distance: number): number {
  const k = (distance - NEAR_HIDE_M) / (NEAR_SHOW_M - NEAR_HIDE_M);
  return k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k);
}

/**
 * Moves `value` (0 to 1) toward 1 if `visible`, else toward 0, over `dt` seconds. CapsuleHandVisual does the same
 * arithmetic inline (a call with decimal arguments allocates on some engines), and its test checks the two agree.
 */
export function stepFade(value: number, visible: boolean, dt: number): number {
  if (visible) return Math.min(1, value + dt / FADE_IN_S);
  return Math.max(0, value - dt / FADE_OUT_S);
}
