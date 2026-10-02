// Plays a .handrec.json back in mock mode (?mock=1&src=replay&file=...). The
// frame shown is chosen by mock time, so a replay is identical every run.
import type { HandFrame } from '../engine/hands/hand';
import { parseRecording, replayInto, type HandRecording } from '../engine/hands/hand-recording';
import type { HandSource } from './hand-source';

export class ReplaySource implements HandSource {
  readonly name: string;
  readonly duration: number;

  constructor(
    readonly recording: HandRecording,
    private readonly loop = true,
    name = 'replay',
  ) {
    this.name = name;
    this.duration = recording.frames[recording.frames.length - 1].t;
  }

  /** Index of the last frame at or before `t`. */
  frameAt(t: number): number {
    const frames = this.recording.frames;
    const local = this.loop && this.duration > 0 ? t % this.duration : Math.min(t, this.duration);
    let lo = 0,
      hi = frames.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (frames[mid].t <= local) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  }

  update(t: number, left: HandFrame, right: HandFrame): void {
    const frame = this.recording.frames[this.frameAt(t)];
    replayInto(frame, 'left', left);
    replayInto(frame, 'right', right);
  }
}

/** Fetches and checks a recording, e.g. `recordings/emulator-demo.handrec.json` on the dev server. */
export async function loadReplay(url: string): Promise<ReplaySource> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Couldn't load ${url}: HTTP ${res.status}`);
  return new ReplaySource(parseRecording(await res.json()), true, `replay: ${url.split('/').pop()}`);
}

/** Reads a recording dropped onto the page. */
export async function replayFromFile(file: File): Promise<ReplaySource> {
  return new ReplaySource(parseRecording(JSON.parse(await file.text())), true, `replay: ${file.name}`);
}
