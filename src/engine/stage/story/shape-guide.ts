// How the wall tells the player, without a word, that they are getting close to the shape the friend's hand is showing
// (docs/STORY.md, "How a memory starts"). While her hand waits it reads how near the player's hand is to her shape (the
// classifier's margin on it) and how far into the hold it is, and gives back:
// - `closeness`, 0..1, eased: the candle steadies and brightens with it (warmer, colder);
// - `presence` and `x`, `y`: a faint outline of her shape (ghost-outline.ts: a line round it, mirrored to face her hand) that
//   stands still beside her hand, toward the middle of the wall, where his matching hand would go: a frame to fill. It does not
//   follow the player's shadow: a projected shadow can swing a long way for a small move (a hand behind the flame), and the
//   ghost went with it. The shape is recognised anywhere on the wall; the outline is only a place to aim.
// - `hold`, 0..1, and `leanX`, `leanY`: once the shape is recognised and held, her hand leans a little toward the player's,
//   so a player who has it right keeps holding it.
// Pure: time comes in as `dt`. Allocates nothing.

/** Tolerance units outside the shape's ranges that still count as a little close: a margin of -REACH is 0, 0 (a match) is 1. */
export const GUIDE_REACH = 4;
/** Seconds for the ghost to come in once her hand shows its shape, and to go once it doesn't (or the shape is copied). */
const PRESENCE_IN_S = 0.8;
const PRESENCE_OUT_S = 0.5;
/** Time constants of the easing, seconds: closeness, the hold (quick up, slower down) and the lean. */
const CLOSE_TAU = 0.25;
const HOLD_UP_TAU = 0.08;
const HOLD_DOWN_TAU = 0.4;
const LEAN_TAU = 0.3;
/**
 * How far the ghost stands from her hand, stage metres, toward the middle of the wall (to the right when her hand is in the
 * middle): clear of her painted hands (0.27 to 0.38 m wide as drawn), close enough to read as the pair to hers.
 */
export const GHOST_GAP_M = 0.42;
/** How far her hand leans toward the player's at a full hold, stage metres. */
export const LEAN_M = 0.04;

/** How close a margin is to matching, 0..1 (see GUIDE_REACH). NaN and -Infinity (no hand) are 0. */
export function closenessOf(margin: number): number {
  if (!(margin > -Infinity)) return 0;
  return Math.min(1, Math.max(0, 1 + margin / GUIDE_REACH));
}

const ease = (from: number, to: number, dt: number, tau: number) => from + (to - from) * (1 - Math.exp(-dt / tau));

export class ShapeGuide {
  /** 0..1: how close the player's hand is to her shape, eased. 0 while she isn't waiting. */
  closeness = 0;
  /** 0..1: how far into holding her shape the player is, eased (1 once it has committed). */
  hold = 0;
  /** 0..1: how much the ghost of her shape is showing. */
  presence = 0;
  /** Where the ghost is (stage metres): beside her hand (GHOST_GAP_M), kept where it was as it fades. */
  x = 0;
  y = 0;
  /** Her hand's lean toward the player's, stage metres, to add to its place. */
  leanX = 0;
  leanY = 0;

  /**
   * Once per frame; 0 holds everything still.
   * @param active her hand is in place, waiting for a shape (not rising, not copying the player, not leaving)
   * @param margin the player's best margin on her shape (tolerance units), -Infinity with no hand
   * @param hold 0..1 of the player's hold of her shape (1 once committed)
   * @param ax where the player's shadow is (NaN with no hand): only her lean goes toward it
   * @param fx where her hand is, without the lean
   * @param gx where the outline stands when the scene sets it (FriendBeat.guide); NaN: beside her hand
   */
  update(
    dt: number,
    active: boolean,
    margin: number,
    hold: number,
    ax: number,
    ay: number,
    fx: number,
    fy: number,
    gx = NaN,
    gy = NaN,
  ): void {
    if (!(dt > 0)) return;
    const tracked = Number.isFinite(ax) && Number.isFinite(ay);
    const on = active && tracked;
    this.presence = active
      ? Math.min(1, this.presence + dt / PRESENCE_IN_S)
      : Math.max(0, this.presence - dt / PRESENCE_OUT_S);
    this.closeness = ease(this.closeness, active ? closenessOf(margin) : 0, dt, CLOSE_TAU);
    const h = active ? Math.min(1, Math.max(0, hold)) : 0;
    this.hold = ease(this.hold, h, dt, h > this.hold ? HOLD_UP_TAU : HOLD_DOWN_TAU);
    if (active && Number.isFinite(gx) && Number.isFinite(gy)) {
      this.x = gx;
      this.y = gy;
    } else if (active && Number.isFinite(fx) && Number.isFinite(fy)) {
      this.x = fx + (fx > 0 ? -GHOST_GAP_M : GHOST_GAP_M);
      this.y = fy;
    }
    let lx = 0,
      ly = 0;
    if (on) {
      const dx = ax - fx,
        dy = ay - fy;
      const d = Math.hypot(dx, dy);
      if (d > 1e-6) {
        lx = (dx / d) * LEAN_M * this.hold;
        ly = (dy / d) * LEAN_M * this.hold;
      }
    }
    this.leanX = ease(this.leanX, lx, dt, LEAN_TAU);
    this.leanY = ease(this.leanY, ly, dt, LEAN_TAU);
  }

  /** Forgets it all at once (the story stopped or jumped). */
  reset(): void {
    this.closeness = this.hold = this.presence = this.leanX = this.leanY = 0;
  }

  /** How much the candle's flicker is calmed, 0..1: it steadies as the player gets close. */
  get steady(): number {
    return 0.85 * this.closeness;
  }

  /** How much brighter the candle burns, as a share: a little with closeness, a little more as the shape is held. */
  get boost(): number {
    return 0.1 * this.closeness + 0.1 * this.hold;
  }
}
