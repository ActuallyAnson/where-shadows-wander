// Runs MediaPipe hand tracking off the main thread for the Hand Lab's webcam
// source. MediaPipe took 8-38 ms per camera frame on the main thread, which
// stalled drawing; here it doesn't block the page. The page sends one
// camera frame at a time as an ImageBitmap and gets plain landmark data back.
import { createHandLandmarker, type HandLandmarker } from './hand-landmarker';
import type { LandmarkerResult } from './mediapipe-hands';

export type WorkerRequest = { type: 'frame'; bitmap: ImageBitmap; t: number };
export type WorkerReply =
  { type: 'ready' } | { type: 'error'; message: string } | { type: 'result'; result: LandmarkerResult; ms: number };

// MediaPipe loads its wasm glue with importScripts, which only works in classic
// workers; Vite's dev server runs workers as modules, where it throws. A
// synchronous fetch plus a global eval does the same job in either kind.
// (Synchronous requests are allowed in workers.)
(self as unknown as { importScripts: (...urls: string[]) => void }).importScripts = (...urls) => {
  for (const url of urls) {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, false);
    xhr.send();
    if (xhr.status !== 200) throw new Error(`Couldn't load ${url}: HTTP ${xhr.status}`);
    (0, eval)(xhr.responseText);
  }
};

const post = (msg: WorkerReply) => (self as unknown as { postMessage: (m: WorkerReply) => void }).postMessage(msg);
let landmarker: HandLandmarker | null = null;

// CPU, not GPU: in a worker, MediaPipe's GPU delegate competes with the page's
// own WebGL drawing for the GPU, so frames still stalled (16.7 ms -> 72 ms in a
// test). On the CPU, in this thread, the page kept a steady 16.7 ms.
createHandLandmarker('CPU')
  .then((l) => {
    landmarker = l;
    post({ type: 'ready' });
  })
  .catch((e) => post({ type: 'error', message: e instanceof Error ? e.message : String(e) }));

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const { bitmap, t } = e.data;
  if (!landmarker) return bitmap.close();
  const t0 = performance.now();
  const r = landmarker.detectForVideo(bitmap, t);
  bitmap.close();
  post({
    type: 'result',
    result: {
      landmarks: r.landmarks,
      worldLandmarks: r.worldLandmarks,
      handedness: r.handedness.map((h) => h.map((c) => ({ categoryName: c.categoryName }))),
    },
    ms: performance.now() - t0,
  });
};
