// Records hand joints during an XR session for offline replay. Armed with the
// developer overlay's Record buttons (or the `record` testing switch, when the session starts). Recording starts when the first hand is
// tracked and stops after 20 s or when the session ends. The page then shows a
// "Download recording" button (DOM isn't visible inside XR).
//
// The guided shapes choice is a guided recording instead: the wearer is prompted
// through every shape (PromptPanel), the recording lasts as long as the script,
// and the file carries shape labels (src/engine/hands/shape-script.ts).
import { GuidedRecording } from '../hands/guided-recording';
import type { HandFrame } from '../hands/hand';
import { createRecording, recordFrame, type HandRecording } from '../hands/hand-recording';
import { SHAPES_SCRIPT, ShapeScript, type Prompt, type ScriptStep } from '../hands/shape-script';
import { downloadJson, postRecording, recordingFileName } from './save-recording';

/** The guided recording scripts, by name. */
export const SCRIPTS: Readonly<Record<string, readonly ScriptStep[]>> = { shapes: SHAPES_SCRIPT };

export class HandRecorder {
  recording: HandRecording | null = null;
  private guided: GuidedRecording | null = null;
  private startedAt = -1;
  private done = false;
  onFinished: ((rec: HandRecording) => void) | null = null;

  constructor(
    readonly seconds: number,
    private readonly note: string,
    readonly script: ShapeScript | null = null,
  ) {}

  get started(): boolean {
    return this.startedAt >= 0;
  }

  get finished(): boolean {
    return this.done;
  }

  /** The current prompt of a guided recording, once it has started. */
  get prompt(): Prompt | null {
    return this.guided?.prompt ?? null;
  }

  /** Call once per XR frame. */
  frame(nowMs: number, left: HandFrame, right: HandFrame, head: [number, number, number] | null): void {
    if (this.done) return;
    if (this.startedAt < 0) {
      if (!left.tracked && !right.tracked) return;
      this.startedAt = nowMs;
      const [ua, at] = [navigator.userAgent, new Date().toISOString()];
      if (this.script) {
        this.guided = new GuidedRecording(this.script, this.note, ua, at);
        this.recording = this.guided.recording;
      } else {
        this.recording = createRecording(this.note, ua, at);
      }
    }
    const t = (nowMs - this.startedAt) / 1000;
    if (this.guided) {
      if (!this.guided.frame(t, left, right, head)) this.finish();
      return;
    }
    if (t > this.seconds) return this.finish();
    recordFrame(this.recording!, t, left, right, head);
  }

  /** Call on session end. */
  finish(): void {
    if (this.done || !this.recording) return;
    this.done = true;
    this.guided?.finish();
    this.onFinished?.(this.recording);
  }

  /** A recorder with no address: 20 s of free hands, or the guided shape script (84 s, with prompts on a panel). */
  static make(shapes: boolean, seconds = 20): HandRecorder {
    const script = shapes ? new ShapeScript(SCRIPTS.shapes) : null;
    return new HandRecorder(seconds, script ? 'guided: shapes' : 'testing', script);
  }
}

/**
 * Offers a finished recording on the page. It is first sent to the dev server, which writes it into
 * recordings/ on the computer running the game (no file to get off the headset); if there is no dev
 * server the page shows a "Download recording" button instead.
 */
export function offerDownload(rec: HandRecording): void {
  const json = JSON.stringify(rec);
  const name = recordingFileName(rec, 'wsw-hands');
  const b = document.createElement('button');
  const labels = rec.labels.length ? `, ${rec.labels.length} labels` : '';
  const summary = `${rec.frames.length} frames${labels}, ${Math.round(json.length / 1024)} KB`;
  b.textContent = `Saving recording (${summary})...`;
  b.style.cssText =
    'position:fixed;right:12px;bottom:12px;z-index:10;font:14px system-ui,sans-serif;padding:10px 14px;' +
    'border-radius:8px;border:1px solid #8a7a45;background:#fffbe9;color:#111;cursor:pointer';
  document.body.append(b);
  void postRecording(name, json).then((saved) => {
    if (saved) {
      b.textContent = `Saved recordings/${name} (${summary})`;
    } else {
      b.textContent = `Download recording (${summary})`;
      b.onclick = () => downloadJson(json, name);
    }
  });
}
