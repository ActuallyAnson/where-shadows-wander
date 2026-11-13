// Scene 1's opening (docs/STORY.md, "Waking"): the headset stays black and far thunder rolls (it is what wakes him), then the
// eyes open: a slow heavy blink, a quicker wider one, then open. Before the thunder, his friend slowly gathers behind the shut
// lids as a faint glow, and the thunder breaks the dream. This is the timing only, as numbers: how open the eyes are, how
// clearly the friend shows and how visible the word is at a time `t`. The view (wake-view.ts) draws them. Pure: no three,
// no clock.

/** One point of a curve: at `t` seconds the value is `v`; between points it eases (smoothstep). */
export interface WakeKey {
  readonly t: number;
  readonly v: number;
}

export interface WakeScript {
  /** The word in the dark. Empty: no word. */
  readonly text: string;
  /** How visible the word is (0..1). */
  readonly textKeys: readonly WakeKey[];
  /** How open the eyes are (0 shut .. 1 fully open). */
  readonly lidKeys: readonly WakeKey[];
  /** When the far thunder rolls in the dark and wakes him, seconds; none if left out. */
  readonly thunderAt?: number;
  /**
   * Before the thunder, his friend in the black behind the shut lids, a faint pale glow of him: the dream he is waking from.
   * How clearly he shows (0 not at all .. 1 as clear as he gets, still faint). Left out: no dream.
   */
  readonly friendKeys?: readonly WakeKey[];
}

/** Seconds and levels of the opening. Tune here. */
export const WAKE_SCRIPT: WakeScript = {
  // No word (a whisper, "noo…", read wrong): a far thunder in the black wakes him instead. Its roll swells over the first
  // second and is still rumbling away as the eyes first open.
  text: '',
  textKeys: [{ t: 0, v: 0 }],
  // Before it, the dream: his friend slowly gathers in the black as a faint glow, never quite clear. The thunder breaks it: he
  // fades as it rolls, and the black holds before the first blink.
  friendKeys: [
    { t: 0, v: 0 },
    { t: 0.6, v: 0 },
    { t: 2.6, v: 1 },
    { t: 2.9, v: 1 },
    { t: 3.4, v: 0 },
  ],
  thunderAt: 2.9,
  lidKeys: [
    { t: 0, v: 0 },
    { t: 3.6, v: 0 }, // the dream, then a moment of plain black
    { t: 4.4, v: 0.25 }, // first blink: a slit, slow and heavy
    { t: 4.7, v: 0.25 },
    { t: 5.0, v: 0 },
    { t: 5.5, v: 0 },
    { t: 5.85, v: 0.55 }, // second: wider and quicker
    { t: 6.0, v: 0.55 },
    { t: 6.15, v: 0.05 },
    { t: 6.4, v: 0.05 },
    { t: 8.0, v: 1 }, // open
  ],
};

/** The value of a curve at `t`: held before the first point and after the last, eased between. */
export function sampleKeys(keys: readonly WakeKey[], t: number): number {
  const n = keys.length;
  if (n === 0) return 0;
  if (t <= keys[0].t) return keys[0].v;
  for (let i = 1; i < n; i++) {
    const b = keys[i];
    if (t < b.t) {
      const a = keys[i - 1];
      const span = b.t - a.t;
      const s = span > 0 ? (t - a.t) / span : 1;
      return a.v + (b.v - a.v) * (s * s * (3 - 2 * s));
    }
  }
  return keys[n - 1].v;
}

/** When the script has finished: the last point of either curve. */
export function wakeDuration(script: WakeScript): number {
  const last = (k: readonly WakeKey[]) => (k.length ? k[k.length - 1].t : 0);
  return Math.max(last(script.textKeys), last(script.lidKeys));
}

/** Plays a script forward with `dt`. Allocates nothing per update. */
export class WakeTimeline {
  private t = 0;
  private running = false;
  private thunderNow = false;
  private readonly duration: number;

  constructor(readonly script: WakeScript = WAKE_SCRIPT) {
    this.duration = wakeDuration(script);
  }

  /** Starts from the beginning (eyes shut, no word). */
  start(): void {
    this.t = 0;
    this.running = true;
    this.thunderNow = false;
  }

  /** Jumps to the end: eyes open, no word, no thunder. */
  finish(): void {
    this.t = this.duration;
    this.running = false;
    this.thunderNow = false;
  }

  /** Whether it is playing (started and not yet at its end). */
  get playing(): boolean {
    return this.running;
  }

  get time(): number {
    return this.t;
  }

  /** Moves on by `dt` seconds. Returns true on the update it finishes. */
  update(dt: number): boolean {
    this.thunderNow = false;
    if (!this.running) return false;
    const before = this.t;
    this.t += dt > 0 ? dt : 0;
    const at = this.script.thunderAt;
    if (at !== undefined && before <= at && this.t > at) this.thunderNow = true;
    if (this.t >= this.duration) {
      this.t = this.duration;
      this.running = false;
      return true;
    }
    return false;
  }

  /** How open the eyes are now (0..1); 1 when not playing. */
  get lid(): number {
    return this.running ? sampleKeys(this.script.lidKeys, this.t) : 1;
  }

  /** True on the one update the thunder in the dark should start. */
  get thunder(): boolean {
    return this.thunderNow;
  }

  /** How clearly the friend shows in the dark now (0..1); 0 when not playing. */
  get friend(): number {
    const keys = this.script.friendKeys;
    return this.running && keys ? sampleKeys(keys, this.t) : 0;
  }

  /** How visible the word is now (0..1); 0 when not playing. */
  get text(): number {
    return this.running ? sampleKeys(this.script.textKeys, this.t) : 0;
  }
}
