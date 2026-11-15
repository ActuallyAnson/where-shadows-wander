// The end (docs/STORY.md, scene 7): for six scenes covering the flame has paused the game, and her hand that showed every
// other shape is gone, so nothing says that now covering it is what's wanted. This shows it without a word: a faint ghost of
// a hand comes down over the candle, cups the flame, and lifts again, over and over. If the wait goes on, the ghost grows
// stronger, and after longer still a single word ("goodnight") is written on the wall. While the player's own hand is at the
// flame, the ghost gives way. Plain TypeScript; time comes in as `dt`.

/** Seconds into the wait before the ghost first comes. */
export const HINT_DELAY_S = 2;
/** One ghost cover, seconds: coming down, holding over the flame, lifting away, and a rest. */
export const DOWN_S = 2.4;
export const HOLD_S = 1.2;
export const UP_S = 1.4;
export const REST_S = 1.6;
export const CYCLE_S = DOWN_S + HOLD_S + UP_S + REST_S;
/** Height of the ghost's palm over the flame (m): where it starts and where it cups the flame. */
export const HIGH_M = 0.2;
export const LOW_M = 0.07;
/** The ghost's strength at first, and once the wait has gone on (it grows between the two times, seconds into the wait). */
export const FAINT = 0.4;
export const STRONG = 0.8;
export const STRONG_FROM_S = 20;
export const STRONG_BY_S = 30;
/** Seconds into the wait when the word is first written, and between its returns. */
export const WORD_AT_S = 40;
export const WORD_EVERY_S = 60;
/** How near the player's hand (0..1) makes the ghost give way, and how fast it goes and comes back (per second). */
const YIELD_NEAR = 0.25;
const YIELD_OUT = 3;
const YIELD_IN = 0.8;

const ease = (t: number): number => t * t * (3 - 2 * t);

export class SleepHint {
  /** 0 .. 1: how strongly to draw the ghost hand (0: not at all). */
  ghost = 0;
  /** Height of the ghost's palm over the flame (m). */
  lift = HIGH_M;
  /** True on the one update the word should be written on the wall. */
  sayWord = false;
  /** Seconds into the wait (0 while not waiting). */
  waited = 0;
  private yielded = 0;
  private nextWord = WORD_AT_S;

  /**
   * One frame. `waiting`: the story waits for the flame to be covered. `near`: 0 .. 1, how close the player's hand is to the
   * flame (1 at it). `covering`: 0 .. 1, how far the player's cover has got.
   */
  update(dt: number, waiting: boolean, near: number, covering: number): void {
    this.sayWord = false;
    if (!waiting) {
      this.ghost = 0;
      this.lift = HIGH_M;
      this.waited = 0;
      this.yielded = 0;
      this.nextWord = WORD_AT_S;
      return;
    }
    this.waited += dt;
    const busy = near > YIELD_NEAR || covering > 0;
    this.yielded = busy ? Math.min(1, this.yielded + dt * YIELD_OUT) : Math.max(0, this.yielded - dt * YIELD_IN);
    if (this.waited >= this.nextWord) {
      this.sayWord = true;
      this.nextWord += WORD_EVERY_S;
    }
    const t = this.waited - HINT_DELAY_S;
    if (t < 0) {
      this.ghost = 0;
      this.lift = HIGH_M;
      return;
    }
    const c = t % CYCLE_S;
    let shown: number;
    if (c < DOWN_S) {
      const k = ease(c / DOWN_S);
      this.lift = HIGH_M + (LOW_M - HIGH_M) * k;
      shown = Math.min(1, c / (DOWN_S * 0.35));
    } else if (c < DOWN_S + HOLD_S) {
      this.lift = LOW_M;
      shown = 1;
    } else if (c < DOWN_S + HOLD_S + UP_S) {
      const k = ease((c - DOWN_S - HOLD_S) / UP_S);
      this.lift = LOW_M + (HIGH_M - LOW_M) * k;
      shown = 1 - k;
    } else {
      this.lift = HIGH_M;
      shown = 0;
    }
    const grow = Math.min(1, Math.max(0, (this.waited - STRONG_FROM_S) / (STRONG_BY_S - STRONG_FROM_S)));
    this.ghost = shown * (FAINT + (STRONG - FAINT) * grow) * (1 - this.yielded);
  }
}
