// The worker that renders the game's placeholder sounds (placeholder-sounds.ts) off the main thread. It is sent a sound and a sample
// rate, renders it, and sends the samples back by moving their buffer (no copy). Started by main.ts through a TaskPool, with
// sound-prerender.ts asking for each sound.
import { renderJob, type RenderJob } from './sound-render-job';

const scope = self as unknown as {
  onmessage: ((e: { data: { id: number; input: RenderJob } }) => void) | null;
  postMessage(message: unknown, transfer?: Transferable[]): void;
};
scope.onmessage = (e) => {
  const out = renderJob(e.data.input);
  scope.postMessage({ id: e.data.id, output: out }, [out.samples.buffer]);
};
