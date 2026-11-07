// Level 3, the dripping plant: shapes can shelter. Three stages, each harder than the last.
//
// 1. The dripping plant: a freshly watered plant on the shelf above drips onto the path, and the
//    drips would put out the traveller's lantern, so it will not walk into them. Intended: a cup
//    catches the drips over the traveller as it walks under. Also works: a flat hand held high as a
//    roof. Eased (the hint ladder's last rung), a third of the drops fall.
// 2. The hanging plant: a longer strip of drips that sways from side to side. A cover held still
//    no longer reaches; it must go along with the traveller.
// 3. Drips and a gap: the drips, then a gap in the shelf just past them: shelter first, then a
//    bridge (level 1's idea). A flat hand can be the roof and then the bridge.
//
// The drips themselves (falling, holding the traveller, crediting the cover) are in drips.ts.
import type { Shape } from '../../engine/hands/shapes';
import type { GameContext } from '../context';
import type { PuzzleDef } from '../puzzle';
import { gapMarker, goalOn, hintAtGapAhead, LEDGE_TOP, ledge, PROP_DEPTH, startOn } from './bedroom';
import { Drips, type DripStrip } from './drips';

export { EASED_DRIP_SHARE } from './drips';

/** Where the drips fall (the plant's leaves), and where drops start. */
export const DRIP_LEFT = -0.1;
export const DRIP_RIGHT = 0.2;
const DRIP_Y = 0.3;
/** Drops a second. */
const DRIP_RATE = 14;

/** Stage 2: the hanging plant's strip and how far it swings. */
export const HANGING: DripStrip = { left: -0.3, right: 0.3, y: DRIP_Y, rate: 26, sway: 0.04, swayS: 5 };
/** Stage 3: the drips, and the gap in the shelf after them. */
export const GAP_DRIPS: DripStrip = { left: -0.45, right: -0.15, y: DRIP_Y, rate: 14 };
export const DRIP_GAP: readonly [number, number] = [0.05, 0.27];

/** The plant: scenery over the drips, its shadow drawn, never walked on. */
const plant = (x: number, w = 0.07) =>
  ({ id: 'plant', shape: 'cylinder', x, y: 0.38, size: [w, 0.12, PROP_DEPTH], solid: false }) as const;

/** The outline beside the drips, where a cover goes. */
function hintBesideDrips(ctx: GameContext, drips: Drips, out: Float64Array): void {
  out[0] = drips.left - 0.05;
  out[1] = ctx.groundY + 0.2;
}

/** A fresh puzzle with its own state: one per Game, so two games never share it. */
export function createDripPuzzle(): PuzzleDef {
  const drips = new Drips({ left: DRIP_LEFT, right: DRIP_RIGHT, y: DRIP_Y, rate: DRIP_RATE });
  return {
    id: 'n3-drip',
    title: 'The dripping plant',
    layout: { traveller: startOn(-0.7), goal: goalOn(0.7) },
    props: [ledge('shelf', -0.81, 0.81), plant(0.05)],
    ground: false,
    groundY: LEDGE_TOP,
    solutions: ['cup', 'roof'],
    hintShape: 'cup',
    setup: (ctx) => drips.setup(ctx),
    step: (ctx) => drips.step(ctx),
    afterStep: (ctx) => drips.afterStep(ctx),
    ease: () => drips.ease(),
    hintAt: (ctx, out) => hintBesideDrips(ctx, drips, out),
  };
}

/** Stage 2, the hanging plant: a long, swaying strip of drips. */
export function createHangingPlantPuzzle(): PuzzleDef {
  const drips = new Drips(HANGING);
  return {
    id: 'n3-hanging',
    title: 'The hanging plant',
    layout: { traveller: startOn(-0.7), goal: goalOn(0.7) },
    props: [ledge('shelf', -0.81, 0.81), plant(0, 0.2)],
    ground: false,
    groundY: LEDGE_TOP,
    solutions: ['cup', 'roof'],
    hintShape: 'cup',
    setup: (ctx) => drips.setup(ctx),
    step: (ctx) => drips.step(ctx),
    afterStep: (ctx) => drips.afterStep(ctx),
    ease: () => drips.ease(),
    hintAt: (ctx, out) => hintBesideDrips(ctx, drips, out),
  };
}

/** Stage 3, drips and a gap: shelter, then a bridge. */
export function createDripGapPuzzle(): PuzzleDef {
  const drips = new Drips(GAP_DRIPS);
  /** Past the drips, the gap is what is in the way. */
  const pastDrips = (ctx: GameContext) => {
    const s = ctx.traveller.slot(ctx);
    return s >= 0 && ctx.store.x[s] > GAP_DRIPS.right;
  };
  return {
    id: 'n3-drip-gap',
    title: 'Drips and a gap',
    layout: { traveller: startOn(-0.7), goal: goalOn(0.7), markers: [gapMarker(DRIP_GAP[0], DRIP_GAP[1])] },
    props: [ledge('shelf', -0.81, DRIP_GAP[0]), ledge('toy-box', DRIP_GAP[1], 0.81), plant(-0.3)],
    ground: false,
    groundY: LEDGE_TOP,
    // Recorded by the cover (the bridge after it is level 1's idea, and not this level's way).
    solutions: ['cup', 'roof'],
    hintShape: 'cup',
    hintShapeAt: (ctx): Shape => (pastDrips(ctx) ? 'flat' : 'cup'),
    setup: (ctx) => drips.setup(ctx),
    step: (ctx) => drips.step(ctx),
    afterStep: (ctx) => drips.afterStep(ctx),
    ease: () => drips.ease(),
    hintAt(ctx, out) {
      if (pastDrips(ctx)) hintAtGapAhead(ctx, out);
      else hintBesideDrips(ctx, drips, out);
    },
  };
}

/** Level 3's stages, in order. */
export function createDripLevel(): PuzzleDef[] {
  return [createDripPuzzle(), createHangingPlantPuzzle(), createDripGapPuzzle()];
}
