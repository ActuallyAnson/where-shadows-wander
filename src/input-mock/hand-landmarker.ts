// MediaPipe Hand Landmarker setup and result conversion, shared by the webcam
// bench (webcam.html) and the webcam source in mock mode (?mock=1&src=webcam).
// Only those two load it, so MediaPipe stays out of the game's first load.
import { FilesetResolver, HandLandmarker, type HandLandmarkerResult } from '@mediapipe/tasks-vision';
import wasmLoaderPath from '@mediapipe/tasks-vision/vision_wasm_internal.js?url';
import wasmBinaryPath from '@mediapipe/tasks-vision/vision_wasm_internal.wasm?url';
import { createHandFrame, type HandFrame, type Handedness, type Vec3 } from '../engine/hands/hand';
import type { HandAssigner } from './hand-assigner';
import { handednessFromLabel, mediapipeToHandFrame } from './mediapipe-hands';

const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

export type { HandLandmarker, HandLandmarkerResult };

export async function createHandLandmarker(): Promise<HandLandmarker> {
  const fileset = { wasmLoaderPath, wasmBinaryPath } as Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>;
  return HandLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
    runningMode: 'VIDEO',
    numHands: 2,
  });
}

const scratch = [createHandFrame('left'), createHandFrame('right')];

/**
 * Writes a landmarker result into both hands; hands it didn't see are left untracked.
 * With an assigner, each hand keeps its side when MediaPipe's label flips for a frame.
 */
export function resultToHands(
  result: HandLandmarkerResult,
  hands: Record<Handedness, HandFrame>,
  assigner?: HandAssigner,
  nowMs = 0,
): void {
  hands.left.tracked = hands.right.tracked = false;
  hands.left.validJoints = hands.right.validJoints = 0;
  const n = Math.min(result.landmarks.length, 2);
  const labels: Handedness[] = [];
  const wrists: Vec3[] = [];
  for (let i = 0; i < n; i++) {
    labels.push(handednessFromLabel(result.handedness[i]?.[0]?.categoryName ?? 'Left'));
    const p = mediapipeToHandFrame(result.worldLandmarks[i], result.landmarks[i], scratch[i]).positions;
    wrists.push([p[0], p[1], p[2]]);
  }
  const sides: Handedness[] = assigner
    ? assigner.assign(labels, wrists, nowMs)
    : labels[0] === labels[1]
      ? [labels[0], labels[0] === 'left' ? 'right' : 'left']
      : labels;
  for (let i = 0; i < n; i++) copyHand(scratch[i], hands[sides[i]]);
}

function copyHand(src: HandFrame, out: HandFrame): void {
  out.positions.set(src.positions);
  out.radii.set(src.radii);
  out.tracked = src.tracked;
  out.validJoints = src.validJoints;
}
