// Keeps the player in the bed. The story is seated: the room is placed round where the head was when it began, so a player who
// stands up or walks off would see the bedroom from outside its walls. Instead, the further the head strays from that spot,
// the darker the view goes (all black well before the walls), and it clears again as they sit back. Nothing is allocated.

/** How far the head may stray sideways from the bed spot before the view starts to darken, metres. */
export const STRAY_START_M = 0.35;
/** How far it must stray for the view to be fully black, metres. */
export const STRAY_BLACK_M = 0.75;
/** How far above the seated height the head may rise before the view starts to darken (standing up), metres. */
export const RISE_START_M = 0.25;
/** How far above it for black, metres. */
export const RISE_BLACK_M = 0.6;

const ramp = (v: number, from: number, to: number): number => {
  if (!(v > from)) return 0;
  if (v >= to) return 1;
  const s = (v - from) / (to - from);
  return s * s * (3 - 2 * s);
};

/**
 * How dark the view should be (0 clear .. 1 black) for a head at (x, y, z), given the head's spot when the room was placed.
 * A head pose that is not finite darkens nothing (the tracking is lost, not the player).
 */
export function strayDarkness(x: number, y: number, z: number, homeX: number, homeY: number, homeZ: number): number {
  const dx = x - homeX;
  const dz = z - homeZ;
  const dy = y - homeY;
  const side = Math.sqrt(dx * dx + dz * dz);
  if (!Number.isFinite(side) || !Number.isFinite(dy)) return 0;
  return Math.max(ramp(side, STRAY_START_M, STRAY_BLACK_M), ramp(dy, RISE_START_M, RISE_BLACK_M));
}
