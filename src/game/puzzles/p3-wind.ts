// Puzzle 3, wind: a strong wind blows from the right across the second half of the stage and pushes
// the traveller back. Intended: a spread hand stands upright on its windward side as a windbreak.
// Also works: a fist held just above the traveller as a rock to hold on to (an anchor), carried
// along with it. The rabbit's hint is in this puzzle's scenery, ahead of the chasm in puzzle 4.
import { HAND_COUNT } from '../../engine/sim/solver';
import { WALL_WIDTH_M } from '../../engine/stage/stage-frame';
import { Role } from '../abilities';
import type { GameContext } from '../context';
import type { Fixture } from '../fixtures';
import type { PuzzleDef } from '../puzzle';
import { WALK_SPEED } from '../traveller';

/** Where the wind blows (from this stage x to the right edge), and how hard, m/s against the traveller. */
export const WIND_FROM_X = -0.25;
export const WIND_PUSH = -0.22;
/** An anchored traveller still feels this share of the wind (it leans in, but makes way). */
const ANCHORED_SHARE = 0.25;
/** How close the rock must be to anchor the traveller, metres. */
const ANCHOR_REACH = 0.15;

// The wind is stronger than the traveller's stride: on its own it never gets through.
if (WIND_PUSH + WALK_SPEED >= 0) throw new Error('p3-wind: the wind must out-push the traveller');

const state: { wind: Fixture | null } = { wind: null };

/** Whether a rock-role hand is close above the traveller for it to hold on to. */
function anchored(ctx: GameContext, x: number, y: number): boolean {
  for (let h = 0; h < HAND_COUNT; h++) {
    if (!ctx.abilities.has(h, Role.Rock)) continue;
    const a = ctx.abilities.hands[h];
    const dx = a.cx - x,
      dy = a.cy - y;
    if (dx * dx + dy * dy <= ANCHOR_REACH * ANCHOR_REACH && a.cy >= y) return true;
  }
  return false;
}

export const P3_WIND: PuzzleDef = {
  id: 'p3-wind',
  layoutId: 'puzzle-3',
  title: 'Wind',
  solutions: ['wall', 'anchor'],
  hintShape: 'spread',
  creatureHint: { creature: 'rabbit', x: 0.45, y: 0.25 },

  setup(ctx) {
    const right = WALL_WIDTH_M / 2;
    state.wind = ctx.fixtures.add(
      'wind',
      (WIND_FROM_X + right) / 2,
      ctx.groundY + 0.25,
      right - WIND_FROM_X,
      0.5,
      true,
      1,
    );
  },

  step(ctx) {
    const t = ctx.traveller;
    const s = t.slot(ctx);
    const wind = state.wind;
    if (s < 0 || t.state === 'goal' || !wind) return;
    const { store } = ctx;
    const x = store.x[s],
      y = store.y[s],
      r = store.radius[s];
    // value: how hard the wind reaches the traveller (1 full, low when sheltered), for the renderer.
    wind.value = 1;
    if (x < WIND_FROM_X) return;
    if (ctx.abilities.wallShelters(ctx, x, y, r, 1)) {
      ctx.credit('wall', ctx.dt);
      wind.value = 0.2;
      return;
    }
    if (anchored(ctx, x, y)) {
      ctx.credit('anchor', ctx.dt);
      t.push = WIND_PUSH * ANCHORED_SHARE;
      return;
    }
    t.push = WIND_PUSH;
  },

  hintAt(ctx, out) {
    out[0] = WIND_FROM_X + 0.15;
    out[1] = ctx.groundY + 0.15;
  },
};
