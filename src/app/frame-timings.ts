// Per-frame cost of our own stages, for the diagnostics report. Fixed slots in
// typed arrays, so timing a frame allocates nothing; the report keeps the last
// full window's average and worst frame per slot. Browsers coarsen
// performance.now() on pages without cross-origin isolation (GitHub Pages), so
// read single frames as rough and the averages as the number to trust.

export const SLOT = {
  read: 0,
  classify: 1,
  gestures: 2,
  shadow: 3,
  handVisual: 4,
  audio: 5,
  lab: 6,
  total: 7,
} as const;
const NAMES = Object.keys(SLOT) as (keyof typeof SLOT)[];
const COUNT = NAMES.length;

export class FrameTimings {
  /** Frames in a window; the report shows the last full one. */
  readonly window: number;
  private readonly started = new Float64Array(COUNT);
  private readonly sum = new Float64Array(COUNT);
  private readonly hits = new Float64Array(COUNT);
  private readonly worst = new Float64Array(COUNT);
  private readonly lastAvg = new Float64Array(COUNT);
  private readonly lastWorst = new Float64Array(COUNT);
  private readonly lastHits = new Float64Array(COUNT);
  /** The last full window in one short line ("3.1 ms avg, 6.2 worst · shadow 1.2"), for a tester's on-screen readout. Empty until the first window ends. */
  line = '';
  private frames = 0;
  private lastFrames = 0;

  constructor(
    private readonly now: () => number = () => performance.now(),
    window = 300,
  ) {
    this.window = window;
  }

  begin(slot: number): void {
    this.started[slot] = this.now();
  }

  end(slot: number): void {
    const ms = this.now() - this.started[slot];
    this.sum[slot] += ms;
    this.hits[slot]++;
    if (ms > this.worst[slot]) this.worst[slot] = ms;
  }

  /** Call once per frame, after every slot has been timed. */
  endFrame(): void {
    if (++this.frames < this.window) return;
    for (let i = 0; i < COUNT; i++) {
      // Averaged over the frames the slot ran in, so a stage that only runs sometimes (the shadow, once the rig
      // is placed) isn't diluted by the frames it skipped.
      this.lastAvg[i] = this.hits[i] ? this.sum[i] / this.hits[i] : 0;
      this.lastWorst[i] = this.worst[i];
      this.lastHits[i] = this.hits[i];
    }
    this.lastFrames = this.frames;
    const f = (v: number) => (Math.round(v * 10) / 10).toFixed(1);
    this.line = `${f(this.lastAvg[SLOT.total])} ms avg, ${f(this.lastWorst[SLOT.total])} worst · shadow ${f(this.lastAvg[SLOT.shadow])}`;
    this.frames = 0;
    this.sum.fill(0);
    this.hits.fill(0);
    this.worst.fill(0);
  }

  /** Milliseconds per slot over the last full window (per frame the slot ran in; `frameShare` is the fraction of frames that was), rounded to microseconds. Allocates: call at report time only. */
  toJSON(): {
    frames: number;
    msAvg: Record<string, number>;
    msWorst: Record<string, number>;
    frameShare: Record<string, number>;
  } {
    const round = (v: number) => Math.round(v * 1000) / 1000;
    const msAvg: Record<string, number> = {};
    const msWorst: Record<string, number> = {};
    const frameShare: Record<string, number> = {};
    for (let i = 0; i < COUNT; i++) {
      msAvg[NAMES[i]] = round(this.lastAvg[i]);
      msWorst[NAMES[i]] = round(this.lastWorst[i]);
      frameShare[NAMES[i]] = this.lastFrames ? round(this.lastHits[i] / this.lastFrames) : 0;
    }
    return { frames: this.lastFrames, msAvg, msWorst, frameShare };
  }
}
