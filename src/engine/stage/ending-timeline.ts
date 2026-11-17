// Scene 7's end (docs/STORY.md, "Sleep"), after the player has covered the flame: the candle goes out slowly, the way it caught
// in the opening but backwards (the flame shrinks, its light draws in and the moon dims), then the boy's eyes close in a few
// heavy blinks, the credits roll over the black, "thank you for playing", and the session ends (back to the title page).
// This is the timing only, as numbers at a time `t`; main.ts applies them to the candle, the lids (wake-view.ts), the sound and
// the credits (credits-view.ts). Pure: no three, no clock.
import { sampleKeys, type WakeKey } from './wake-timeline';

export interface EndingScript {
  /** How much of the candle's light is left (1 as it was covered .. 0 out). The flame shrinks with it. */
  readonly candleKeys: readonly WakeKey[];
  /** When the flame hisses as it gutters under his hand, seconds. */
  readonly snuffAt: number;
  /** When the flame is gone (the candle is out, its sound stops), seconds. */
  readonly outAt: number;
  /** The moon's light, as a multiple of its night level (1); it dims as he falls asleep, as it rose when the candle caught. */
  readonly moonKeys: readonly WakeKey[];
  /** How open the eyes are (1 open .. 0 shut): heavy blinks, each slower, until they stay shut. */
  readonly lidKeys: readonly WakeKey[];
  /** When he yawns, seconds: as his eyes come back open after the first heavy blink. */
  readonly yawnAt: number;
  /** When he breathes in and out once, slowly, as his eyes close for the last time, seconds. */
  readonly breathAt: number;
  /** The rain's level (1 as it was .. 0 silent): it eases as he sleeps. */
  readonly rainKeys: readonly WakeKey[];
  /** The music bus level (1 as it was .. 0 silent): main track fades out with the candle, then credits BGM plays under the credits. */
  readonly musicKeys: readonly WakeKey[];
  /** When the credits start to roll, and how long they take to pass, seconds. */
  readonly creditsAt: number;
  readonly creditsS: number;
  /** How visible "thank you for playing" is (0..1). */
  readonly thanksKeys: readonly WakeKey[];
  /** When it is all over and the session ends, seconds. */
  readonly endAt: number;
}

/** Seconds and levels of the end. Tune here. */
export const ENDING_SCRIPT: EndingScript = {
  // The light goes slowly: a little quicker at first as the flame gutters, then a long tail to nothing.
  candleKeys: [
    { t: 0, v: 1 },
    { t: 1.8, v: 0.6 },
    { t: 6.5, v: 0 },
  ],
  // The flame hisses as it gutters, just after his hand covers it.
  snuffAt: 0.2,
  outAt: 6.5,
  // The opening's moon rises from 0.35 to 1 as the candle catches; here it sinks most of the way back, so the room is still
  // there, dim and blue, for the blinks.
  moonKeys: [
    { t: 0, v: 1 },
    { t: 7.5, v: 0.5 },
  ],
  // A moment in the dark room after the flame is gone, then the eyes get heavy: they close and open less each time, slower.
  lidKeys: [
    { t: 0, v: 1 },
    { t: 8.5, v: 1 },
    { t: 9.4, v: 0.08 }, // first: nearly shut, slowly
    { t: 9.8, v: 0.08 },
    { t: 10.8, v: 0.7 }, // open again, not all the way
    { t: 12.0, v: 0.7 },
    { t: 13.2, v: 0.03 }, // second: heavier
    { t: 14.0, v: 0.03 },
    { t: 15.2, v: 0.35 }, // a last look
    { t: 15.9, v: 0.35 },
    { t: 17.6, v: 0 }, // asleep
  ],
  yawnAt: 10.2,
  // One slow breath in and out (about 7 s) from the second heavy blink into the black, before the music comes back.
  breathAt: 13.4,
  rainKeys: [
    { t: 0, v: 1 },
    { t: 9, v: 0.45 },
    { t: 19, v: 0.3 },
    { t: 56, v: 0 },
  ],
  musicKeys: [
    { t: 0, v: 1 },
    { t: 6.5, v: 0 },
    { t: 19.5, v: 0 },
    { t: 23, v: 0.7 },
    { t: 52.5, v: 0.7 },
    { t: 56, v: 0 },
  ],
  creditsAt: 19.5,
  creditsS: 26,
  thanksKeys: [
    { t: 0, v: 0 },
    { t: 45, v: 0 },
    { t: 47, v: 1 },
    { t: 52, v: 1 },
    { t: 54.5, v: 0 },
  ],
  endAt: 56.5,
};

/** Plays the end forward with `dt`. Allocates nothing per update. */
export class EndingTimeline {
  private t = 0;
  private running = false;
  private outNow = false;
  private yawnNow = false;
  private snuffNow = false;
  private breathNow = false;
  private creditsNow = false;
  private doneNow = false;

  constructor(readonly script: EndingScript = ENDING_SCRIPT) {}

  /** Starts from the moment the flame was covered. */
  start(): void {
    this.t = 0;
    this.running = true;
    this.outNow = this.yawnNow = this.creditsNow = this.doneNow = this.snuffNow = this.breathNow = false;
  }

  /** Stops it where it is (a jump back into the story, or the session ending). */
  stop(): void {
    this.running = false;
    this.outNow = this.yawnNow = this.creditsNow = this.doneNow = this.snuffNow = this.breathNow = false;
  }

  /** Whether it is playing (started and not yet over). */
  get active(): boolean {
    return this.running;
  }

  get time(): number {
    return this.t;
  }

  /** Moves on by `dt` seconds. */
  update(dt: number): void {
    this.outNow = this.yawnNow = this.creditsNow = this.doneNow = this.snuffNow = this.breathNow = false;
    if (!this.running) return;
    const before = this.t;
    this.t += dt > 0 ? dt : 0;
    const s = this.script;
    if (before <= s.outAt && this.t > s.outAt) this.outNow = true;
    if (before <= s.yawnAt && this.t > s.yawnAt) this.yawnNow = true;
    if (before <= s.snuffAt && this.t > s.snuffAt) this.snuffNow = true;
    if (before <= s.breathAt && this.t > s.breathAt) this.breathNow = true;
    if (before <= s.creditsAt && this.t > s.creditsAt) this.creditsNow = true;
    if (this.t >= s.endAt) {
      this.t = s.endAt;
      this.running = false;
      this.doneNow = true;
    }
  }

  /** How much of the candle's light is left now (1 .. 0). */
  get candle(): number {
    return sampleKeys(this.script.candleKeys, this.t);
  }

  /** True on the one update the flame goes out. */
  get out(): boolean {
    return this.outNow;
  }

  /** True on the one update he yawns. */
  get yawn(): boolean {
    return this.yawnNow;
  }

  /** True on the one update the flame hisses as it gutters. */
  get snuff(): boolean {
    return this.snuffNow;
  }

  /** True on the one update he takes his slow breath. */
  get breath(): boolean {
    return this.breathNow;
  }

  /** The moon's light now, as a multiple of its night level. */
  get moon(): number {
    return sampleKeys(this.script.moonKeys, this.t);
  }

  /** How open the eyes are now (0..1). */
  get lid(): number {
    return sampleKeys(this.script.lidKeys, this.t);
  }

  get rain(): number {
    return sampleKeys(this.script.rainKeys, this.t);
  }

  get music(): number {
    return sampleKeys(this.script.musicKeys, this.t);
  }

  /** True on the one update the credits start (place them in front of the eyes then). */
  get creditsStart(): boolean {
    return this.creditsNow;
  }

  /** How far the credits have rolled (0 not yet .. 1 gone past). */
  get credits(): number {
    const s = this.script;
    const r = (this.t - s.creditsAt) / s.creditsS;
    return r <= 0 ? 0 : r >= 1 ? 1 : r;
  }

  /** Whether the credits melodic BGM (Sound.Credits) should play in place of the main track. */
  get creditsMusic(): boolean {
    return this.running && this.t >= this.script.creditsAt;
  }

  /** Whether the credits are on the wall of black now. */
  get creditsShowing(): boolean {
    const s = this.script;
    return this.t > s.creditsAt && this.t < s.creditsAt + s.creditsS;
  }

  /** How visible "thank you for playing" is now (0..1). */
  get thanks(): number {
    return sampleKeys(this.script.thanksKeys, this.t);
  }

  /** True on the one update it is all over: end the session. */
  get done(): boolean {
    return this.doneNow;
  }
}
