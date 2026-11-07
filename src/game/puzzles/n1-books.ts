// Level 1, the books: your shadow is a bridge. Three stages, each harder than the last.
//
// 1. The books (the tutorial; GDD "First five minutes"): two stacks of books with a gap between
//    them. The traveller walks in and stops at the gap; a faint ghost outline of a flat hand appears
//    over it at once; the player matches it, and the traveller crosses on the hand's shadow. One
//    solution, taught without words.
// 2. Stepping stones: two gaps with a toy block between them. One hand bridges the first, then
//    moves on to the second: a bridge is something you move, not only hold.
// 3. The wide gap: wider than a hand's shadow is long. The traveller steps onto the bridge at the
//    near edge and stops at its end; the player carries it across. A fist carries it as well.
import type { PuzzleDef } from '../puzzle';
import { gapMarker, goalOn, hintAtGapAhead, ledge, startOn, LEDGE_TOP } from './bedroom';

/** The gap between the books and the toy block, metres. */
export const BOOKS_GAP = 0.22;
/** Stage 2's two gaps, stage x: a toy block stands between them. */
export const STONES_GAPS: readonly (readonly [number, number])[] = [
  [-0.34, -0.14],
  [0.12, 0.32],
];
/** Stage 3's gap: wider than a flat hand's shadow (0.3 m), so the traveller must be carried. */
export const WIDE_GAP = 0.44;
/** Seconds stuck before the outline on stages 2 and 3: sooner than later levels, it is still early in the night. */
const BOOKS_HINT_S = 10;

/** A fresh puzzle with its own state: one per Game, so two games never share it. */
export function createBooksPuzzle(): PuzzleDef {
  const half = BOOKS_GAP / 2;
  return {
    id: 'n1-books',
    title: 'The books',
    layout: {
      traveller: startOn(-0.7),
      goal: goalOn(0.7),
      markers: [gapMarker(-half, half)],
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

/** Stage 2, stepping stones: two gaps, one hand. */
export function createStonesPuzzle(): PuzzleDef {
  const [a, b] = STONES_GAPS;
  return {
    id: 'n1-stones',
    title: 'Stepping stones',
    layout: {
      traveller: startOn(-0.7),
      goal: goalOn(0.7),
      markers: [gapMarker(a[0], a[1]), gapMarker(b[0], b[1])],
    },
    props: [ledge('books', -0.8, a[0]), ledge('toy-block', a[1], b[0]), ledge('more-books', b[1], 0.8)],
    ground: false,
    groundY: LEDGE_TOP,
    solutions: ['bridge'],
    hintShape: 'flat',
    hintDelayS: BOOKS_HINT_S,
    hintAt: (ctx, out) => hintAtGapAhead(ctx, out),
  };
}

/** Stage 3, the wide gap: carry the traveller across. */
export function createWideGapPuzzle(): PuzzleDef {
  const half = WIDE_GAP / 2;
  return {
    id: 'n1-wide',
    title: 'The wide gap',
    layout: {
      traveller: startOn(-0.7),
      goal: goalOn(0.7),
      markers: [gapMarker(-half, half)],
    },
    props: [ledge('books', -0.8, -half), ledge('pillow', half, 0.8)],
    ground: false,
    groundY: LEDGE_TOP,
    solutions: ['bridge', 'rock'],
    hintShape: 'flat',
    hintDelayS: BOOKS_HINT_S,
    // The outline sits at the near edge, where the traveller can step on.
    hintAt(ctx, out) {
      out[0] = -half + 0.13;
      out[1] = ctx.groundY;
    },
  };
}

/** Level 1's stages, in order. */
export function createBooksLevel(): PuzzleDef[] {
  return [createBooksPuzzle(), createStonesPuzzle(), createWideGapPuzzle()];
}
