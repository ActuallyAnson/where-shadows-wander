// Live webcam hands in mock mode (?mock=1&src=webcam), through MediaPipe.
// Loaded with a dynamic import, so the game only downloads MediaPipe when asked.
// Hands appear about 0.5 m in front of the desktop view, turned 180° so you
// see them from your own side, as a headset would: your right hand on the
// right, the back of your hand toward you when your palm faces the webcam.
// Turning (not mirroring) keeps left and right hands their true shape. See
// ADR 0004 for how webcam hands differ from a headset's.
//
// The camera gives about 24-30 new hands a second and each is a little noisy,
// so every camera frame goes through a One Euro filter, and the display glides
// from the last filtered hand to the new one over one camera interval instead
// of jumping. That costs at most one camera frame of delay (about 40 ms).
import { createHandFrame, JOINT_COUNT, type HandFrame, type Handedness } from '../engine/hands/hand';
import { OneEuroFilter } from '../engine/hands/one-euro';
import { HandAssigner } from './hand-assigner';
import { createHandLandmarker, resultToHands, type HandLandmarker } from './hand-landmarker';
import { clearHand, type HandSource } from './hand-source';

/** The desktop camera's position (iwsdk.config.json). */
const CAMERA = [0, 1, 0.5];
/** mediapipeToHandFrame places hands this far in front of the webcam; we turn them about that point. */
const HAND_DEPTH = 0.5;

export class WebcamSource implements HandSource {
  readonly name = 'webcam';
  private readonly seen: Record<Handedness, HandFrame> = {
    left: createHandFrame('left'),
    right: createHandFrame('right'),
  };
  private readonly assigner = new HandAssigner();
  private readonly smooth = { left: new Smoothed(), right: new Smoothed() };
  private stopped = false;
  private lastCameraAt = 0;
  /** Smoothed time between camera frames, ms. */
  private cameraMs = 40;
  /** Smoothed MediaPipe time per camera frame, ms. */
  private detectMs = 0;

  private constructor(
    private readonly landmarker: HandLandmarker,
    private readonly video: HTMLVideoElement,
  ) {
    this.onVideoFrame();
  }

  /**
   * Runs MediaPipe once per new camera frame. The display runs faster than the
   * camera (60-120 Hz vs about 30), and video.currentTime moves every display
   * frame even without a new image, so checking it ran MediaPipe several times
   * on the same picture, each time with slightly different joints.
   */
  private onVideoFrame = (): void => {
    if (this.stopped) return;
    if (this.video.readyState >= 2) {
      const now = performance.now();
      resultToHands(this.landmarker.detectForVideo(this.video, now), this.seen, this.assigner, now);
      const spent = performance.now() - now;
      this.detectMs += (spent - this.detectMs) * 0.1;
      if (this.lastCameraAt > 0) this.cameraMs += (Math.min(now - this.lastCameraAt, 200) - this.cameraMs) * 0.1;
      this.lastCameraAt = now;
      this.smooth.left.camera(this.seen.left, now, this.cameraMs);
      this.smooth.right.camera(this.seen.right, now, this.cameraMs);
    }
    this.video.requestVideoFrameCallback(this.onVideoFrame);
  };

  static async start(): Promise<WebcamSource> {
    const landmarker = await createHandLandmarker();
    const video = document.createElement('video');
    video.muted = video.playsInline = true;
    // Small mirrored preview in the corner, so you can see what the camera sees.
    video.style.cssText =
      'position:fixed;left:12px;top:12px;width:200px;z-index:10;transform:scaleX(-1);' +
      'border-radius:8px;opacity:.85;pointer-events:none';
    video.srcObject = await navigator.mediaDevices.getUserMedia({
      video: { width: 1280, height: 720, facingMode: 'user' },
      audio: false,
    });
    document.body.append(video);
    await video.play();
    return new WebcamSource(landmarker, video);
  }

  update(_t: number, left: HandFrame, right: HandFrame): void {
    const now = performance.now();
    this.smooth.left.write(this.seen.left, now, left);
    this.smooth.right.write(this.seen.right, now, right);
  }

  status(): string {
    return `camera ${(1000 / this.cameraMs).toFixed(0)} fps · MediaPipe ${this.detectMs.toFixed(0)} ms`;
  }

  dispose(): void {
    this.stopped = true;
    for (const track of (this.video.srcObject as MediaStream | null)?.getTracks() ?? []) track.stop();
    this.video.remove();
    this.landmarker.close();
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
    p[j + 1] = CAMERA[1] + s[j + 1];
    p[j + 2] = CAMERA[2] - 2 * HAND_DEPTH - s[j + 2];
  }
  out.radii.set(src.radii);
  out.tracked = true;
  out.validJoints = src.validJoints;
}
