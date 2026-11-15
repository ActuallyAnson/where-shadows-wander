// The house at night, between the memories: now and then the floor creaks somewhere in the room, or a gust leans on the window.
// Sparse, small and never close, like the far thunder: they keep the real room alive while the wall waits, and say nothing.
// This is when, as numbers: the clock runs only while they are allowed (scene 1 and the waits between memories, not while a
// memory plays), and `fired` names the sound on the one update it should start. Seeded, so a run repeats. Pure: no three, no
// clock.

export type NightSoundKind = 'creak' | 'gust';

export interface NightSoundSettings {
  /** Seconds of allowed time before the first. */
  readonly firstS: number;
  /** Seconds of allowed time between one and the next, at least and at most. */
  readonly gapMinS: number;
  readonly gapMaxS: number;
  /** How likely each one is a gust on the window rather than a creak (0..1). */
  readonly gustChance: number;
}

export const NIGHT_SOUNDS: NightSoundSettings = {
  firstS: 22,
  gapMinS: 26,
  gapMaxS: 55,
  gustChance: 0.4,
};

/** Plays the house's night sounds forward with `dt`. Allocates nothing per update. */
export class NightSounds {
  private t = 0;
  private next: number;
  private seed: number;
  private now: NightSoundKind | null = null;

  constructor(
    seed = 1,
    readonly settings: NightSoundSettings = NIGHT_SOUNDS,
  ) {
    this.seed = seed >>> 0 || 1;
    this.next = settings.firstS;
  }

  /** Moves on by `dt` seconds while `allowed` (a memory playing, the title or the pause: pass false, and the clock holds). */
  update(dt: number, allowed: boolean): void {
    this.now = null;
    if (!allowed || !(dt > 0)) return;
    this.t += Math.min(dt, 1);
    if (this.t < this.next) return;
    const s = this.settings;
    this.now = this.random() < s.gustChance ? 'gust' : 'creak';
    this.next = this.t + s.gapMinS + (s.gapMaxS - s.gapMinS) * this.random();
  }

  /** The sound to start on this update, or null. */
  get fired(): NightSoundKind | null {
    return this.now;
  }

  private random(): number {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }
}
