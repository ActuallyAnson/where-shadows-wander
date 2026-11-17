// The quality governor: watches how long frames take and, when they keep running over what the display allows, switches off the
// decoration a step at a time (the rings round a shape, then the paper's painted scenery), then brings it back a step at a time once the frames are comfortably inside budget again. A headset that
// misses frames makes the wearer sick and hot, so the game keeps its frame rate first and its decoration second.
//
// It decides from a window of recent frames, not one: a single slow frame (a texture upload, the system menu) changes nothing. It
// has hysteresis (shedding is quick, restoring slow, and each change waits out a cool-down) so the quality cannot flicker up and
// down. Plain TypeScript, no allocation after construction, driven by plain numbers, so a test can run a whole session in a loop.

/** The things the governor can switch off, from the first to go to the last. */
export const EFFECTS = ['ring', 'backdrop'] as const;
export type Effect = (typeof EFFECTS)[number];

/** The level at which each effect is off (it is on below that level). Level 0 has everything; the top level has none of these. */
export const SHED_AT: Readonly<Record<Effect, number>> = {
  ring: 1,
  backdrop: 2,
};
export const MAX_LEVEL = 2;

export interface GovernorSettings {
  /** The frame time the display allows, milliseconds (13.9 at 72 Hz). */
  budgetMs: number;
  /** A frame is "over" when it takes more than this many budgets. */
  overFactor: number;
  /** Frames in the window the decision is made from. */
  windowFrames: number;
  /** Shed a step when this share of the window is over. */
  shedFraction: number;
  /** Restore a step when no more than this share is over for `restoreAfterFrames` in a row. */
  restoreFraction: number;
  restoreAfterFrames: number;
  /** Frames to wait after a change before another. */
  cooldownFrames: number;
  /** A frame longer than this (ms) is a pause (the headset off, a menu), not slowness, and is ignored. */
  pauseMs: number;
}

export const DEFAULT_GOVERNOR: Readonly<GovernorSettings> = {
  budgetMs: 1000 / 72,
  overFactor: 1.25,
  windowFrames: 90,
  shedFraction: 0.3,
  restoreFraction: 0.02,
  restoreAfterFrames: 900,
  cooldownFrames: 90,
  pauseMs: 250,
};

export class QualityGovernor {
  readonly settings: GovernorSettings;
  /** How much is switched off now: 0 everything on .. MAX_LEVEL. */
  level = 0;
  private readonly over: Uint8Array;
  private head = 0;
  private filled = 0;
  private overCount = 0;
  private calm = 0;
  private cooldown = 0;

  constructor(settings: Partial<GovernorSettings> = {}) {
    this.settings = { ...DEFAULT_GOVERNOR, ...settings };
    this.over = new Uint8Array(this.settings.windowFrames);
  }

  /** Whether an effect is on at the current level. */
  isOn(effect: Effect): boolean {
    return this.level < SHED_AT[effect];
  }

  /** Sets the frame time the display allows from its refresh rate (Hz). */
  setRefreshRate(hz: number): void {
    if (hz > 20 && hz < 400) this.settings.budgetMs = 1000 / hz;
  }

  /** Forgets the recent frames and puts everything back (a new session, a restart). */
  reset(): void {
    this.level = 0;
    this.over.fill(0);
    this.head = 0;
    this.filled = 0;
    this.overCount = 0;
    this.calm = 0;
    this.cooldown = 0;
  }

  /** Takes one frame's time in milliseconds. Returns the level (it changes only now and then). */
  update(frameMs: number): number {
    const s = this.settings;
    if (!(frameMs > 0) || frameMs > s.pauseMs) return this.level; // not a number, or a pause
    const isOver = frameMs > s.budgetMs * s.overFactor ? 1 : 0;
    this.overCount += isOver - this.over[this.head];
    this.over[this.head] = isOver;
    this.head = (this.head + 1) % s.windowFrames;
    if (this.filled < s.windowFrames) this.filled++;
    if (this.cooldown > 0) this.cooldown--;
    if (this.filled < s.windowFrames) return this.level; // not enough frames to judge yet
    const share = this.overCount / s.windowFrames;
    if (share >= s.shedFraction) {
      this.calm = 0;
      if (this.level < MAX_LEVEL && this.cooldown === 0) this.change(1);
    } else if (share <= s.restoreFraction) {
      this.calm++;
      if (this.level > 0 && this.calm >= s.restoreAfterFrames && this.cooldown === 0) this.change(-1);
    } else this.calm = 0;
    return this.level;
  }

  private change(step: number): void {
    this.level += step;
    this.cooldown = this.settings.cooldownFrames;
    this.calm = 0;
    // The window starts again, so the new level is judged on its own frames, not the old level's.
    this.over.fill(0);
    this.overCount = 0;
    this.filled = 0;
    this.head = 0;
  }
}
