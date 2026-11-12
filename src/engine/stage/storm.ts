// The rain outside the window is a slow, far storm: now and then the sky flickers pale, and a few seconds later thunder rolls
// in, muffled by the distance and the walls. This is when, as numbers: how bright the flash is at the moment, and the update on
// which the thunder should start. The room view brightens the window by `flash`; the audio plays the thunder. Never close, never
// loud: it should feel like being safe inside on a wet night, not like danger. Seeded, so a run repeats. Pure: no three, no clock.
import { sampleKeys, type WakeKey } from './wake-timeline';

export interface StormSettings {
  /** Seconds from the start to the first strike. */
  readonly firstS: number;
  /** Seconds between one strike and the next, at least and at most. */
  readonly gapMinS: number;
  readonly gapMaxS: number;
  /** Seconds from a flash to its thunder (a far storm: the sound takes a while), at least and at most. */
  readonly delayMinS: number;
  readonly delayMaxS: number;
  /** The faintest and the brightest a flash may be (0..1). */
  readonly flashMin: number;
  readonly flashMax: number;
}

export const STORM: StormSettings = {
  firstS: 14,
  gapMinS: 28,
  gapMaxS: 60,
  delayMinS: 1.8,
  delayMaxS: 4.5,
  flashMin: 0.35,
  flashMax: 1,
};

/** One flash, at full strength: a quick flicker, a second one, then a fade. Seconds from the strike. */
const FLICKER: readonly WakeKey[] = [
  { t: 0, v: 0 },
  { t: 0.05, v: 1 },
  { t: 0.13, v: 0.25 },
  { t: 0.2, v: 0.7 },
  { t: 0.75, v: 0 },
];
const FLICKER_S = FLICKER[FLICKER.length - 1].t;

/** Plays the storm forward with `dt`. Allocates nothing per update. */
export class Storm {
  private t = 0;
  private nextStrike: number;
  /** When the last strike was, and how strong it was; -Infinity before the first. */
  private strikeAt = -Infinity;
  private strength = 0;
  /** When the waiting thunder is due; Infinity when none is. */
  private thunderAt = Infinity;
  private thunderFired = false;
  private seed: number;

  constructor(
    seed = 1,
    readonly settings: StormSettings = STORM,
  ) {
    this.seed = seed >>> 0 || 1;
    this.nextStrike = settings.firstS;
  }

  /** Moves on by `dt` seconds (paused: pass 0). */
  update(dt: number): void {
    this.thunderFired = false;
    if (!(dt > 0)) return;
    this.t += Math.min(dt, 1);
    const s = this.settings;
    if (this.t >= this.nextStrike) {
      // Timed from when it was due, not from this frame, so a frame's length does not shift the flash.
      this.strikeAt = this.nextStrike;
      this.strength = s.flashMin + (s.flashMax - s.flashMin) * this.random();
      this.thunderAt = this.strikeAt + s.delayMinS + (s.delayMaxS - s.delayMinS) * this.random();
      this.nextStrike = Math.max(this.t, this.strikeAt + s.gapMinS + (s.gapMaxS - s.gapMinS) * this.random());
    }
    if (this.t >= this.thunderAt) {
      this.thunderAt = Infinity;
      this.thunderFired = true;
    }
  }

  /** Makes the next update strike (for trying it out); the strikes after it keep their usual gaps. */
  strikeNow(): void {
    this.nextStrike = this.t;
  }

  /** How bright the window's flash is now (0..1). */
  get flash(): number {
    const since = this.t - this.strikeAt;
    if (!(since >= 0) || since > FLICKER_S) return 0;
    return sampleKeys(FLICKER, since) * this.strength;
  }

  /** True on the one update the thunder should start. */
  get thunder(): boolean {
    return this.thunderFired;
  }

  /** How strong the last strike was (0..1): the thunder can follow it in loudness. */
  get lastStrength(): number {
    return this.strength;
  }

  private random(): number {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }
}
