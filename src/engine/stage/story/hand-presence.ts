// How strongly the player's own hand shadow shows on the wall. While a memory plays it is faint, so the puppets carry the
// picture; when the story waits for a hand (the friend's hand showing its shape, or the end waiting for the flame to be
// covered) it darkens to full, which says "your turn" without a word. For the goodbye it goes right out, so the two puppet
// hands are all there is, and comes back after. Pure: time comes in as `dt`. Allocates nothing.

/** The shadow's strength while a memory plays, as a share of its full opacity. */
export const HAND_FAINT = 0.35;
/** Seconds to darken to full when the story calls for a hand. */
const RISE_S = 1.2;
/** Seconds to fade back once the shape is made: slower, so it lingers after the commit. */
const FALL_S = 2.5;
/** Seconds to go right out when the story hides it, and to come back after. */
const HIDE_S = 1.0;
const SHOW_S = 2.0;

const smooth = (t: number) => t * t * (3 - 2 * t);

export class HandPresence {
  /** 0 (faint) .. 1 (full), before easing. */
  private level = 1;
  /** 0 (shown) .. 1 (gone), before easing. */
  private hide = 0;

  /**
   * Once per frame. `called`: the story wants a hand now (or no story is playing, so nothing competes with the shadow).
   * `hidden`: the story wants it gone (the goodbye). Returns the multiplier for the shadow's opacity, 0..1.
   */
  update(dt: number, called: boolean, hidden = false): number {
    if (dt > 0) {
      this.level = called ? Math.min(1, this.level + dt / RISE_S) : Math.max(0, this.level - dt / FALL_S);
      this.hide = hidden ? Math.min(1, this.hide + dt / HIDE_S) : Math.max(0, this.hide - dt / SHOW_S);
    }
    return this.value;
  }

  /** The multiplier for the shadow's opacity now: HAND_FAINT..1, and down to 0 while hidden. */
  get value(): number {
    return (HAND_FAINT + (1 - HAND_FAINT) * smooth(this.level)) * (1 - smooth(this.hide));
  }
}
