// Records hand joints during an XR session for offline replay. Enabled with
// ?record=<seconds> (default 10). Recording starts when the first hand is
// tracked and stops after that many seconds or when the session ends. The page
// then shows a "Download recording" button (DOM isn't visible inside XR).
import { createRecording, recordFrame, type HandRecording } from '../hands/hand-recording';
import type { HandFrame } from '../hands/hand';

export class HandRecorder {
  recording: HandRecording | null = null;
  private startedAt = -1;
  private done = false;
  onFinished: ((rec: HandRecording) => void) | null = null;

  constructor(
    readonly seconds: number,
    private readonly note: string,
  ) {}

  /** Call once per XR frame. */
  frame(nowMs: number, left: HandFrame, right: HandFrame, head: [number, number, number] | null): void {
    if (this.done) return;
    if (this.startedAt < 0) {
      if (!left.tracked && !right.tracked) return;
      this.startedAt = nowMs;
      this.recording = createRecording(this.note, navigator.userAgent, new Date().toISOString());
    }
    const t = (nowMs - this.startedAt) / 1000;
    if (t > this.seconds) return this.finish();
    recordFrame(this.recording!, t, left, right, head);
  }

  /** Call on session end. */
  finish(): void {
    if (this.done || !this.recording) return;
    this.done = true;
    this.onFinished?.(this.recording);
  }

  /** Reads ?record=N from the URL; null if recording is off. */
  static fromUrl(): HandRecorder | null {
    const params = new URLSearchParams(location.search);
    if (!params.has('record')) return null;
    const s = Number(params.get('record') || 10);
    return new HandRecorder(Math.min(Math.max(s, 1), 120), params.get('note') ?? '');
  }
}

/** Adds a "Download recording" button to the page once a recording is finished. */
export function offerDownload(rec: HandRecording): void {
  const json = JSON.stringify(rec);
  const name = `wsw-hands-${rec.recordedAt.replace(/[:.]/g, '-')}.handrec.json`;
  const b = document.createElement('button');
  b.textContent = `Download recording (${rec.frames.length} frames, ${Math.round(json.length / 1024)} KB)`;
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
