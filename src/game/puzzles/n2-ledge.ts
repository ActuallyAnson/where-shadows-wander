// Puzzle 2, the ledge: the stack of books stops short of the bedside table, and the table stands
// taller than the traveller can step. Intended: a fist in the gap as a step, which the traveller walks
// onto and the player lifts up to the table's top. Also works: a flat hand held low and lifted the
// same way. A shape held still at the books' height only gets the traveller as far as the table's
// side: the new idea is that a shape can carry it up.
import type { PuzzleDef } from '../puzzle';
import { goalOn, LEDGE_TOP, ledge, startOn } from './bedroom';

/** The gap between the books and the bedside table, metres: about a fist's shadow wide. */
export const LEDGE_GAP = 0.12;
/** How much higher the bedside table's top is than the books', metres (the traveller steps 0.03). */
export const TABLE_RISE = 0.12;
export const TABLE_TOP = LEDGE_TOP + TABLE_RISE;
/** Where the books end and the table begins, stage x. */
export const BOOKS_END_X = -0.06;
export const TABLE_X = BOOKS_END_X + LEDGE_GAP;

/** A fresh puzzle with its own state: one per Game, so two games never share it. */
export function createLedgePuzzle(): PuzzleDef {
  return {
    id: 'n2-ledge',
    title: 'The ledge',
    layout: {
      traveller: startOn(-0.7),
      goal: goalOn(0.6, TABLE_TOP),
      markers: [{ tag: 'gap', x: (BOOKS_END_X + TABLE_X) / 2, y: LEDGE_TOP - 0.07, width: LEDGE_GAP, height: 0.14 }],
    },
    props: [ledge('books', -0.8, BOOKS_END_X), ledge('bedside-table', TABLE_X, 0.8, TABLE_TOP, 0.26)],
    ground: false,
    groundY: LEDGE_TOP,
    solutions: ['rock', 'bridge'],
    hintShape: 'fist',
    // Credit for 'rock' and 'bridge' comes from the runner: the traveller standing on that role's
    // hand. The only way up is on a hand, so whichever it rode is the solution.
  };
}
