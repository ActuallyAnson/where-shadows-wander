// A recording made while following a ShapeScript: records each frame, keeps
// the current prompt up to date, and adds the script's labels at the end. The
// headset recorder, the Hand Lab and the webcam bench all use it.
// Plain TypeScript: no IWSDK, no three.js.
import type { HandFrame } from './hand';
import { addLabels, createRecording, recordFrame, type HandRecording } from './hand-recording';
import { createPrompt, type ShapeScript } from './shape-script';

export class GuidedRecording {
  readonly recording: HandRecording;
  /** The prompt for the latest frame; updated in place. */
  readonly prompt = createPrompt();
  private finished = false;

  constructor(
    readonly script: ShapeScript,
    note: string,
    userAgent: string,
    recordedAt: string,
  ) {
    this.recording = createRecording(note, userAgent, recordedAt);
  }

  get done(): boolean {
    return this.finished || this.prompt.index >= this.script.steps.length;
  }

  /**
   * Records a frame `t` seconds after the script started and updates `prompt`.
   * Returns false, without recording, once the script is over.
   */
  frame(t: number, left: HandFrame, right: HandFrame, head: [number, number, number] | null): boolean {
    this.script.promptAt(t, this.prompt);
    if (this.finished || t >= this.script.duration) return false;
    recordFrame(this.recording, t, left, right, head);
    return true;
  }

  /** Adds the labels (leaving out any past the last frame, if stopped early) and returns the recording. */
  finish(): HandRecording {
    if (!this.finished) addLabels(this.recording, this.script.labels());
    this.finished = true;
    return this.recording;
  }
}
