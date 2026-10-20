// Replays a recorded hand session into the game in place of the real hands, in a headset or at a desk. The driver in
// main.ts asks `active`, and when it is true calls `fill` where it would have read the hands. The recording's own clock
// runs from the moment it starts (and loops), so the same recording gives the same hands every time.
import type { HandFrame } from '../engine/hands/hand';
import { parseRecording } from '../engine/hands/hand-recording';
import { ReplaySource } from '../input-mock/replay-source';

/** The demo recording, relative to the page. It only exists on the dev server (recordings/ is not in the repository or a build). */
export const DEMO_RECORDING = 'recordings/emulator-demo.handrec.json';

export class HandReplay {
  private source: ReplaySource | null = null;
  private t = 0;
  /** What is playing, for the HUD ("" when nothing is). */
  name = '';

  get active(): boolean {
    return this.source !== null;
  }

  /** Seconds into the recording. */
  get time(): number {
    return this.t;
  }

  /** Starts replaying an already-parsed recording (a file dropped on the page, say). */
  load(recording: unknown, name = 'recording'): void {
    this.source = new ReplaySource(parseRecording(recording), true, name);
    this.name = name;
    this.t = 0;
  }

  /** Fetches and starts a recording. Throws with the HTTP status or the parse problem. */
  async start(url: string = DEMO_RECORDING): Promise<boolean> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`could not load ${url}: HTTP ${res.status}`);
    this.load(await res.json(), url.split('/').pop() ?? url);
    return true;
  }

  stop(): void {
    this.source = null;
    this.name = '';
    this.t = 0;
  }

  /** Writes the recording's hands for `dt` seconds later into both frames. No allocation. */
  fill(dt: number, left: HandFrame, right: HandFrame): void {
    if (!this.source) return;
    this.t += dt;
    this.source.update(this.t, left, right);
  }
}
