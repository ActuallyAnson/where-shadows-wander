// The fan's wind (shared by every puzzle with a fan in it): a band of wind from `from` to `to` on
// the stage that pushes the traveller back toward its start, harder than it can walk. A spread hand
// standing on its windward side shelters it ('wall'); a fist held just above it is something to hold
// on to ('anchor'), and the traveller makes slow headway. Plain TypeScript; no allocation per step.
import { HAND_COUNT } from '../../engine/sim/solver';
import { Role } from '../abilities';
import type { GameContext } from '../context';
import type { Fixture } from '../fixtures';
import { WALK_SPEED } from '../traveller';

/** How hard the fan pushes against the traveller, m/s. */
export const WIND_PUSH = -0.22;
/** Once the hint ladder eases the puzzle: a breeze the traveller can walk against. */
export const EASED_WIND_PUSH = -0.05;
/** An anchored traveller still feels this share of the wind (it leans in, but makes way). */
const ANCHORED_SHARE = 0.25;
/**
 * How close the rock must be to anchor the traveller, metres. A fist lower than about 0.13 m above
 * the traveller's centre stands in its way, so this leaves a band about 12 cm tall to hold it in.
 */
const ANCHOR_REACH = 0.25;

// The wind is stronger than the traveller's stride: on its own it never gets through.
if (WIND_PUSH + WALK_SPEED >= 0) throw new Error('wind: the fan must out-push the traveller');
if (EASED_WIND_PUSH + WALK_SPEED <= 0) throw new Error('wind: the eased breeze must let the traveller through');

/** Where the wind blows: from stage x `from` to `to`, and how hard (default WIND_PUSH). */
export interface WindBand {
  readonly from: number;
  readonly to: number;
  readonly push?: number;
}

export class Wind {
  /** How hard it blows now (eased: EASED_WIND_PUSH). */
  push: number;
  private fixture: Fixture | null = null;

  constructor(readonly band: WindBand) {
    this.push = band.push ?? WIND_PUSH;
  }

  /** On puzzle load: full strength, and the wind fixture the renderer draws. */
  setup(ctx: GameContext): void {
    const b = this.band;
    this.push = b.push ?? WIND_PUSH;
    this.fixture = ctx.fixtures.add('wind', (b.from + b.to) / 2, ctx.groundY + 0.25, b.to - b.from, 0.5, true, 1);
  }

  /** Before the solver: pushes the traveller back unless something shelters or anchors it. */
  step(ctx: GameContext): void {
    const t = ctx.traveller;
    const s = t.slot(ctx);
    const wind = this.fixture;
    if (s < 0 || t.state === 'goal' || !wind) return;
    const { store } = ctx;
    const x = store.x[s],
      y = store.y[s],
      r = store.radius[s];
    // value: how hard the wind reaches the traveller (1 full, low when sheltered), for the renderer.
    wind.value = Math.min(1, this.push / WIND_PUSH);
    if (x < this.band.from || x > this.band.to) return;
    if (ctx.abilities.wallShelters(ctx, x, y, r, 1)) {
      ctx.credit('wall', ctx.dt);
      wind.value = 0.2;
      return;
    }
    if (anchored(ctx, x, y)) {
      ctx.credit('anchor', ctx.dt);
      t.push = this.push * ANCHORED_SHARE;
      return;
    }
    t.push = this.push;
  }

  /** The ladder's last rung: the fan slows to a breeze. */
  ease(): void {
    this.push = EASED_WIND_PUSH;
    if (this.fixture) this.fixture.value = EASED_WIND_PUSH / WIND_PUSH;
  }
}

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
