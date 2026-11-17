// The story's start, once the candle is lit: it waits for the player to look up at the wall (docs/STORY.md, "Waking"). Lighting
// the candle has the player looking down at it, so a story that started on a timer began unseen. While it waits, the candle's
// light on the wall swells and settles, slowly, to draw the eye up; once the eyes have rested on the wall long enough (in all,
// so a glance away holds the count rather than starting it again) the story starts. No timeout: like every scene, it waits.
// Pure: no three, no clock.
type V3 = Readonly<ArrayLike<number>>;

/** The wall, as StageFrame (and the shadow code's StagePlane) has it: its centre, unit right, up and normal (toward the player). */
interface Wall {
  readonly origin: V3;
  readonly right: V3;
  readonly up: V3;
  readonly normal: V3;
}

export interface LookToStartSettings {
  /** How long, in all, the eyes must rest on the wall before the story starts, seconds. */
  readonly lookS: number;
  /** How long after the candle is lit before the wall starts to call (the light spreading first), seconds. */
  readonly callAfterS: number;
  /** One swell and settle of the light on the wall, seconds. */
  readonly pulseS: number;
  /** How fast the call eases in and out, per second (0..1 of its full strength). */
  readonly easePerS: number;
}

export const LOOK_TO_START: LookToStartSettings = { lookS: 1.8, callAfterS: 2.5, pulseS: 2.6, easePerS: 0.8 };

/**
 * Whether the ray from `eye` along `dir` (need not be unit) meets `stage`'s plane from its front, within `halfW` by `halfH` of its
 * centre (metres, along its right and up).
 */
export function looksAtStage(stage: Wall, eye: V3, dir: V3, halfW: number, halfH: number): boolean {
  const n = stage.normal,
    o = stage.origin;
  const towards = -(dir[0] * n[0] + dir[1] * n[1] + dir[2] * n[2]);
  if (!(towards > 1e-6)) return false; // looking along the wall or away from it
  const ex = eye[0] - o[0],
    ey = eye[1] - o[1],
    ez = eye[2] - o[2];
  const front = ex * n[0] + ey * n[1] + ez * n[2];
  if (!(front > 0)) return false; // behind the wall
  const t = front / towards;
  const hx = ex + dir[0] * t,
    hy = ey + dir[1] * t,
    hz = ez + dir[2] * t;
  const r = stage.right,
    u = stage.up;
  const x = hx * r[0] + hy * r[1] + hz * r[2];
  const y = hx * u[0] + hy * u[1] + hz * u[2];
  return Math.abs(x) <= halfW && Math.abs(y) <= halfH;
}

export class LookToStart {
  /** True from start() until the eyes have rested on the wall long enough. */
  waiting = false;
  /** How much the wall's light is raised this frame, 0..1 of the pulse's top (0 when not calling). */
  pulse = 0;
  private looked = 0;
  private since = 0;
  private call = 0;
  private phase = 0;

  constructor(private readonly settings: LookToStartSettings = LOOK_TO_START) {}

  /** The candle is lit: wait for a look at the wall. */
  start(): void {
    this.waiting = true;
    this.looked = 0;
    this.since = 0;
    this.call = 0;
    this.phase = 0;
    this.pulse = 0;
  }

  /** Stops waiting, and the call stops at once (the story was started some other way, or the session ended). */
  cancel(): void {
    this.waiting = false;
    this.call = 0;
    this.pulse = 0;
  }

  /** Advances by `dt` with the eyes on the wall or not. Returns true on the update the story should start. */
  update(dt: number, looking: boolean): boolean {
    const s = this.settings;
    if (dt <= 0) return false;
    if (this.waiting) {
      this.since += dt;
      if (looking) this.looked += dt;
    }
    // The call grows while the player looks elsewhere, and fades while they look at the wall (and once the story has begun).
    const want = this.waiting && !looking && this.since >= s.callAfterS ? 1 : 0;
    this.call =
      want > this.call ? Math.min(want, this.call + dt * s.easePerS) : Math.max(want, this.call - dt * s.easePerS);
    if (this.call > 0) this.phase = (this.phase + dt / s.pulseS) % 1;
    else this.phase = 0;
    // A slow swell and settle: 0 at the start of each cycle, 1 at its middle.
    this.pulse = this.call * (0.5 - 0.5 * Math.cos(this.phase * Math.PI * 2));
    if (this.waiting && this.looked >= s.lookS) {
      this.waiting = false;
      return true;
    }
    return false;
  }
}
