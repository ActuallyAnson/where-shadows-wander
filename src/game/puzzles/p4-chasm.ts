// Puzzle 4, the chasm: a gap wider than one hand's shadow. Intended: the rabbit (found from the
// hint in puzzle 3) hops across and lowers a rope from the far side, and the traveller walks the
// rope. Also works: two flat hands as two bridges end to end. The fox's hint is in this scenery.
import { Touch } from '../../engine/sim/solver';
import { Role } from '../abilities';
import type { Fixture } from '../fixtures';
import { markerOf, TerrainTag } from '../level';
import type { PuzzleDef } from '../puzzle';

/** The rope hangs this far below the ground's top, so it reads as slung across. */
const ROPE_SAG = 0.012;
const ROPE_R = 0.015;

const state = {
  rope: -1,
  ropeFixture: null as Fixture | null,
  /** Bit 0: the traveller stood on the left hand as a bridge; bit 1: on the right. */
  bridges: 0,
};

export const P4_CHASM: PuzzleDef = {
  id: 'p4-chasm',
  layoutId: 'puzzle-4',
  title: 'The chasm',
  solutions: ['rabbit', 'two-bridges'],
  hintShape: 'rabbit',
  creatureHint: { creature: 'fox', x: -0.45, y: 0.25 },

  setup(ctx) {
    state.bridges = 0;
    const gap = markerOf(ctx.layout, 'gap');
    const half = gap ? gap.params.width / 2 : 0.25;
    const cx = gap ? gap.x : 0;
    const y = ctx.groundY - ROPE_SAG - ROPE_R;
    // The rope spans the chasm, ends resting on the ground either side; it is down only once lowered.
    state.rope = ctx.solver.terrain.add(cx - half - 0.06, y, cx + half + 0.06, y, ROPE_R, TerrainTag.Rope, false);
    state.ropeFixture = ctx.fixtures.add('rope', cx, y, 2 * half + 0.12, 0.03, false);
  },

  afterStep(ctx) {
    const rabbit = ctx.companions.rabbit;
    const gap = markerOf(ctx.layout, 'gap');
    const farEdge = gap ? gap.x + gap.params.width / 2 : 0.3;
    if (state.rope >= 0 && !ctx.solver.terrain.enabled[state.rope] && rabbit.crossedAt > farEdge) {
      ctx.solver.terrain.enabled[state.rope] = 1;
      if (state.ropeFixture) state.ropeFixture.active = true;
      ctx.events.push('puzzle-event', 'rope-lowered', ctx.time, 0, rabbit.crossedAt, ctx.groundY);
    }
    const t = ctx.traveller;
    const on = t.standingOn(ctx);
    if (on === Touch.Terrain && ctx.solver.terrain.tag[t.standingOnId(ctx)] === TerrainTag.Rope)
      ctx.credit('rabbit', ctx.dt);
    if (on === Touch.Hand) {
      const h = t.standingOnId(ctx);
      if (ctx.abilities.has(h, Role.Bridge)) state.bridges |= 1 << h;
      if (state.bridges === 3) ctx.credit('two-bridges', ctx.dt);
    }
  },
};
