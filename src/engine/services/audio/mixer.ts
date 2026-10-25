// The mixer's numbers: a master volume and three buses (music, effects, ambience), each with a volume and a
// mute. It only does arithmetic; the Web Audio engine reads `busGain` and applies it. Volumes are what a
// settings slider holds (0 to 1) and are turned into gain with a curve, so the middle of a slider is about
// half as loud to the ear, not half the signal. Plain TypeScript: no browser, no three.js.

export const Bus = { Music: 0, Effects: 1, Ambience: 2 } as const;
export type BusId = (typeof Bus)[keyof typeof Bus];
export const BUS_COUNT = 3;
export const BUS_NAMES = ['music', 'effects', 'ambience'] as const;

/** Slider position (0 to 1) to linear gain: a square-law taper, silent at 0 and unity at 1. */
export function volumeToGain(volume: number): number {
  const v = clamp01(volume);
  return v * v;
}

/** The most a bus can be lifted: a swell, not a jump scare. */
export const LIFT_MAX = 1.5;

export class Mixer {
  private readonly volumes = new Float64Array([0.7, 1, 0.6]);
  private readonly muted = new Uint8Array(BUS_COUNT);
  private masterVolume = 1;
  /** A momentary lift on a bus (the music swelling when a puzzle is solved): 1 is none. Never louder than LIFT_MAX. */
  private readonly lifts = new Float64Array([1, 1, 1]);
  private allMuted = false;
  /** Bumped on every change, so the engine only touches Web Audio when something moved. */
  version = 0;

  get master(): number {
    return this.masterVolume;
  }

  setMaster(volume: number): void {
    this.masterVolume = clamp01(volume);
    this.version++;
  }

  volume(bus: BusId): number {
    return this.volumes[bus];
  }

  setVolume(bus: BusId, volume: number): void {
    this.volumes[bus] = clamp01(volume);
    this.version++;
  }

  /** Lifts a bus by `factor` (1 to LIFT_MAX) on top of its volume. Only a change counts, so it is cheap to call every frame. */
  setLift(bus: BusId, factor: number): void {
    const f = factor >= LIFT_MAX ? LIFT_MAX : factor > 1 ? factor : 1;
    if (Math.abs(f - this.lifts[bus]) < 0.01) return;
    this.lifts[bus] = f;
    this.version++;
  }

  setMuted(bus: BusId, muted: boolean): void {
    this.muted[bus] = muted ? 1 : 0;
    this.version++;
  }

  /** Mutes or unmutes everything (an accessibility switch, or the game being paused). */
  setAllMuted(muted: boolean): void {
    this.allMuted = muted;
    this.version++;
  }

  isMuted(bus: BusId): boolean {
    return this.allMuted || this.muted[bus] === 1;
  }

  /** The linear gain for a bus's node: master and bus volumes through the curve, or 0 if muted. */
  busGain(bus: BusId): number {
    return this.isMuted(bus) ? 0 : volumeToGain(this.masterVolume) * volumeToGain(this.volumes[bus]) * this.lifts[bus];
  }
}

function clamp01(v: number): number {
  return v >= 1 ? 1 : v > 0 ? v : 0; // NaN becomes 0
}
