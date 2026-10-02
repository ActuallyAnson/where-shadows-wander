// MediaPipe Hand Landmarker setup, shared by the webcam bench (webcam.html) and
// the Hand Lab's webcam worker (hand-landmarker.worker.ts). Only those load it,
// so MediaPipe stays out of the game's first load.
import { FilesetResolver, HandLandmarker, type HandLandmarkerResult } from '@mediapipe/tasks-vision';
import wasmLoaderPath from '@mediapipe/tasks-vision/vision_wasm_internal.js?url';
import wasmBinaryPath from '@mediapipe/tasks-vision/vision_wasm_internal.wasm?url';

const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

export type { HandLandmarker, HandLandmarkerResult };

export async function createHandLandmarker(delegate: 'GPU' | 'CPU' = 'GPU'): Promise<HandLandmarker> {
  const fileset = { wasmLoaderPath, wasmBinaryPath } as Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>;
  return HandLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: MODEL_URL, delegate },
    runningMode: 'VIDEO',
    numHands: 2,
  });
}
