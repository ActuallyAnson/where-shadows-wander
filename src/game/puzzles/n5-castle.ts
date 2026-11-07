// Level 5, the castle (the last of the night, "combine what you learned"). Three stages, each
// harder than the last.
//
// 1. The castle: a toy castle behind a moat, its gate shut. The moat needs a flat hand as a bridge
//    (level 1's idea); the gate opens once something heavy rests on its counterweight, a plate on a
//    shelf above the path (so a rock on it doesn't block the way), and then stays open (level 2's
//    fist). Both are needed, in either order: which came first is the solution recorded,
//    `gate-first` or `bridge-first`.
// 2. The wide moat: the moat is wider than a hand, so the traveller is carried over it (level 1's
//    last stage), and the gate still wants its counterweight.
// 3. The keep: moat, gate, and then the keep's door stands a step up (level 2's lift). The outline
//    asks for whatever is next: the bridge, the counterweight, the lift.
//
// The traveller's goal on the last stage is inside the castle, where Game lights the window that
// ends the night.
import type { Shape } from '../../engine/hands/shapes';
import { HAND_COUNT } from '../../engine/sim/solver';
import { Role } from '../abilities';
import type { GameContext } from '../context';
import type { Fixture } from '../fixtures';
import { markerOf, TerrainTag, type LevelRect } from '../level';
import type { PuzzleDef } from '../puzzle';
import { gapAhead, gapMarker, goalOn, hintAtGapAhead, LEDGE_TOP, ledge, PROP_DEPTH, startOn } from './bedroom';
import { TABLE_TOP } from './n2-ledge';

/** The moat's edges, stage x: 0.22 m, as wide as the tutorial's gap. */
export const MOAT_LEFT = -0.1;
export const MOAT_RIGHT = 0.12;
/** The gate at the castle's door, stage x. */
export const GATE_X = 0.44;
/** Stage 2: the wide moat (as wide as level 1's wide gap). */
export const WIDE_MOAT: readonly [number, number] = [-0.12, 0.32];
/** Stage 3: the moat, the gate, the counterweight, and the step up to the keep. */
export const KEEP_MOAT: readonly [number, number] = [-0.3, -0.08];
export const KEEP_GATE_X = 0.2;
export const KEEP_PLATE_X = -0.55;
export const KEEP_STEP: readonly [number, number] = [0.36, 0.48];
/** How tall the gate stands above the floor. */
const GATE_HEIGHT = 0.2;
const GATE_R = 0.012;
/** Seconds a rock must rest on the counterweight before the gate opens. */
export const OPEN_S = 0.3;
/** A rock this close above the plate's top presses it. */
const PRESS_SLACK = 0.015;
/** The shelf under the plate: a thin plank as wide as the plate. */
const SHELF_R = 0.012;
/** A moat wider than this is more than a hand's shadow can span. */
const HAND_SPAN = 0.3;

/** Whether a rock-role hand rests on the counterweight plate. */
function pressed(ctx: GameContext): boolean {
  const plate = markerOf(ctx.layout, 'plate');
  if (!plate) return false;
  const top = plate.y + plate.params.height / 2,
    bottom = plate.y - plate.params.height / 2,
    left = plate.x - plate.params.width / 2,
    right = plate.x + plate.params.width / 2;
  for (let h = 0; h < HAND_COUNT; h++) {
    if (!ctx.abilities.has(h, Role.Rock)) continue;
    const b = ctx.solver.hands[h].bounds;
    // Resting on the plate: its lowest point at the plate's top, not anywhere below it.
    if (b[1] <= top + PRESS_SLACK && b[1] >= bottom - PRESS_SLACK && b[2] >= left && b[0] <= right) return true;
  }
  return false;
}

/** How one castle is laid out (STAGE_1 is the first stage's). */
export interface CastleLayout {
  readonly id: string;
  readonly title: string;
  readonly moat: readonly [number, number];
  readonly gateX: number;
  /** The counterweight plate's centre, stage x. */
  readonly plateX: number;
  /** A step up to the keep after the gate, stage x (the keep's top is TABLE_TOP), or none. */
  readonly step?: readonly [number, number];
  readonly goalX: number;
}

const STAGE_1: CastleLayout = {
  id: 'n5-castle',
  title: 'The castle',
  moat: [MOAT_LEFT, MOAT_RIGHT],
  gateX: GATE_X,
  plateX: -0.3,
  goalX: 0.62,
};

/** A fresh puzzle with its own state: one per Game, so two games never share it. */
export function createCastlePuzzle(c: CastleLayout = STAGE_1): PuzzleDef {
  const [moatLeft, moatRight] = c.moat;
  const gateX = c.gateX;
  const step = c.step;
  const top = step ? TABLE_TOP : LEDGE_TOP;
  const state = {
    gate: -1,
    gateFixture: null as Fixture | null,
    plateFixture: null as Fixture | null,
    /** Seconds the counterweight has been held down. */
    heldT: 0,
  };
  const travellerX = (ctx: GameContext) => {
    const s = ctx.traveller.slot(ctx);
    return s < 0 ? -Infinity : ctx.store.x[s];
  };
  /** Whether the traveller is over the moat or past it. */
  const pastMoat = (ctx: GameContext) => travellerX(ctx) > moatRight;
  const pastGate = (ctx: GameContext) => travellerX(ctx) > gateX;
  const gateOpen = (ctx: GameContext) => state.gate < 0 || ctx.solver.terrain.enabled[state.gate] === 0;
  /** What the traveller needs next: the bridge until it is over the moat, then the gate. */
  const needsGate = (ctx: GameContext) => pastMoat(ctx) && !gateOpen(ctx);
  /** Past the gate, the step up to the keep is next. */
  const needsLift = (ctx: GameContext) => step !== undefined && pastGate(ctx);
  const open = (ctx: GameContext) => {
    ctx.solver.terrain.enabled[state.gate] = 0;
    if (state.gateFixture) {
      state.gateFixture.active = false;
      state.gateFixture.value = 1;
    }
    ctx.events.push('puzzle-event', 'gate-open', ctx.time, 0, gateX, LEDGE_TOP);
    ctx.credit(pastMoat(ctx) ? 'bridge-first' : 'gate-first', 1);
  };
  const markers: (LevelRect & { readonly tag: string })[] = [
    gapMarker(moatLeft, moatRight),
    { tag: 'plate', x: c.plateX, y: -0.02, width: 0.14, height: 0.03 },
  ];
  if (step) markers.push(gapMarker(step[0], step[1]));
  return {
    id: c.id,
    title: c.title,
    layout: { traveller: startOn(-0.7), goal: goalOn(c.goalX, top), markers },
    props: [
      ledge('path', -0.8, moatLeft),
      ledge('castle-floor', moatRight, step ? step[0] : 0.8),
      ...(step ? [ledge('keep', step[1], 0.8, TABLE_TOP, 0.26)] : []),
      // The castle is scenery: its towers stand above the floor, clear of the traveller's head.
      { id: 'castle', shape: 'box', x: c.goalX, y: top + 0.36, size: [0.3, 0.5, PROP_DEPTH], solid: false },
    ],
    ground: false,
    groundY: LEDGE_TOP,
    solutions: ['gate-first', 'bridge-first'],
    hintShape: 'flat',
    // The finale waits a little longer before its hint (design worksheet).
    hintDelayS: 30,

    setup(ctx) {
      state.heldT = 0;
      // The gate stands upright on the castle floor at the door, shut until the counterweight is pressed.
      const bottom = LEDGE_TOP + GATE_R;
      state.gate = ctx.solver.terrain.add(gateX, bottom, gateX, LEDGE_TOP + GATE_HEIGHT, GATE_R, TerrainTag.Gate);
      state.gateFixture = ctx.fixtures.add('gate', gateX, LEDGE_TOP + GATE_HEIGHT / 2, 2 * GATE_R, GATE_HEIGHT);
      const plate = markerOf(ctx.layout, 'plate');
      state.plateFixture = null;
      if (plate) {
        const half = plate.params.width / 2,
          sy = plate.y - plate.params.height / 2 - SHELF_R;
        ctx.solver.terrain.add(plate.x - half + SHELF_R, sy, plate.x + half - SHELF_R, sy, SHELF_R, TerrainTag.Wall);
        state.plateFixture = ctx.fixtures.add('plate', plate.x, plate.y, plate.params.width, plate.params.height);
      }
    },

    afterStep(ctx) {
      if (state.gate < 0) return;
      const down = pressed(ctx);
      if (state.plateFixture) state.plateFixture.value = down ? 1 : 0;
      if (gateOpen(ctx)) return;
      state.heldT = down ? state.heldT + ctx.dt : 0;
      if (state.heldT >= OPEN_S) open(ctx);
    },

    // The ladder's last rung: at the gate, it swings open by itself. (At the moat and the step, the outline is the help.)
    ease(ctx) {
      if (needsGate(ctx)) open(ctx);
    },

    // What is next: the counterweight at a shut gate, the lift past the gate, otherwise the bridge.
    hintShapeAt(ctx): Shape {
      return needsGate(ctx) || needsLift(ctx) ? 'fist' : 'flat';
    },

    hintAt(ctx, out) {
      const plate = markerOf(ctx.layout, 'plate');
      if (plate && needsGate(ctx)) {
        out[0] = plate.x;
        out[1] = plate.y + 0.08;
      } else if (needsLift(ctx) && gapAhead(ctx)) {
        hintAtGapAhead(ctx, out, -0.065);
      } else {
        // Over the moat; one too wide for a hand at its near edge, where the traveller steps on.
        out[0] = moatRight - moatLeft > HAND_SPAN ? moatLeft + 0.13 : (moatLeft + moatRight) / 2;
        out[1] = ctx.groundY;
      }
    },
  };
}

/** Stage 2, the wide moat: carried over, and the counterweight. */
export function createWideMoatPuzzle(): PuzzleDef {
  return createCastlePuzzle({ ...STAGE_1, id: 'n5-wide-moat', title: 'The wide moat', moat: WIDE_MOAT });
}

/** Stage 3, the keep: moat, gate, and a step up to the keep's door. */
export function createKeepPuzzle(): PuzzleDef {
  return createCastlePuzzle({
    id: 'n5-keep',
    title: 'The keep',
    moat: KEEP_MOAT,
    gateX: KEEP_GATE_X,
    plateX: KEEP_PLATE_X,
    step: KEEP_STEP,
    goalX: 0.65,
  });
}

/** Level 5's stages, in order. */
export function createCastleLevel(): PuzzleDef[] {
  return [createCastlePuzzle(), createWideMoatPuzzle(), createKeepPuzzle()];
}
