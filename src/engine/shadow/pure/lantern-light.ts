// The lantern as a light: where it is, whether it is lit, how bright and what
// colour right now. The flicker only changes brightness and warmth; the position
// the shadows are projected from stays steady, so shadows and collision never
// shimmer. Teammate B's lantern flow sets `position` and `lit`; the stage view
// and the glow read the result.
// Plain TypeScript, no allocation.
import { flicker } from './lantern-flicker';

export interface FlickerSettings {
  /** 0..1: how much the lantern flickers. 0 is steady (accessibility); lower defaults suit reduced motion. */
  amplitude: number;
  /** Brightness swing at full amplitude: 0.08 is plus and minus 8 %. */
  intensityDepth: number;
  /** Colour swing toward red at full amplitude. */
  warmthDepth: number;
  /** Seconds for the flame to fade in or out when lit or put out. */
  fadeS: number;
}

export const DEFAULT_FLICKER_SETTINGS: Readonly<FlickerSettings> = {
  amplitude: 1,
  intensityDepth: 0.08,
  warmthDepth: 0.05,
  fadeS: 0.25,
};

/** About 2200 K amber, in linear RGB (GDD: warm amber light). */
const AMBER: readonly [number, number, number] = [1, 0.56, 0.24];
/** How much green and blue drop at full warmth. */
const WARM_SHIFT: readonly [number, number, number] = [0, 0.6, 0.9];

export interface LanternLight {
  readonly position: Float64Array;
  lit: boolean;
  /** 0 when out, about 1 (plus or minus the flicker) when lit. */
  intensity: number;
  /** Linear RGB, each 0..1. */
  readonly color: Float32Array;
  /** The raw flicker, -1..1 times the amplitude. */
  flicker: number;
}

export class LanternLightModel {
  readonly light: LanternLight = {
    position: new Float64Array(3),
    lit: false,
    intensity: 0,
    color: new Float32Array(AMBER),
    flicker: 0,
  };
  readonly settings: FlickerSettings;
  private level = 0;
  private lastT = NaN;

  constructor(
    settings: Partial<FlickerSettings> = {},
    private readonly seed = 1,
  ) {
    this.settings = { ...DEFAULT_FLICKER_SETTINGS, ...settings };
  }

  /**
   * @param t the caller's clock, seconds
   * @param position the flame's position (scene space), or null for no lantern
   * @param lit whether the flame is burning. It fades over `fadeS` each way, so don't toggle it faster than
   *   about twice a second: a flame flashing on and off is a flicker of its own.
   */
  update(t: number, position: ArrayLike<number> | null, lit: boolean): void {
    if (!Number.isFinite(t)) return; // a bad clock changes nothing, rather than poisoning the brightness for good
    const s = this.settings;
    const dt = Number.isNaN(this.lastT) ? 0 : Math.min(Math.max(t - this.lastT, 0), 0.1);
    this.lastT = t;
    const on = lit && position !== null;
    const step = dt / Math.max(s.fadeS, 1e-3);
    this.level = on ? Math.min(1, this.level + step) : Math.max(0, this.level - step);
    const l = this.light;
    l.lit = on;
    if (position) {
      l.position[0] = position[0];
      l.position[1] = position[1];
      l.position[2] = position[2];
    }
    const f = flicker(t, this.seed) * s.amplitude;
    l.flicker = f;
    l.intensity = this.level * (1 + f * s.intensityDepth);
    const warm = Math.max(0, -f) * s.warmthDepth; // a dip in brightness also reddens the flame
    for (let i = 0; i < 3; i++) l.color[i] = Math.min(1, Math.max(0, AMBER[i] * (1 - warm * WARM_SHIFT[i])));
  }
}
