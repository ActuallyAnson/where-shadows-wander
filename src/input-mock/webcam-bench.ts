// Webcam Hand Bench: MediaPipe hands -> HandFrame -> the same features the
// classifier will use. Runs in a normal browser tab, no headset needed.
import { createHandFrame, type HandFrame, type Handedness } from '../engine/hands/hand';
import { createRecording, recordFrame, type HandRecording } from '../engine/hands/hand-recording';
import { downloadRecording, handCardHtml } from './hand-card';
import { createHandLandmarker, resultToHands, type HandLandmarker, type HandLandmarkerResult } from './hand-landmarker';
import { handednessFromLabel } from './mediapipe-hands';

// MediaPipe's 21-landmark skeleton, for drawing the overlay.
// prettier-ignore
const BONES = [
  [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [0, 17], [17, 18], [18, 19], [19, 20],
];

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const video = $<HTMLVideoElement>('video');
const overlay = $<HTMLCanvasElement>('overlay');
const status = $<HTMLSpanElement>('status');
const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

const hands: Record<Handedness, HandFrame> = { left: createHandFrame('left'), right: createHandFrame('right') };
let landmarker: HandLandmarker | null = null;
let recording: HandRecording | null = null;
let recordStart = 0;
let lastVideoTime = -1;
let frames = 0;
let fpsAt = performance.now();
let fps = 0;

$('start').addEventListener('click', start);
$('rec').addEventListener('click', toggleRecording);
render();

async function start(): Promise<void> {
  const button = $<HTMLButtonElement>('start');
  button.disabled = true;
  try {
    status.textContent = 'Loading hand model…';
    landmarker ??= await createHandLandmarker();
    status.textContent = 'Waiting for camera permission…';
    video.srcObject = await navigator.mediaDevices.getUserMedia({
      video: { width: 1280, height: 720, facingMode: 'user' },
      audio: false,
    });
    await video.play();
    $('empty').hidden = true;
    $<HTMLButtonElement>('rec').disabled = false;
    button.textContent = 'Camera on';
    requestAnimationFrame(loop);
  } catch (e) {
    button.disabled = false;
    status.textContent = `Couldn't start: ${e instanceof Error ? e.message : String(e)}. Check camera permission and that no other app is using the camera.`;
  }
}

function loop(): void {
  if (landmarker && video.readyState >= 2 && video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;
    const now = performance.now();
    const result = landmarker.detectForVideo(video, now);
    resultToHands(result, hands);
    draw(result);
    if (recording) recordFrame(recording, (now - recordStart) / 1000, hands.left, hands.right, null);
    frames++;
    if (now - fpsAt > 1000) {
      fps = (frames * 1000) / (now - fpsAt);
      frames = 0;
      fpsAt = now;
    }
    const rec = recording ? ` · recording ${((now - recordStart) / 1000).toFixed(1)} s` : '';
    status.textContent = `${fps.toFixed(0)} fps · ${result.landmarks.length} hand(s)${rec}`;
    render();
  }
  requestAnimationFrame(loop);
}

function draw(result: HandLandmarkerResult): void {
  const w = (overlay.width = video.videoWidth);
  const h = (overlay.height = video.videoHeight);
  const g = overlay.getContext('2d')!;
  g.clearRect(0, 0, w, h);
  result.landmarks.forEach((lm, i) => {
    const side = handednessFromLabel(result.handedness[i]?.[0]?.categoryName ?? 'Left');
    g.strokeStyle = g.fillStyle = css(side === 'right' ? '--right' : '--left');
    g.lineWidth = 3;
    for (const [a, b] of BONES) {
      g.beginPath();
      g.moveTo(lm[a].x * w, lm[a].y * h);
      g.lineTo(lm[b].x * w, lm[b].y * h);
      g.stroke();
    }
    for (const p of lm) {
      g.beginPath();
      g.arc(p.x * w, p.y * h, 4, 0, Math.PI * 2);
      g.fill();
    }
  });
}

function render(): void {
  // On the bench the webcam faces you, so +Z points toward the camera.
  for (const side of ['right', 'left'] as const)
    $(`hand-${side}`).innerHTML = handCardHtml(hands[side], ['toward the camera', 'toward you']);
}

function toggleRecording(): void {
  const button = $<HTMLButtonElement>('rec');
  if (!recording) {
    recording = createRecording('Webcam (MediaPipe) via webcam.html', navigator.userAgent, new Date().toISOString());
    recordStart = performance.now();
    button.textContent = 'Stop and download';
    return;
  }
  const rec = recording;
  recording = null;
  button.textContent = 'Record';
  downloadRecording(rec, 'wsw-webcam');
}
