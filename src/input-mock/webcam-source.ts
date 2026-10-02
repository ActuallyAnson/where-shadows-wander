// Live webcam hands in mock mode (?mock=1&src=webcam), through MediaPipe.
// Loaded with a dynamic import, so the game only downloads MediaPipe when asked.
// Hands appear about 0.5 m in front of the desktop view, turned 180° so you
// see them from your own side, as a headset would: your right hand on the
// right, the back of your hand toward you when your palm faces the webcam.
// Turning (not mirroring) keeps left and right hands their true shape. See
// ADR 0004 for how webcam hands differ from a headset's.
import { createHandFrame, type HandFrame, type Handedness } from '../engine/hands/hand';
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
  private lastVideoTime = -1;

  private constructor(
    private readonly landmarker: HandLandmarker,
    private readonly video: HTMLVideoElement,
  ) {}

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
    if (this.video.readyState >= 2 && this.video.currentTime !== this.lastVideoTime) {
      this.lastVideoTime = this.video.currentTime;
      resultToHands(this.landmarker.detectForVideo(this.video, performance.now()), this.seen);
    }
    copyPlaced(this.seen.left, left);
    copyPlaced(this.seen.right, right);
  }

  dispose(): void {
    for (const track of (this.video.srcObject as MediaStream | null)?.getTracks() ?? []) track.stop();
    this.video.remove();
    this.landmarker.close();
  }
}

function copyPlaced(src: HandFrame, out: HandFrame): void {
  if (!src.tracked) return clearHand(out);
  const s = src.positions,
    p = out.positions;
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
