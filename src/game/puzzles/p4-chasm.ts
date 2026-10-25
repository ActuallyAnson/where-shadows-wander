// Puzzle 4, the chasm: a gap wider than one hand's shadow. Intended: two flat hands as two bridges
// end to end. Also works: one flat hand as a ferry, the traveller standing on it while the player
// carries it across. One bridge held still is not enough: the traveller waits at its far end.
import { Touch } from '../../engine/sim/solver';
import { Role } from '../abilities';
import type { PuzzleDef } from '../puzzle';

/** A bridge hand moving at least this fast (m/s) with the traveller on it is a ferry. */
export const FERRY_SPEED = 0.04;

/** A fresh puzzle with its own state: one per Game, so two games never share it. */
export function createChasmPuzzle(): PuzzleDef {
  const state = {
    /** Bit 0: the traveller stood on the left hand as a bridge; bit 1: on the right. */
    bridges: 0,
  };
  return {
    id: 'p4-chasm',
    layoutId: 'puzzle-4',
    title: 'The chasm',
    solutions: ['two-bridges', 'ferry'],
    hintShape: 'flat',

    setup() {
      state.bridges = 0;
    },

    afterStep(ctx) {
      const t = ctx.traveller;
      if (t.standingOn(ctx) !== Touch.Hand) return;
      const h = t.standingOnId(ctx);
      if (!ctx.abilities.has(h, Role.Bridge)) return;
      state.bridges |= 1 << h;
      if (state.bridges === 3) ctx.credit('two-bridges', ctx.dt);
      const a = ctx.abilities.hands[h];
      if (a.vx * a.vx + a.vy * a.vy >= FERRY_SPEED * FERRY_SPEED) ctx.credit('ferry', ctx.dt);
    },
  };
}
