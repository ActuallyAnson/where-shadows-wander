// Webcam Hand Bench: MediaPipe hands -> HandFrame -> the same features the
// classifier will use. Runs in a normal browser tab, no headset needed.
import { FilesetResolver, HandLandmarker, type HandLandmarkerResult } from '@mediapipe/tasks-vision';
import wasmLoaderPath from '@mediapipe/tasks-vision/vision_wasm_internal.js?url';
import wasmBinaryPath from '@mediapipe/tasks-vision/vision_wasm_internal.wasm?url';
import { createHandFrame, derivePalm, type HandFrame, type Handedness } from '../engine/hands/hand';
import { FINGER_NAMES, handFeatures, roughShape } from '../engine/hands/hand-features';
import { createRecording, recordFrame, type HandRecording } from '../engine/hands/hand-recording';
import { handednessFromLabel, mediapipeToHandFrame } from './mediapipe-hands';

const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
// MediaPipe's 21-landmark skeleton, for drawing the overlay.
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
    if (!landmarker) {
      const fileset = { wasmLoaderPath, wasmBinaryPath } as Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>;
      landmarker = await HandLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
        runningMode: 'VIDEO',
        numHands: 2,
      });
    }
    status.textContent = 'Waiting for camera permission…';
    video.srcObject = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720, facingMode: 'user' }, audio: false });
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
    update(result);
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

function update(result: HandLandmarkerResult): void {
  hands.left.tracked = hands.right.tracked = false;
  hands.left.validJoints = hands.right.validJoints = 0;
  result.landmarks.forEach((image, i) => {
    const side = handednessFromLabel(result.handedness[i]?.[0]?.categoryName ?? 'Left');
    if (hands[side].tracked) return; // two hands with the same label: keep the first
    mediapipeToHandFrame(result.worldLandmarks[i], image, hands[side]);
  });
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
  for (const side of ['right', 'left'] as const) $(`hand-${side}`).innerHTML = card(side);
}

function card(side: Handedness): string {
  const color = side === 'right' ? 'var(--right)' : 'var(--left)';
  const title = `<h2><i class="dot" style="background:${color}"></i>${side} hand</h2>`;
  const f = handFeatures(hands[side]);
  const palm = derivePalm(hands[side]);
  if (!f || !palm) return `${title}<div class="shape none">Not seen</div>`;
  const [nx, ny, nz] = palm.normal;
  // Scene: +Z points from the hand toward the camera, +Y up. You sit behind the hand, so -Z is toward you.
  const facing = ny > 0.6 ? 'up' : ny < -0.6 ? 'down' : nz > 0.6 ? 'toward the camera' : nz < -0.6 ? 'toward you' : 'sideways';
  return `${title}
    <div class="shape">${roughShape(f)}</div>
    <dl>
      <dt>Palm faces</dt><dd>${facing}</dd>
      <dt>Palm normal</dt><dd>${palm.normal.map((v) => v.toFixed(2)).join(' ')}</dd>
      <dt>Thumb–index gap</dt><dd>${f.pinchGapMm.toFixed(0)} mm</dd>
      <dt>Finger spread</dt><dd>${f.spreadDeg.toFixed(0)}°</dd>
      <dt>Mean curl</dt><dd>${f.meanCurl.toFixed(2)}</dd>
    </dl>
    <div class="curls" style="color:${color}">${FINGER_NAMES.map(
      (n) => `<div class="curl"><div class="b"><i style="height:${(f.curl[n] * 100).toFixed(0)}%"></i></div>${n}</div>`,
    ).join('')}</div>`;
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
  const url = URL.createObjectURL(new Blob([JSON.stringify(rec)], { type: 'application/json' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: `wsw-webcam-${rec.recordedAt.replace(/[:.]/g, '-')}.handrec.json` });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
