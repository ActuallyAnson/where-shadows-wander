// Puzzle 6, the gate: a gate across the path opens while its weight plate is pressed down. The
// plate sits on a shelf above the path (so a rock on it doesn't block the traveller's way).
// Intended: a fist rock rests on the plate. The fox's dig under the gate was the second solution
// and is cut with the companions; this puzzle has one solution until the bedroom rework. The last
// puzzle of the chapter: its goal is the lit window (Game adds it).
import { HAND_COUNT } from '../../engine/sim/solver';
import { Role } from '../abilities';
import type { GameContext } from '../context';
import type { Fixture } from '../fixtures';
import { markerOf, TerrainTag } from '../level';
import type { PuzzleDef } from '../puzzle';

/** The gate post's stage x and height above the ground, metres. */
export const GATE_X = 0.3;
const GATE_HEIGHT = 0.25;
const GATE_R = 0.025;
/** Once the traveller is this close, the gate stays open until it is through (never shut on it). */
const PASSING = 0.1;
/** A rock this close above the plate's top presses it. */
const PRESS_SLACK = 0.015;
/** The shelf under the plate: a thin plank as wide as the plate. */
const SHELF_R = 0.012;

/** Whether a rock-role hand presses the plate marker. */
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

/** A fresh puzzle with its own state: one per Game, so two games never share it. */
export function createGatePuzzle(): PuzzleDef {
  const state = {
    gate: -1,
    gateFixture: null as Fixture | null,
    plateFixture: null as Fixture | null,
  };
  return {
    id: 'p6-gate',
    layoutId: 'puzzle-6',
    title: 'The gate',
    solutions: ['rock'],
    hintShape: 'fist',

    setup(ctx) {
      const y0 = ctx.groundY + GATE_R,
        y1 = ctx.groundY + GATE_HEIGHT;
      state.gate = ctx.solver.terrain.add(GATE_X, y0, GATE_X, y1, GATE_R, TerrainTag.Gate);
      state.gateFixture = ctx.fixtures.add('gate', GATE_X, (y0 + y1) / 2, 0.06, GATE_HEIGHT, true, 0);
      const plate = markerOf(ctx.layout, 'plate');
      state.plateFixture = null;
      if (plate) {
        const half = plate.params.width / 2,
          sy = plate.y - plate.params.height / 2 - SHELF_R;
        ctx.solver.terrain.add(plate.x - half + SHELF_R, sy, plate.x + half - SHELF_R, sy, SHELF_R, TerrainTag.Wall);
        state.plateFixture = ctx.fixtures.add(
          'plate',
          plate.x,
          plate.y,
          plate.params.width,
          plate.params.height,
          true,
          0,
        );
      }
    },

    afterStep(ctx) {
      if (state.gate < 0) return;
      const terrain = ctx.solver.terrain;
      const down = pressed(ctx);
      if (down) ctx.credit('rock', ctx.dt);
      if (state.plateFixture) state.plateFixture.value = down ? 1 : 0;
      const s = ctx.traveller.slot(ctx);
      const passing = s >= 0 && Math.abs(ctx.store.x[s] - GATE_X) < PASSING;
      const wasOpen = terrain.enabled[state.gate] === 0;
      const open = down || (wasOpen && passing);
      if (open !== wasOpen) {
        terrain.enabled[state.gate] = open ? 0 : 1;
        if (state.gateFixture) state.gateFixture.active = !open;
        ctx.events.push('puzzle-event', open ? 'gate-open' : 'gate-close', ctx.time, 0, GATE_X, ctx.groundY);
      }
      if (state.gateFixture) state.gateFixture.value = open ? 1 : 0;
    },

    hintAt(ctx, out) {
      const plate = markerOf(ctx.layout, 'plate');
      out[0] = plate ? plate.x : 0;
      out[1] = ctx.groundY + 0.08;
    },
  };
}
