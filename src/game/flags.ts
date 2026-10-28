// Gameplay's own entity flag bits (EntityStore.flags bits 8 to 15 are reserved for it; see
// src/engine/sim/entity-kinds.ts for bits 0 to 3). Plain TypeScript.

export const GameFlag = {
  /** Held in a cup: follows the hand instead of moving on its own (fireflies). */
  Carried: 1 << 8,
  /** Frightened away: flies off the stage and is removed (crows). */
  Scared: 1 << 9,
  /** Drawn toward a light the player carries (crows following a cup of fireflies). */
  Lured: 1 << 10,
} as const;
