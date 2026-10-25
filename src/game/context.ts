// What every gameplay module sees during a fixed step. Game builds one and passes it around, so a
// puzzle, the traveller and the abilities all read the same world. Plain TypeScript.

import type { EntityStore } from '../engine/sim/entity-store';
import type { Rng } from '../engine/sim/rng';
import type { ParsedLayout } from '../engine/sim/scene-layout';
import type { Solver } from '../engine/sim/solver';
import type { Abilities } from './abilities';
import type { Creatures } from './creatures';
import type { Fixtures } from './fixtures';
import type { GameEventQueue } from './game-events';
import type { Traveller } from './traveller';

export interface GameContext {
  readonly store: EntityStore;
  readonly solver: Solver;
  /** The puzzle's seeded random numbers (reseeded on every puzzle load). */
  readonly rng: Rng;
  readonly events: GameEventQueue;
  readonly fixtures: Fixtures;
  readonly traveller: Traveller;
  readonly abilities: Abilities;
  /** Fireflies and crows (where lured crows head). */
  readonly creatures: Creatures;
  /** The current puzzle's layout, in stage space. */
  readonly layout: ParsedLayout;
  /** Top of the current puzzle's ground, stage metres. */
  readonly groundY: number;
  /** Simulation seconds since the game started (advances by `dt` each step). */
  readonly time: number;
  /** Seconds since the current puzzle loaded. */
  readonly puzzleTime: number;
  /** The fixed step, seconds. */
  readonly dt: number;
  /** Gives evidence that a solution is being used (the one with most credit at the win is recorded). */
  credit(solution: string, amount?: number): void;
}
