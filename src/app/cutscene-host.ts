// Plays one cutscene at a time: checks its data, keeps the clock, watches for the Skip poke and tells the view what to
// show. The game's flow calls play() and learns it ended from onDone. Plain TypeScript apart from the view it is given.
import { CutscenePlayer, validateCutscene, type Beat, type CutsceneData } from '../engine/sim/cutscene';
import { SkipTouch } from '../engine/shadow/pure/skip-touch';
import type { StagePlane } from '../engine/shadow/pure/stage-plane';

/** What the host needs of the drawing side (CutsceneView fits). */
export interface CutsceneDrawing {
  load(beats: readonly Beat[]): void;
  hide(): void;
  update(player: CutscenePlayer, stage: StagePlane, opacity: number, skipProgress?: number): void;
}

export class CutsceneHost {
  private player: CutscenePlayer | null = null;
  private onDone: (() => void) | null = null;
  private readonly skip = new SkipTouch();

  constructor(private readonly view: CutsceneDrawing) {}

  get playing(): boolean {
    return this.player !== null;
  }

  /** Starts a cutscene. Returns the problems with its data (and plays nothing) if it is not playable. */
  play(data: CutsceneData, onDone?: () => void): string[] {
    const problems = validateCutscene(data);
    if (problems.length > 0) return problems;
    this.stop(false);
    this.view.load(data.beats);
    this.player = new CutscenePlayer(data);
    this.onDone = onDone ?? null;
    return [];
  }

  /** Ends the cutscene now (the Skip poke does this too). */
  stop(callDone = true): void {
    const done = this.onDone;
    this.player = null;
    this.onDone = null;
    this.view.hide();
    if (callDone) done?.();
  }

  /** Once per frame. `tips` is n fingertips as xyz triples (scene space); `opacity` is the shadows' current opacity. */
  update(dt: number, stage: StagePlane, tips: ArrayLike<number>, n: number, opacity: number): void {
    const p = this.player;
    if (!p) return;
    p.update(dt);
    if (p.done || this.skip.update(dt, tips, n, stage)) {
      this.stop();
      return;
    }
    this.view.update(p, stage, opacity, this.skip.progress);
  }
}
