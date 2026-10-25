// Puzzle 1, the books (the tutorial; GDD "First five minutes"): two stacks of books with a gap
// between them. The traveller walks in and stops at the gap; a faint ghost outline of a flat hand
// appears over it at once; the player matches it, and the traveller crosses on the hand's shadow.
// One solution, taught without words. (Main's src/game/tutorial-flow.ts plays the same scene on its
// own until the app drives Game.)
import type { PuzzleDef } from '../puzzle';
import { goalOn, LEDGE_TOP, ledge, startOn } from './bedroom';

/** The gap between the books and the toy block, metres. */
export const BOOKS_GAP = 0.22;

/** A fresh puzzle with its own state: one per Game, so two games never share it. */
export function createBooksPuzzle(): PuzzleDef {
  const half = BOOKS_GAP / 2;
  return {
    id: 'n1-books',
    title: 'The books',
    layout: {
      traveller: startOn(-0.7),
      goal: goalOn(0.7),
      markers: [{ tag: 'gap', x: 0, y: LEDGE_TOP - 0.07, width: BOOKS_GAP, height: 0.14 }],
    },
    props: [ledge('books', -0.8, -half), ledge('toy-block', half, 0.8)],
    ground: false,
    groundY: LEDGE_TOP,
    solutions: ['bridge'],
    hintShape: 'flat',
    // The tutorial shows its hint as soon as the traveller has stopped, not after 20 s.
    hintDelayS: 0.5,
    // Credit for 'bridge' comes from the runner: the traveller standing on a bridge-role hand.
  };
}
