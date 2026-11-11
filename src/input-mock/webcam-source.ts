// Live webcam hands in mock mode (?mock=1&src=webcam), through MediaPipe.
// Loaded with a dynamic import, so the game only downloads MediaPipe when asked.
// Hands appear about 0.5 m in front of the desktop view, turned 180° so you
// see them from your own side, as a headset would: your right hand on the
// right, the back of your hand toward you when your palm faces the webcam.
// Turning (not mirroring) keeps left and right hands their true shape. See
// ADR 0004 for how webcam hands differ from a headset's.
//
// MediaPipe runs in a worker (hand-landmarker.worker.ts), so it never stalls drawing.
// The camera gives about 15-30 new hands a second and each is a little noisy,
// so every camera frame goes through a One Euro filter, and the display glides
// from the last filtered hand to the new one over one camera interval instead
// of jumping. That costs at most one camera frame of delay (about 40 ms).
import { createHandFrame, JOINT_COUNT, type HandFrame, type Handedness } from '../engine/hands/hand';
import { OneEuroFilter } from '../engine/hands/one-euro';
import { HandAssigner } from './hand-assigner';
import type { WorkerReply, WorkerRequest } from './hand-landmarker.worker';
import { resultToHands, type LandmarkerResult } from './mediapipe-hands';
import { clearHand, type HandSource } from './hand-source';

/** The desktop camera's position (iwsdk.config.json). */
const CAMERA = [0, 1, 0.5];
/** mediapipeToHandFrame places hands this far in front of the webcam; we turn them about that point. */
const HAND_DEPTH = 0.5;
/** Lowers webcam hands to about where mock hands rest (MOCK_WRIST), in front of the candle and the paper wall. */
const HAND_DROP = 0.2;

export class WebcamSource implements HandSource {
  readonly name = 'webcam';
  private readonly seen: Record<Handedness, HandFrame> = {
    left: createHandFrame('left'),
    right: createHandFrame('right'),
  };
  private readonly assigner = new HandAssigner();
  /** Treat a single hand in view as this side (MediaPipe's guess for a lone hand is unreliable); null = auto. */
  lockSide: Handedness | null = null;
  private readonly smooth = { left: new Smoothed(), right: new Smoothed() };
  private stopped = false;
  /** A frame is with the worker; newer camera frames are skipped until it answers. */
  private busy = false;
  private lastResultAt = 0;
  /** Smoothed time between tracked frames, ms. */
  private frameMs = 40;
  /** Smoothed MediaPipe time per frame in the worker, ms (doesn't block the page). */
  private detectMs = 0;

  private constructor(
    private readonly worker: Worker,
    private readonly video: HTMLVideoElement,
  ) {
    worker.onmessage = (e: MessageEvent<WorkerReply>) => {
      if (e.data.type === 'result') this.onResult(e.data.result, e.data.ms);
    };
    this.onVideoFrame();
  }

  static async start(): Promise<WebcamSource> {
    const worker = new Worker(new URL('./hand-landmarker.worker.ts', import.meta.url), { type: 'module' });
    const ready = new Promise<void>((resolve, reject) => {
      worker.onmessage = (e: MessageEvent<WorkerReply>) => {
        if (e.data.type === 'ready') resolve();
        else if (e.data.type === 'error') reject(new Error(e.data.message));
      };
      worker.onerror = (e) => reject(new Error(e.message || 'hand tracking worker failed to start'));
    });
    const video = document.createElement('video');
    video.muted = video.playsInline = true;
    // Small mirrored preview in the corner, so you can see what the camera sees.
    video.style.cssText =
      'position:fixed;left:12px;top:12px;width:200px;z-index:10;transform:scaleX(-1);' +
      'border-radius:8px;opacity:.85;pointer-events:none';
    try {
      video.srcObject = await navigator.mediaDevices.getUserMedia({
        // MediaPipe shrinks every image to about 256 px, so a small camera frame
        // loses nothing and is cheaper to copy to the worker.
        video: { width: 640, height: 360, facingMode: 'user' },
        audio: false,
      });
      document.body.append(video);
      await video.play();
      await ready;
      return new WebcamSource(worker, video);
    } catch (e) {
      worker.terminate();
      for (const track of (video.srcObject as MediaStream | null)?.getTracks() ?? []) track.stop();
      video.remove();
      throw e;
    }
  }

  /** Sends each new camera frame to the worker, unless it's still busy with the last one. */
  private onVideoFrame = (): void => {
    if (this.stopped) return;
    if (!this.busy && this.video.readyState >= 2) {
      this.busy = true;
      createImageBitmap(this.video)
        .then((bitmap) => {
          if (this.stopped) return bitmap.close();
          const msg: WorkerRequest = { type: 'frame', bitmap, t: performance.now() };
          this.worker.postMessage(msg, [bitmap]);
        })
        .catch(() => (this.busy = false));
    }
    this.video.requestVideoFrameCallback(this.onVideoFrame);
  };

  private onResult(result: LandmarkerResult, ms: number): void {
    this.busy = false;
    const now = performance.now();
    this.detectMs += (ms - this.detectMs) * 0.1;
    if (this.lastResultAt > 0) this.frameMs += (Math.min(now - this.lastResultAt, 200) - this.frameMs) * 0.1;
    this.lastResultAt = now;
    resultToHands(result, this.seen, this.assigner, now, this.lockSide);
    this.smooth.left.camera(this.seen.left, now, this.frameMs);
    this.smooth.right.camera(this.seen.right, now, this.frameMs);
  }

  update(_t: number, left: HandFrame, right: HandFrame): void {
    const now = performance.now();
    this.smooth.left.write(this.seen.left, now, left);
    this.smooth.right.write(this.seen.right, now, right);
  }

  status(): string {
    return `tracking ${(1000 / this.frameMs).toFixed(0)} fps · MediaPipe ${this.detectMs.toFixed(0)} ms (background)`;
  }

  dispose(): void {
    this.stopped = true;
    this.worker.terminate();
    for (const track of (this.video.srcObject as MediaStream | null)?.getTracks() ?? []) track.stop();
    this.video.remove();
  }
}

/** One hand's smoothing: filter each camera frame, then glide between them on screen. */
class Smoothed {
  private readonly filter = new OneEuroFilter(JOINT_COUNT * 3);
  private readonly from = new Float32Array(JOINT_COUNT * 3);
  private readonly to = new Float32Array(JOINT_COUNT * 3);
  private readonly shown = new Float32Array(JOINT_COUNT * 3);
  private tracked = false;
  private at = 0;
  private lastAt = 0;
  private interval = 40;

  camera(hand: HandFrame, now: number, intervalMs: number): void {
    if (!hand.tracked) {
      this.tracked = false;
      return;
    }
    if (!this.tracked) this.filter.reset();
    this.filter.filter(hand.positions, (now - this.lastAt) / 1000);
    // Glide from wherever the hand is on screen now, so there's no jump.
    this.from.set(this.tracked ? this.shown : this.filter.value);
    this.to.set(this.filter.value);
    this.tracked = true;
    this.at = this.lastAt = now;
    this.interval = intervalMs;
  }

  write(hand: HandFrame, now: number, out: HandFrame): void {
    if (!this.tracked) return clearHand(out);
    const k = Math.min(Math.max((now - this.at) / this.interval, 0), 1);
    for (let i = 0; i < this.shown.length; i++) this.shown[i] = this.from[i] + (this.to[i] - this.from[i]) * k;
    copyPlaced(this.shown, hand, out);
  }
}

function copyPlaced(s: Float32Array, src: HandFrame, out: HandFrame): void {
  const p = out.positions;
  // 180° about the vertical through the hand-depth point: x -> -x, z -> -2·depth - z.
  for (let j = 0; j < s.length; j += 3) {
    p[j] = CAMERA[0] - s[j];
    p[j + 1] = CAMERA[1] - HAND_DROP + s[j + 1];
    p[j + 2] = CAMERA[2] - 2 * HAND_DEPTH - s[j + 2];
  }
  out.radii.set(src.radii);
  out.tracked = true;
  out.validJoints = src.validJoints;
}
