// Webcam Hand Bench: MediaPipe hands -> HandFrame -> the same features the
// classifier will use. Runs in a normal browser tab, no headset needed.
import { createHandFrame, type HandFrame, type Handedness } from '../engine/hands/hand';
import { GuidedRecording } from '../engine/hands/guided-recording';
import { createRecording, recordFrame, type HandRecording } from '../engine/hands/hand-recording';
import { ShapeRecognizer } from '../engine/hands/shape-recognizer';
import { SHAPES_SCRIPT, ShapeScript } from '../engine/hands/shape-script';
import { downloadRecording, handCardHtml } from './hand-card';
import { HandAssigner } from './hand-assigner';
import { createHandLandmarker, type HandLandmarker, type HandLandmarkerResult } from './hand-landmarker';
import { handednessFromLabel, resultToHands } from './mediapipe-hands';

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
let guided: GuidedRecording | null = null;
let guidedStart = 0;
const prompt = $<HTMLDivElement>('prompt');
let shownStep = -2;
let shownSecond = -1;
const assigner = new HandAssigner();
const shapes = new ShapeRecognizer();
let frames = 0;
let fpsAt = performance.now();
let fps = 0;

$('start').addEventListener('click', start);
$('rec').addEventListener('click', toggleRecording);
$('guide').addEventListener('click', toggleGuided);
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
    $<HTMLButtonElement>('guide').disabled = false;
    button.textContent = 'Camera on';
    video.requestVideoFrameCallback(loop);
  } catch (e) {
    button.disabled = false;
    status.textContent = `Couldn't start: ${e instanceof Error ? e.message : String(e)}. Check camera permission and that no other app is using the camera.`;
  }
}

/** Runs once per new camera frame (see WebcamSource for why not once per display frame). */
function loop(): void {
  if (landmarker && video.readyState >= 2) {
    const now = performance.now();
    const result = landmarker.detectForVideo(video, now);
    resultToHands(result, hands, assigner, now);
    shapes.update(hands, now / 1000);
    draw(result);
    if (recording) recordFrame(recording, (now - recordStart) / 1000, hands.left, hands.right, null);
    if (guided) {
      if (!guided.frame((now - guidedStart) / 1000, hands.left, hands.right, null)) finishGuided();
      else showPrompt();
    }
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
  video.requestVideoFrameCallback(loop);
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
    $(`hand-${side}`).innerHTML = handCardHtml(
      hands[side],
      ['toward the camera', 'toward you'],
      null,
      shapes[side].state,
      shapes[side].margins,
    );
}

/** Guided recording: prompts every shape on each hand and saves a labelled recording (src/engine/hands/shape-script.ts). */
function toggleGuided(): void {
  if (guided) return finishGuided();
  if (recording) return;
  guided = new GuidedRecording(
    new ShapeScript(SHAPES_SCRIPT),
    'Webcam (MediaPipe) via webcam.html, guided',
    navigator.userAgent,
    new Date().toISOString(),
  );
  guidedStart = performance.now();
  $('guide').textContent = 'Stop guided';
  $<HTMLButtonElement>('rec').disabled = true;
  prompt.hidden = false;
}

function finishGuided(): void {
  if (!guided) return;
  const rec = guided.finish();
  guided = null;
  if (rec.frames.length) downloadRecording(rec, 'wsw-webcam-guided');
  $('guide').textContent = 'Guided recording';
  $<HTMLButtonElement>('rec').disabled = false;
  prompt.hidden = true;
  shownStep = -2;
}

/** Updates the prompt overlay only when the step or the whole second changes. */
function showPrompt(): void {
  const p = guided!.prompt;
  const second = Math.ceil(p.remaining);
  if (p.index === shownStep && second === shownSecond) return;
  shownStep = p.index;
  shownSecond = second;
  const [title, detail] = p.text.split('\n');
  prompt.innerHTML = `<b>${title}</b>${detail ? `<span>${detail}</span>` : ''}<em>${Math.ceil(p.remaining) || ''}</em>`;
}

function toggleRecording(): void {
  const button = $<HTMLButtonElement>('rec');
  if (guided) return;
  if (!recording) {
    $<HTMLButtonElement>('guide').disabled = true;
    recording = createRecording('Webcam (MediaPipe) via webcam.html', navigator.userAgent, new Date().toISOString());
    recordStart = performance.now();
    button.textContent = 'Stop and download';
    return;
  }
  const rec = recording;
  recording = null;
  button.textContent = 'Record';
  downloadRecording(rec, 'wsw-webcam');
  $<HTMLButtonElement>('guide').disabled = false;
}
