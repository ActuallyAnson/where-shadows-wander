// Level 2, the ledge: shapes can be a step. Three stages, each harder than the last.
//
// 1. The ledge: the stack of books stops short of the bedside table, and the table stands taller
//    than the traveller can step. Intended: a fist in the gap as a step, which the traveller walks
//    onto and the player lifts up to the table's top. Also works: a flat hand held low and lifted the
//    same way. A shape held still at the books' height only gets the traveller as far as the table's
//    side: the new idea is that a shape can carry it up.
// 2. The stair: the table, then the dresser, each a step taller: two lifts, one after the other.
// 3. The bridge and the step: a gap to bridge first (level 1's flat hand), then a step to lift.
//    The shape the outline asks for changes with the obstacle ahead.
import type { Shape } from '../../engine/hands/shapes';
import { HAND_COUNT, Touch } from '../../engine/sim/solver';
import { ROLE_NAMES } from '../abilities';
import type { GameContext } from '../context';
import type { PuzzleDef } from '../puzzle';
import { gapAhead, gapMarker, goalOn, hintAtGapAhead, LEDGE_TOP, ledge, startOn } from './bedroom';

/** The gap between the books and the bedside table, metres: about a fist's shadow wide. */
export const LEDGE_GAP = 0.12;
/** How much higher the bedside table's top is than the books', metres (the traveller steps 0.03). */
export const TABLE_RISE = 0.12;
export const TABLE_TOP = LEDGE_TOP + TABLE_RISE;
/** Where the books end and the table begins, stage x. */
export const BOOKS_END_X = -0.06;
export const TABLE_X = BOOKS_END_X + LEDGE_GAP;
/** How far a fist's shadow centre sits below the top of the ledge it is lifting from. */
const FIST_BELOW = 0.065;

/** Stage 2: the two gaps of the stair, stage x, and the dresser's top (a second rise above the table). */
export const STAIR_GAPS: readonly (readonly [number, number])[] = [
  [-0.36, -0.24],
  [0.16, 0.28],
];
export const DRESSER_TOP = TABLE_TOP + TABLE_RISE;

/** Stage 3: the gap to bridge, and the step to lift after it, stage x. */
export const STEP_BRIDGE_GAP: readonly [number, number] = [-0.42, -0.2];
export const STEP_GAP: readonly [number, number] = [0.1, 0.22];

/** How much more a second on a hand at the step counts than one on the bridge before it. */
const LIFT_WEIGHT = 5;

/** A fresh puzzle with its own state: one per Game, so two games never share it. */
export function createLedgePuzzle(): PuzzleDef {
  return {
    id: 'n2-ledge',
    title: 'The ledge',
    layout: {
      traveller: startOn(-0.7),
      goal: goalOn(0.6, TABLE_TOP),
      markers: [gapMarker(BOOKS_END_X, TABLE_X)],
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

/** Stage 2, the stair: two lifts. */
export function createStairPuzzle(): PuzzleDef {
  const [a, b] = STAIR_GAPS;
  return {
    id: 'n2-stair',
    title: 'The stair',
    layout: {
      traveller: startOn(-0.7),
      goal: goalOn(0.62, DRESSER_TOP),
      markers: [gapMarker(a[0], a[1]), gapMarker(b[0], b[1], TABLE_TOP)],
    },
    props: [
      ledge('books', -0.8, a[0]),
      ledge('bedside-table', a[1], b[0], TABLE_TOP, 0.26),
      ledge('dresser', b[1], 0.8, DRESSER_TOP, 0.38),
    ],
    ground: false,
    groundY: LEDGE_TOP,
    solutions: ['rock', 'bridge'],
    hintShape: 'fist',
    hintAt: (ctx, out) => hintAtGapAhead(ctx, out, -FIST_BELOW),
  };
}

/** Stage 3, the bridge and the step: a flat hand over the gap, then a fist up the step. */
export function createStepBridgePuzzle(): PuzzleDef {
  /** The step needs a lift; any other gap is bridged. */
  const wantsLift = (ctx: GameContext) => gapAhead(ctx)?.x === (STEP_GAP[0] + STEP_GAP[1]) / 2;
  return {
    id: 'n2-step-bridge',
    title: 'The bridge and the step',
    layout: {
      traveller: startOn(-0.7),
      goal: goalOn(0.6, TABLE_TOP),
      markers: [gapMarker(STEP_BRIDGE_GAP[0], STEP_BRIDGE_GAP[1]), gapMarker(STEP_GAP[0], STEP_GAP[1])],
    },
    props: [
      ledge('books', -0.8, STEP_BRIDGE_GAP[0]),
      ledge('more-books', STEP_BRIDGE_GAP[1], STEP_GAP[0]),
      ledge('bedside-table', STEP_GAP[1], 0.8, TABLE_TOP, 0.26),
    ],
    ground: false,
    groundY: LEDGE_TOP,
    // Recorded by what carried it up the step: the bridge over the first gap is time on a flat hand
    // too, so time on a hand at the step counts LIFT_WEIGHT times over.
    solutions: ['rock', 'bridge'],
    hintShape: 'flat',
    afterStep(ctx) {
      const t = ctx.traveller;
      const s = t.slot(ctx);
      if (s < 0 || t.standingOn(ctx) !== Touch.Hand || ctx.store.x[s] < STEP_GAP[0] - 0.05) return;
      const h = t.standingOnId(ctx);
      if (h >= 0 && h < HAND_COUNT) ctx.credit(ROLE_NAMES[ctx.abilities.hands[h].role], ctx.dt * LIFT_WEIGHT);
    },
    hintShapeAt: (ctx): Shape => (wantsLift(ctx) ? 'fist' : 'flat'),
    hintAt: (ctx, out) => hintAtGapAhead(ctx, out, wantsLift(ctx) ? -FIST_BELOW : 0),
  };
}

/** Level 2's stages, in order. */
export function createLedgeLevel(): PuzzleDef[] {
  return [createLedgePuzzle(), createStairPuzzle(), createStepBridgePuzzle()];
}
