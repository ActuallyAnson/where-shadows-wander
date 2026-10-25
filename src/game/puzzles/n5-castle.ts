// Puzzle 5, the castle (the last of the night): a toy castle behind a moat, its drawbridge up. The
// drawbridge comes down once something heavy rests on its counterweight, a plate on a shelf above
// the path (so a rock on it doesn't block the way), and then stays down. Intended: a fist rock on
// the counterweight. Also works: a flat hand as a bridge over the moat. The traveller's goal is
// inside the castle, where Game lights the window that ends the night.
import { HAND_COUNT, Touch } from '../../engine/sim/solver';
import { Role } from '../abilities';
import type { GameContext } from '../context';
import type { Fixture } from '../fixtures';
import { markerOf, TerrainTag } from '../level';
import type { PuzzleDef } from '../puzzle';
import { goalOn, LEDGE_TOP, ledge, PROP_DEPTH, startOn } from './bedroom';

/** The moat's edges, stage x: 0.22 m, as wide as the tutorial's gap. */
export const MOAT_LEFT = -0.1;
export const MOAT_RIGHT = 0.12;
/** Seconds a rock must rest on the counterweight before the drawbridge comes down. */
export const LOWER_S = 0.3;
const BRIDGE_R = 0.012;
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

/** A fresh puzzle with its own state: one per Game, so two games never share it. */
export function createCastlePuzzle(): PuzzleDef {
  const state = {
    bridge: -1,
    bridgeFixture: null as Fixture | null,
    plateFixture: null as Fixture | null,
    /** Seconds the counterweight has been held down. */
    heldT: 0,
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
    solutions: ['drawbridge', 'bridge'],
    hintShape: 'fist',

    setup(ctx) {
      state.heldT = 0;
      const y = LEDGE_TOP - BRIDGE_R;
      // The drawbridge spans the moat, its top level with the path; it is solid only once down.
      state.bridge = ctx.solver.terrain.add(MOAT_LEFT, y, MOAT_RIGHT, y, BRIDGE_R, TerrainTag.Gate, false);
      state.bridgeFixture = ctx.fixtures.add(
        'drawbridge',
        (MOAT_LEFT + MOAT_RIGHT) / 2,
        y,
        MOAT_RIGHT - MOAT_LEFT,
        2 * BRIDGE_R,
        false,
        0,
      );
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
      if (state.bridge < 0) return;
      const terrain = ctx.solver.terrain;
      const down = pressed(ctx);
      if (state.plateFixture) state.plateFixture.value = down ? 1 : 0;
      const lowered = terrain.enabled[state.bridge] === 1;
      if (!lowered) {
        state.heldT = down ? state.heldT + ctx.dt : 0;
        if (state.heldT >= LOWER_S) {
          terrain.enabled[state.bridge] = 1;
          if (state.bridgeFixture) {
            state.bridgeFixture.active = true;
            state.bridgeFixture.value = 1;
          }
          ctx.events.push('puzzle-event', 'drawbridge-down', ctx.time, 0, (MOAT_LEFT + MOAT_RIGHT) / 2, LEDGE_TOP);
        }
      }
      const t = ctx.traveller;
      if (t.standingOn(ctx) === Touch.Terrain && t.standingOnId(ctx) === state.bridge) ctx.credit('drawbridge', ctx.dt);
    },

    hintAt(ctx, out) {
      const plate = markerOf(ctx.layout, 'plate');
      out[0] = plate ? plate.x : 0;
      out[1] = plate ? plate.y + 0.08 : ctx.groundY + 0.2;
    },
  };
}
