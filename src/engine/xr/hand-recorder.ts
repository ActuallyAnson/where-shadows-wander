// Records hand joints during an XR session for offline replay. Enabled with
// ?record=<seconds> (default 10). Recording starts when the first hand is
// tracked and stops after that many seconds or when the session ends. The page
// then shows a "Download recording" button (DOM isn't visible inside XR).
//
// With &script=shapes it's a guided recording instead: the wearer is prompted
// through every shape (PromptPanel), the recording lasts as long as the script,
// and the file carries shape labels (src/engine/hands/shape-script.ts).
import { GuidedRecording } from '../hands/guided-recording';
import type { HandFrame } from '../hands/hand';
import { createRecording, recordFrame, type HandRecording } from '../hands/hand-recording';
import { SHAPES_SCRIPT, ShapeScript, type Prompt, type ScriptStep } from '../hands/shape-script';

/** Scripts that &script=<name> can choose. */
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

  /**
   * Reads ?record=N (and &script=<name>, &note=...) from the URL; null if recording is off.
   * Pass allowScript = false where there's no headset to show prompts on (mock mode).
   */
  static fromUrl(allowScript = true): HandRecorder | null {
    const params = new URLSearchParams(location.search);
    if (!params.has('record')) return null;
    const n = Number(params.get('record') || 10);
    const s = Number.isFinite(n) ? n : 10;
    const name = params.get('script');
    let script: ShapeScript | null = null;
    if (name && !allowScript)
      console.warn('?script= prompts on a headset; at a desk use Guided recording in the Hand Lab');
    else if (name && !SCRIPTS[name]) console.warn(`Unknown recording script "${name}"; recording without one`);
    else if (name) script = new ShapeScript(SCRIPTS[name]);
    const note = params.get('note') ?? (script ? `guided: ${name}` : '');
    return new HandRecorder(Math.min(Math.max(s, 1), 120), note, script);
  }
}

/** Adds a "Download recording" button to the page once a recording is finished. */
export function offerDownload(rec: HandRecording): void {
  const json = JSON.stringify(rec);
  const name = `wsw-hands-${rec.recordedAt.replace(/[:.]/g, '-')}.handrec.json`;
  const b = document.createElement('button');
  const labels = rec.labels.length ? `, ${rec.labels.length} labels` : '';
  b.textContent = `Download recording (${rec.frames.length} frames${labels}, ${Math.round(json.length / 1024)} KB)`;
  b.style.cssText =
    'position:fixed;right:12px;bottom:12px;z-index:10;font:14px system-ui,sans-serif;padding:10px 14px;' +
    'border-radius:8px;border:1px solid #8a7a45;background:#fffbe9;color:#111;cursor:pointer';
  b.onclick = () => {
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: name });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };
  document.body.append(b);
}
