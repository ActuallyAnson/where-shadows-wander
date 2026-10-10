// How much a point is lit by the candle, shared by the debug dots and the hand visual so both warm up
// the same way. Plain TypeScript: no IWSDK, no three.js.

/** A joint this close to the flame (metres) starts to pick up its light. */
export const LIT_RADIUS_M = 0.22;

/** 0 at or beyond `LIT_RADIUS_M` from the flame, rising linearly to 1 at the flame. */
export function litAmount(x: number, y: number, z: number, fx: number, fy: number, fz: number): number {
  const dx = x - fx;
  const dy = y - fy;
  const dz = z - fz;
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
  return dist < LIT_RADIUS_M ? 1 - dist / LIT_RADIUS_M : 0;
}
