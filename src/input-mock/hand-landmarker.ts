// MediaPipe Hand Landmarker setup and result conversion, shared by the webcam
// bench (webcam.html) and the webcam source in mock mode (?mock=1&src=webcam).
// Only those two load it, so MediaPipe stays out of the game's first load.
import { FilesetResolver, HandLandmarker, type HandLandmarkerResult } from '@mediapipe/tasks-vision';
import wasmLoaderPath from '@mediapipe/tasks-vision/vision_wasm_internal.js?url';
import wasmBinaryPath from '@mediapipe/tasks-vision/vision_wasm_internal.wasm?url';
import type { HandFrame, Handedness } from '../engine/hands/hand';
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

/** Writes a landmarker result into both hands; hands it didn't see are left untracked. */
export function resultToHands(result: HandLandmarkerResult, hands: Record<Handedness, HandFrame>): void {
  hands.left.tracked = hands.right.tracked = false;
  hands.left.validJoints = hands.right.validJoints = 0;
  result.landmarks.forEach((image, i) => {
    const side = handednessFromLabel(result.handedness[i]?.[0]?.categoryName ?? 'Left');
    if (hands[side].tracked) return; // two hands with the same label: keep the first
    mediapipeToHandFrame(result.worldLandmarks[i], image, hands[side]);
  });
}
