// Chapter 1's puzzles, in play order (GDD "Puzzles"; layouts in public/scenes/chapter-1.iwsdk.scene.json).
//
// Adding a puzzle: add a `puzzle-N` group to the chapter file in the scene editor (a traveller piece,
// a goal marker, and any gap/plate markers and pieces), write a PuzzleDef in this folder (see
// docs/SIMULATION.md, "Adding a puzzle"), list it here, and add a headless test that solves it each
// way it should be solvable.
import type { PuzzleDef } from '../puzzle';
import { P1_GAP } from './p1-gap';
import { P2_RAIN } from './p2-rain';
import { P3_WIND } from './p3-wind';
import { P4_CHASM } from './p4-chasm';
import { P5_CROWS } from './p5-crows';
import { P6_GATE } from './p6-gate';

export const CHAPTER_1: readonly PuzzleDef[] = [P1_GAP, P2_RAIN, P3_WIND, P4_CHASM, P5_CROWS, P6_GATE];
export const CHAPTER_1_ID = 'chapter-1';
