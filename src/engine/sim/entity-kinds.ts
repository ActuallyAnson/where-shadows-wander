// What kinds of thing live on the stage, and the per-entity flag bits.
// Plain TypeScript: no IWSDK, no three.js.

/** Entity kinds. Append only: the numbers index capacity tables and the renderer's batches. */
export const Kind = {
  Traveller: 0,
  Rock: 1,
  Raindrop: 2,
  Crow: 3,
  Rabbit: 4,
  Fox: 5,
  Firefly: 6,
} as const;
export type KindId = (typeof Kind)[keyof typeof Kind];
/** How many kinds there are, derived so a new `Kind` entry cannot be forgotten here. */
export const KIND_COUNT = Object.keys(Kind).length;

/** Slots reserved per kind, indexed by `Kind`. A starting point; tune against the chapter's needs. */
export const DEFAULT_CAPACITIES: readonly number[] = [1, 8, 128, 8, 1, 1, 64];

/** Per-entity flag bits. Bits 8 to 15 are free for gameplay code (teammate A). */
export const Flag = {
  /** Never moved by the solver (a bridge plank, a gate). */
  Static: 1 << 0,
  /** Resting on something this step. The solver sets and clears it. */
  Grounded: 1 << 1,
  /** Reports overlaps but is not pushed out (a weight plate, a firefly). */
  Sensor: 1 << 2,
  /** Simulated but not drawn. */
  Hidden: 1 << 3,
  /** Wait pose: traveller looks back toward player. */
  WaitPose: 1 << 8,
} as const;
