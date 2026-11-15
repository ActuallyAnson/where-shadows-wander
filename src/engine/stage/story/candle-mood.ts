// The candle's mood: the colour of its light on the room and the tint of its pool on the wall. The story opens rainy and gloomy
// (a cold, blue-grey light), and a scene can name a mood of its own (StoryScene.candle) for the light to ease into, so the
// candle's colour can mark the story's moments. The candle itself follows too: its flame and the light on its wax are tinted
// by `flame`, the mood's light compared with `warm` (a candle's own colour), so a blue night gives a cold, bluish flame.
// Plain TypeScript: main.ts copies `light` into CandleLight's colour, `wall` into the wall's tint and `flame` into
// CandleView's tint each frame.

type RGB = readonly [number, number, number];

export interface CandleMood {
  /** The colour of the candle's light on the room's surfaces (linear RGB, about 0..1). */
  readonly light: RGB;
  /** The tint of the candle's pool of light on the wall (about 1 is neutral). */
  readonly wall: RGB;
}

export const CANDLE_MOODS = {
  /** A rainy, gloomy night: the candle's light thin and blue-grey. The story's start. */
  rainy: { light: [0.5, 0.78, 2.0], wall: [0.66, 0.86, 1.4] },
  /** A candle's own warm amber light (the room as it was before the moods). */
  warm: { light: [1.0, 0.82, 0.6], wall: [0.91, 0.92, 0.94] },
  /** A summer dusk: gold and a little lower (the park as the sky goes, the hill of fireflies). */
  dusk: { light: [1.05, 0.66, 0.38], wall: [1.0, 0.86, 0.72] },
  /** A pale autumn morning (the school gate). */
  morning: { light: [0.86, 0.88, 0.95], wall: [0.94, 0.95, 1.0] },
  /** The candle burned low, the night cooling again: dimmer and blue (the hill with one boy, the goodbye). */
  low: { light: [0.42, 0.5, 0.95], wall: [0.62, 0.72, 1.0] },
  /** The last of the candle: a small warm ember of light (sleep). */
  ember: { light: [0.5, 0.34, 0.24], wall: [0.72, 0.66, 0.66] },
} as const satisfies Record<string, CandleMood>;

export type CandleMoodName = keyof typeof CANDLE_MOODS;

/** The mood whose light is a candle's own: the flame is untinted in it. */
const FLAME_NEUTRAL = CANDLE_MOODS.warm.light;

/** The mood the story opens in. */
export const START_MOOD: CandleMoodName = 'rainy';
/** Seconds a change of mood takes, unless a scene says otherwise. */
export const MOOD_EASE_S = 4;

/** The candle's mood now, easing from one to the next. Allocates nothing per frame. */
export class CandleMoodBlend {
  readonly light = new Float64Array(3);
  readonly wall = new Float64Array(3);
  /** The tint on the candle's own flame and wax: `light` over the `warm` mood's (1, 1, 1 in `warm`). */
  readonly flame = new Float64Array(3);
  /** The mood it is going to (or is at). */
  mood: CandleMoodName;
  private readonly fromLight = new Float64Array(3);
  private readonly fromWall = new Float64Array(3);
  private t = 1;
  private duration = 0;

  constructor(mood: CandleMoodName = START_MOOD) {
    this.mood = mood;
    this.snap(mood);
  }

  /** Jumps straight to `mood`. */
  snap(mood: CandleMoodName): void {
    this.mood = mood;
    const m = CANDLE_MOODS[mood];
    for (let i = 0; i < 3; i++) {
      this.light[i] = m.light[i];
      this.wall[i] = m.wall[i];
      this.flame[i] = m.light[i] / FLAME_NEUTRAL[i];
    }
    this.t = 1;
  }

  /** Eases to `mood` over `seconds` from wherever it is now (nothing if it is already going there). */
  to(mood: CandleMoodName, seconds = MOOD_EASE_S): void {
    if (mood === this.mood) return;
    if (!(seconds > 0)) return this.snap(mood);
    this.mood = mood;
    this.fromLight.set(this.light);
    this.fromWall.set(this.wall);
    this.t = 0;
    this.duration = seconds;
  }

  update(dt: number): void {
    if (this.t >= 1 || !(dt > 0)) return;
    this.t = Math.min(1, this.t + dt / this.duration);
    if (this.t >= 1) return this.snap(this.mood);
    const k = this.t * this.t * (3 - 2 * this.t);
    const m = CANDLE_MOODS[this.mood];
    for (let i = 0; i < 3; i++) {
      this.light[i] = this.fromLight[i] + (m.light[i] - this.fromLight[i]) * k;
      this.wall[i] = this.fromWall[i] + (m.wall[i] - this.fromWall[i]) * k;
      this.flame[i] = this.light[i] / FLAME_NEUTRAL[i];
    }
  }
}
