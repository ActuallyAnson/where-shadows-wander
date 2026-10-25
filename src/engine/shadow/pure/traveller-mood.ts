// The traveller's moods, as plain numbers: which sticker floats over their head and how it pops in and fades. It watches the
// traveller (where they are, whether they are waiting, whether the puzzle is solved, how near a hand is) and picks a sticker:
// sad after a fall, happy at the goal, surprised when a hand comes close, puzzled after a long wait. Visual only.
// Positions are stage coordinates, metres. Plain TypeScript, no allocation per update.

export const Sticker = { None: -1, Happy: 0, Sad: 1, Surprised: 2, Puzzled: 3 } as const;
export type StickerId = (typeof Sticker)[keyof typeof Sticker];
export const STICKER_COUNT = 4;

/** How long a sticker stays, seconds (pop in, hold, fade out). */
export const STICKER_LIFE_S = 2.4;
const POP_S = 0.22;
const FADE_S = 0.45;
/** A jump of this much between two frames is a respawn, not a step (the traveller walks about 0.003 m a frame). */
const TELEPORT_M = 0.3;
/** A hand joint this near the traveller surprises them, and they will not be surprised again for a few seconds. */
export const HAND_NEAR_M = 0.1;
const SURPRISE_COOLDOWN_S = 4;
/** Waiting at a gap this long (and then every so often) makes them look puzzled. */
const PUZZLED_AFTER_S = 6;
const PUZZLED_EVERY_S = 11;

/** Distance from (x, y) to the nearest of `count` joints (x, y pairs), or a large number for none. */
export function nearestJointGap(joints: Float32Array, count: number, x: number, y: number): number {
  let best = 1e9;
  for (let i = 0; i < count; i++) {
    const dx = joints[i * 2] - x,
      dy = joints[i * 2 + 1] - y;
    const d = dx * dx + dy * dy;
    if (d < best) best = d;
  }
  return best >= 1e9 ? best : Math.sqrt(best);
}

export class TravellerMood {
  sticker: StickerId = Sticker.None;
  /** Where the sticker hangs: the traveller's place when it was shown, following them while it lasts. */
  x = 0;
  y = 0;
  private t = -1;
  private seen = false;
  private px = 0;
  private py = 0;
  private wasSolved = false;
  private wasNear = false;
  private waitT = 0;
  private calm = 0; // seconds until a hand may surprise them again

  get active(): boolean {
    return this.t >= 0;
  }

  /** 0 to 1: in over the first moment, out over the last. */
  get alpha(): number {
    if (this.t < 0) return 0;
    const left = STICKER_LIFE_S - this.t;
    return Math.min(1, this.t / (POP_S * 0.5), left / FADE_S);
  }

  /** A little overshoot as it pops in, then 1. */
  get scale(): number {
    if (this.t < 0) return 0;
    const k = Math.min(1, this.t / POP_S);
    return k < 1 ? 1 + 0.25 * Math.sin(k * Math.PI) - (1 - k) * 0.6 : 1;
  }

  /** Seconds since it appeared (0 when not active). */
  get age(): number {
    return this.t < 0 ? 0 : this.t;
  }

  show(sticker: StickerId, x: number, y: number): void {
    this.sticker = sticker;
    this.x = x;
    this.y = y;
    this.t = 0;
  }

  hide(): void {
    this.t = -1;
    this.sticker = Sticker.None;
  }

  /**
   * Call once a frame with the traveller's place, whether they are waiting at a gap, whether the puzzle is solved, and the
   * distance from the nearest hand joint to them (a large number when no hand is on the stage).
   */
  update(dt: number, x: number, y: number, waiting: boolean, solved: boolean, handGap: number): void {
    if (!(dt > 0)) return;
    dt = Math.min(dt, 0.1);

    if (this.t >= 0) {
      this.t += dt;
      this.x = x;
      this.y = y;
      if (this.t >= STICKER_LIFE_S) this.hide();
    }
    if (this.calm > 0) this.calm -= dt;

    const jumped = this.seen && (Math.abs(x - this.px) > TELEPORT_M || Math.abs(y - this.py) > TELEPORT_M);
    this.px = x;
    this.py = y;
    this.seen = true;

    // The big moments take over whatever is showing; the small ones wait for a free moment.
    if (jumped) {
      this.show(Sticker.Sad, x, y);
      this.waitT = 0;
    } else if (solved && !this.wasSolved) {
      this.show(Sticker.Happy, x, y);
    }
    this.wasSolved = solved;

    if (waiting && !solved) {
      this.waitT += dt;
      if (this.waitT >= PUZZLED_AFTER_S) {
        this.waitT -= PUZZLED_EVERY_S;
        if (this.t < 0) this.show(Sticker.Puzzled, x, y);
      }
    } else {
      this.waitT = 0;
    }

    const near = handGap < HAND_NEAR_M;
    if (near && !this.wasNear && this.calm <= 0 && this.t < 0 && !solved) {
      this.show(Sticker.Surprised, x, y);
      this.calm = SURPRISE_COOLDOWN_S;
    }
    this.wasNear = near;
  }
}
