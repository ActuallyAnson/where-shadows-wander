// A cutscene is data: a list of beats on a timeline, each a caption or a shadow puppet moving across the wall.
// The player only keeps time and says what is showing; drawing it is the renderer's job. Plain TypeScript.
// Playing allocates nothing: `sample` fills a caller-owned array of pooled slots.

/** A line of text that fades in, holds and fades out. Positions are stage space, metres. */
export interface CaptionBeat {
  readonly kind: 'caption';
  readonly at: number;
  readonly duration: number;
  readonly text: string;
  /** Height on the wall, a fraction of the stage's height from its centre (+ is up); low on the wall when left out. */
  readonly y?: number;
}

/** A shadow puppet (the name of a drawing, e.g. 'bird') sliding from one point to another (metres on the real 1.6 m wall; a smaller stage scales them). */
export interface PuppetBeat {
  readonly kind: 'puppet';
  readonly at: number;
  readonly duration: number;
  readonly puppet: string;
  readonly from: readonly [number, number];
  readonly to: readonly [number, number];
}

export type Beat = CaptionBeat | PuppetBeat;

export interface CutsceneData {
  readonly id: string;
  readonly beats: readonly Beat[];
}

/** Docs/UI-STYLE.md: a cutscene is skippable and lasts under this many seconds. */
export const MAX_CUTSCENE_S = 20;
/** Seconds a caption or puppet takes to fade in and out. */
export const FADE_S = 0.6;

/** What one beat looks like right now. Reused between calls. */
export interface BeatState {
  beat: Beat | null;
  /** 0..1 opacity (fade in, hold, fade out). */
  alpha: number;
  /** Puppet position (unused for captions). */
  x: number;
  y: number;
}

export function makeBeatStates(n: number): BeatState[] {
  return Array.from({ length: n }, () => ({ beat: null, alpha: 0, x: 0, y: 0 }));
}

/** Problems with a cutscene's data, as readable strings; empty means it can be played. */
export function validateCutscene(c: CutsceneData): string[] {
  const problems: string[] = [];
  if (c.beats.length === 0) problems.push('no beats');
  let end = 0;
  c.beats.forEach((b, i) => {
    if (!(b.at >= 0)) problems.push(`beat ${i}: starts before 0`);
    if (!(b.duration > 0)) problems.push(`beat ${i}: duration must be above 0`);
    if (b.kind === 'caption' && b.text.trim() === '') problems.push(`beat ${i}: empty caption`);
    if (b.kind === 'puppet' && b.puppet === '') problems.push(`beat ${i}: no puppet name`);
    end = Math.max(end, b.at + b.duration);
  });
  if (end > MAX_CUTSCENE_S) problems.push(`lasts ${end}s, over the ${MAX_CUTSCENE_S}s limit`);
  return problems;
}

function fade(local: number, duration: number): number {
  const f = Math.min(FADE_S, duration / 2);
  if (local < f) return local / f;
  if (local > duration - f) return (duration - local) / f;
  return 1;
}

export class CutscenePlayer {
  private t = 0;
  private skipped = false;
  readonly length: number;

  constructor(private readonly data: CutsceneData) {
    let end = 0;
    for (const b of data.beats) end = Math.max(end, b.at + b.duration);
    this.length = end;
  }

  get time(): number {
    return this.t;
  }

  /** True once the timeline has run out or the player skipped it. */
  get done(): boolean {
    return this.skipped || this.t >= this.length;
  }

  update(dt: number): void {
    if (!this.done && dt > 0) this.t += dt;
  }

  /** The Skip button: the cutscene ends now. */
  skip(): void {
    this.skipped = true;
  }

  restart(): void {
    this.t = 0;
    this.skipped = false;
  }

  /** Fills `out` with the beats showing now, returns how many (beats beyond out.length are dropped). */
  sample(out: BeatState[]): number {
    if (this.done) return 0;
    let n = 0;
    for (const b of this.data.beats) {
      const local = this.t - b.at;
      if (local < 0 || local > b.duration || n >= out.length) continue;
      const s = out[n++];
      s.beat = b;
      s.alpha = fade(local, b.duration);
      if (b.kind === 'puppet') {
        const k = local / b.duration;
        s.x = b.from[0] + (b.to[0] - b.from[0]) * k;
        s.y = b.from[1] + (b.to[1] - b.from[1]) * k;
      } else {
        s.x = 0;
        s.y = 0;
      }
    }
    return n;
  }
}
