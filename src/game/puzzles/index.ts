// Chapter 1's puzzles, in play order (GDD "Puzzles"; layouts in public/scenes/chapter-1.iwsdk.scene.json).
//
// Adding a puzzle: add a `puzzle-N` group to the chapter file in the scene editor (a traveller piece,
// a goal marker, and any gap/plate markers and pieces), write a PuzzleDef in this folder (see
// docs/SIMULATION.md, "Adding a puzzle"), list it here, and add a headless test that solves it each
// way it should be solvable.
import type { PuzzleDef } from '../puzzle';
import { createGapPuzzle } from './p1-gap';
import { createRainPuzzle } from './p2-rain';
import { createWindPuzzle } from './p3-wind';
import { createChasmPuzzle } from './p4-chasm';
import { createCrowsPuzzle } from './p5-crows';
import { createGatePuzzle } from './p6-gate';

/** Chapter 1's puzzles, freshly made: pass a new list to each Game (puzzles keep per-game state). */
export function createChapter1(): PuzzleDef[] {
  return [
    createGapPuzzle(),
    createRainPuzzle(),
    createWindPuzzle(),
    createChasmPuzzle(),
    createCrowsPuzzle(),
    createGatePuzzle(),
  ];
}
export const CHAPTER_1_ID = 'chapter-1';
