// The night's puzzles, in play order (GDD "Puzzles": a kid's bedroom, the ground made of the
// shadows of invisible props). Each puzzle's layout and props are written beside it (ADR 0014), and
// its level document is in docs/levels/.
//
// Adding a puzzle: write a PuzzleDef in this folder with its `layout`, `props` and hooks (see
// docs/SIMULATION.md, "Adding a puzzle"), list it here, and add a headless test that solves it each
// way it should be solvable and checks one way it shouldn't.
import type { PuzzleDef } from '../puzzle';
import { createBooksPuzzle } from './n1-books';
import { createLedgePuzzle } from './n2-ledge';
import { createDripPuzzle } from './n3-drip';
import { createFanPuzzle } from './n4-fan';
import { createCastlePuzzle } from './n5-castle';

/** The night's puzzles, freshly made: pass a new list to each Game (puzzles keep per-game state). */
export function createNight(): PuzzleDef[] {
  return [createBooksPuzzle(), createLedgePuzzle(), createDripPuzzle(), createFanPuzzle(), createCastlePuzzle()];
}
export const NIGHT_ID = 'night';
