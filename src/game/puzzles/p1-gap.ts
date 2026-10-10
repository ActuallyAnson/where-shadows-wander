// Puzzle 1, the tutorial (GDD "The first five minutes"): the traveller walks in and stops at a gap.
// A faint ghost outline of a flat hand appears over the gap at once; the player matches it, and the
// traveller crosses on the hand's shadow. One solution, taught without words.
import type { PuzzleDef } from '../puzzle';

/** A fresh puzzle with its own state: one per Game, so two games never share it. */
export function createGapPuzzle(): PuzzleDef {
  return {
    id: 'p1-gap',
    layoutId: 'puzzle-1',
    title: 'The gap',
    solutions: ['bridge'],
    hintShape: 'flat',
    // The tutorial shows its hint as soon as the traveller has stopped, not after 20 s.
    hintDelayS: 0.5,
    // Credit for 'bridge' comes from the runner: the traveller standing on a bridge-role hand.
  };
}
