// Level 4, the fan: shapes can block. Three stages, each harder than the last.
//
// 1. The fan: a desk fan at the end of the shelf blows across its right half and pushes the
//    traveller back. Intended: a spread hand stands upright on its windward side as a windbreak.
//    Also works: a fist held just above the traveller as a rock to hold on to (an anchor), carried
//    along with it.
// 2. Two fans: a small fan, a calm, then a big fan that blows harder: the windbreak goes with the
//    traveller twice, and the second time it must hold against more.
// 3. The fan and the step: through the wind, then up a step onto the bedside table (level 2's
//    lift). The shape the outline asks for changes with the obstacle ahead.
//
// The wind itself (pushing, sheltering, anchoring) is in wind.ts.
import type { Shape } from '../../engine/hands/shapes';
import { WALL_WIDTH_M } from '../../engine/stage/stage-frame';
import type { GameContext } from '../context';
import type { LevelProp } from '../props';
import type { PuzzleDef } from '../puzzle';
import { gapMarker, goalOn, hintAtGapAhead, LEDGE_TOP, ledge, PROP_DEPTH, startOn } from './bedroom';
import { TABLE_TOP } from './n2-ledge';
import { Wind, WIND_PUSH } from './wind';

export { EASED_WIND_PUSH, WIND_PUSH } from './wind';

/** Where the fan's wind blows from (this stage x to the right edge). */
export const WIND_FROM_X = -0.25;
/** Stage 2: the small fan's wind, and the big fan's, which blows this much harder. */
export const SMALL_FAN: readonly [number, number] = [-0.5, -0.1];
export const BIG_FAN_FROM = 0.2;
export const BIG_FAN_PUSH = WIND_PUSH * 1.4;
/** Stage 3: the wind, and the step after it. */
export const STEP_WIND: readonly [number, number] = [-0.45, 0.0];
export const FAN_STEP_GAP: readonly [number, number] = [0.08, 0.2];

/** A desk fan's shadow (scenery): its head at (x, y), on a stand down to `base` (the shelf's top). */
function fan(id: string, x: number, y = 0, size = 0.12, base = LEDGE_TOP): LevelProp[] {
  const stand = y - base - size / 2;
  return [
    { id: `${id}-head`, shape: 'sphere', x, y, size: [size], depth: 0.06, solid: false },
    { id: `${id}-stand`, shape: 'cylinder', x, y: base + stand / 2, size: [0.015, stand, PROP_DEPTH], solid: false },
  ];
}

/** Stage 3's upper shelf (scenery), the fan standing on it and blowing down along the path. */
const UPPER_SHELF_TOP = 0.0;

/** The outline on the windward side of where the wind starts. */
function hintInWind(ctx: GameContext, from: number, out: Float64Array): void {
  out[0] = from + 0.15;
  out[1] = ctx.groundY + 0.15;
}

/** A fresh puzzle with its own state: one per Game, so two games never share it. */
export function createFanPuzzle(): PuzzleDef {
  const wind = new Wind({ from: WIND_FROM_X, to: WALL_WIDTH_M / 2 });
  return {
    id: 'n4-fan',
    title: 'The fan',
    layout: { traveller: startOn(-0.7), goal: goalOn(0.7) },
    // The fan is scenery, standing above the end of the shelf.
    props: [ledge('shelf', -0.81, 0.81), ...fan('fan', 0.72)],
    ground: false,
    groundY: LEDGE_TOP,
    solutions: ['wall', 'anchor'],
    hintShape: 'spread',
    setup: (ctx) => wind.setup(ctx),
    step: (ctx) => wind.step(ctx),
    ease: () => wind.ease(),
    hintAt: (ctx, out) => hintInWind(ctx, WIND_FROM_X, out),
  };
}

/** Stage 2, two fans: a small one, a calm, a big one. */
export function createTwoFansPuzzle(): PuzzleDef {
  const small = new Wind({ from: SMALL_FAN[0], to: SMALL_FAN[1] });
  const big = new Wind({ from: BIG_FAN_FROM, to: WALL_WIDTH_M / 2, push: BIG_FAN_PUSH });
  /** Past the small fan's wind, the big fan is next. */
  const pastSmall = (ctx: GameContext) => {
    const s = ctx.traveller.slot(ctx);
    return s >= 0 && ctx.store.x[s] > SMALL_FAN[1];
  };
  return {
    id: 'n4-two-fans',
    title: 'Two fans',
    layout: { traveller: startOn(-0.7), goal: goalOn(0.7) },
    props: [ledge('shelf', -0.81, 0.81), ...fan('small-fan', -0.05, -0.08, 0.08), ...fan('big-fan', 0.72, 0.02, 0.16)],
    ground: false,
    groundY: LEDGE_TOP,
    solutions: ['wall', 'anchor'],
    hintShape: 'spread',
    setup(ctx) {
      small.setup(ctx);
      big.setup(ctx);
    },
    step(ctx) {
      small.step(ctx);
      big.step(ctx);
    },
    ease() {
      small.ease();
      big.ease();
    },
    hintAt: (ctx, out) => hintInWind(ctx, pastSmall(ctx) ? BIG_FAN_FROM : SMALL_FAN[0], out),
  };
}

/** Stage 3, the fan and the step: shelter through the wind, then lift up the step. */
export function createFanStepPuzzle(): PuzzleDef {
  const wind = new Wind({ from: STEP_WIND[0], to: STEP_WIND[1] });
  const pastWind = (ctx: GameContext) => {
    const s = ctx.traveller.slot(ctx);
    return s >= 0 && ctx.store.x[s] > STEP_WIND[1];
  };
  return {
    id: 'n4-fan-step',
    title: 'The fan and the step',
    layout: {
      traveller: startOn(-0.7),
      goal: goalOn(0.6, TABLE_TOP),
      markers: [gapMarker(FAN_STEP_GAP[0], FAN_STEP_GAP[1])],
    },
    props: [
      ledge('shelf', -0.81, FAN_STEP_GAP[0]),
      ledge('bedside-table', FAN_STEP_GAP[1], 0.81, TABLE_TOP, 0.26),
      // The fan stands on a shelf above the step, blowing back along the path below.
      {
        id: 'upper-shelf',
        shape: 'box',
        x: 0.02,
        y: UPPER_SHELF_TOP - 0.02,
        size: [0.26, 0.04, PROP_DEPTH],
        solid: false,
      },
      ...fan('fan', 0.02, UPPER_SHELF_TOP + 0.1, 0.1, UPPER_SHELF_TOP),
    ],
    ground: false,
    groundY: LEDGE_TOP,
    // Recorded by what got it through the wind (the lift after it is level 2's idea).
    solutions: ['wall', 'anchor'],
    hintShape: 'spread',
    hintShapeAt: (ctx): Shape => (pastWind(ctx) ? 'fist' : 'spread'),
    setup: (ctx) => wind.setup(ctx),
    step: (ctx) => wind.step(ctx),
    ease: () => wind.ease(),
    hintAt(ctx, out) {
      if (pastWind(ctx)) hintAtGapAhead(ctx, out, -0.065);
      else hintInWind(ctx, STEP_WIND[0], out);
    },
  };
}

/** Level 4's stages, in order. */
export function createFanLevel(): PuzzleDef[] {
  return [createFanPuzzle(), createTwoFansPuzzle(), createFanStepPuzzle()];
}
