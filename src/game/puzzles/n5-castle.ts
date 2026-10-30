// Puzzle 5, the castle (the last of the night, "combine what you learned"): a toy castle behind a
// moat, its gate shut. The moat needs a flat hand as a bridge (puzzle 1's idea); the gate opens once
// something heavy rests on its counterweight, a plate on a shelf above the path (so a rock on it
// doesn't block the way), and then stays open (puzzle 2's fist). Both are needed, in either order:
// which came first is the solution recorded, `gate-first` or `bridge-first`. The traveller's goal is
// inside the castle, where Game lights the window that ends the night.
import type { Shape } from '../../engine/hands/shapes';
import { HAND_COUNT } from '../../engine/sim/solver';
import { Role } from '../abilities';
import type { GameContext } from '../context';
import type { Fixture } from '../fixtures';
import { markerOf, TerrainTag } from '../level';
import type { PuzzleDef } from '../puzzle';
import { goalOn, LEDGE_TOP, ledge, PROP_DEPTH, startOn } from './bedroom';

/** The moat's edges, stage x: 0.22 m, as wide as the tutorial's gap. */
export const MOAT_LEFT = -0.1;
export const MOAT_RIGHT = 0.12;
/** The gate at the castle's door, stage x, and how tall it stands above the floor. */
export const GATE_X = 0.44;
const GATE_HEIGHT = 0.2;
const GATE_R = 0.012;
/** Seconds a rock must rest on the counterweight before the gate opens. */
export const OPEN_S = 0.3;
/** A rock this close above the plate's top presses it. */
const PRESS_SLACK = 0.015;
/** The shelf under the plate: a thin plank as wide as the plate. */
const SHELF_R = 0.012;

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

/** Whether the traveller is over the moat or past it. */
function pastMoat(ctx: GameContext): boolean {
  const s = ctx.traveller.slot(ctx);
  return s >= 0 && ctx.store.x[s] > MOAT_RIGHT;
}

/** A fresh puzzle with its own state: one per Game, so two games never share it. */
export function createCastlePuzzle(): PuzzleDef {
  const state = {
    gate: -1,
    gateFixture: null as Fixture | null,
    plateFixture: null as Fixture | null,
    /** Seconds the counterweight has been held down. */
    heldT: 0,
  };
  const gateOpen = (ctx: GameContext) => state.gate < 0 || ctx.solver.terrain.enabled[state.gate] === 0;
  /** What the traveller needs next: the bridge until it is over the moat, then the gate. */
  const needsGate = (ctx: GameContext) => pastMoat(ctx) && !gateOpen(ctx);
  const open = (ctx: GameContext) => {
    ctx.solver.terrain.enabled[state.gate] = 0;
    if (state.gateFixture) {
      state.gateFixture.active = false;
      state.gateFixture.value = 1;
    }
    ctx.events.push('puzzle-event', 'gate-open', ctx.time, 0, GATE_X, LEDGE_TOP);
    ctx.credit(pastMoat(ctx) ? 'bridge-first' : 'gate-first', 1);
  };
  return {
    id: 'n5-castle',
    title: 'The castle',
    layout: {
      traveller: startOn(-0.7),
      goal: goalOn(0.62),
      markers: [
        {
          tag: 'gap',
          x: (MOAT_LEFT + MOAT_RIGHT) / 2,
          y: LEDGE_TOP - 0.07,
          width: MOAT_RIGHT - MOAT_LEFT,
          height: 0.14,
        },
        { tag: 'plate', x: -0.3, y: -0.02, width: 0.14, height: 0.03 },
      ],
    },
    props: [
      ledge('path', -0.8, MOAT_LEFT),
      ledge('castle-floor', MOAT_RIGHT, 0.8),
      // The castle is scenery: its towers stand above the floor, clear of the traveller's head.
      { id: 'castle', shape: 'box', x: 0.62, y: 0.1, size: [0.3, 0.5, PROP_DEPTH], solid: false },
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
      state.gate = ctx.solver.terrain.add(GATE_X, bottom, GATE_X, LEDGE_TOP + GATE_HEIGHT, GATE_R, TerrainTag.Gate);
      state.gateFixture = ctx.fixtures.add('gate', GATE_X, LEDGE_TOP + GATE_HEIGHT / 2, 2 * GATE_R, GATE_HEIGHT);
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

    // The ladder's last rung: at the gate, it swings open by itself. (At the moat, the outline is the help.)
    ease(ctx) {
      if (needsGate(ctx)) open(ctx);
    },

    hintShapeAt(ctx): Shape {
      return needsGate(ctx) ? 'fist' : 'flat';
    },

    hintAt(ctx, out) {
      const plate = markerOf(ctx.layout, 'plate');
      if (plate && needsGate(ctx)) {
        out[0] = plate.x;
        out[1] = plate.y + 0.08;
      } else {
        out[0] = (MOAT_LEFT + MOAT_RIGHT) / 2;
        out[1] = ctx.groundY;
      }
    },
  };
}
