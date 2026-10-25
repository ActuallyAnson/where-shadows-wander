// The night's puzzles, in play order (GDD "Puzzles": a kid's bedroom, the ground made of the
// shadows of invisible props). Each puzzle's layout and props are written beside it (ADR 0014).
//
// Adding a puzzle: write a PuzzleDef in this folder with its `layout`, `props` and hooks (see
// docs/SIMULATION.md, "Adding a puzzle"), list it here, and add a headless test that solves it each
// way it should be solvable and checks one way it shouldn't.
import type { PuzzleDef } from '../puzzle';
import { createBooksPuzzle } from './n1-books';
import { createDripPuzzle } from './n2-drip';
import { createFanPuzzle } from './n3-fan';
import { createBedPuzzle } from './n4-bed';
import { createCastlePuzzle } from './n5-castle';

/** The night's puzzles, freshly made: pass a new list to each Game (puzzles keep per-game state). */
export function createNight(): PuzzleDef[] {
  return [createBooksPuzzle(), createDripPuzzle(), createFanPuzzle(), createBedPuzzle(), createCastlePuzzle()];
}
export const NIGHT_ID = 'night';
