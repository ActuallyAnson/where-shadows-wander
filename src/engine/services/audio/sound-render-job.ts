// One job of the sound renderer: which sound at which sample rate, and the same job done in plain code (used by the worker, and by the
// pool when there is no worker). No side effects when imported, so tests and the main thread can use it.
import { renderPlaceholder } from './placeholder-sounds';
import type { SoundId } from './sounds';

export interface RenderJob {
  readonly sound: SoundId;
  readonly rate: number;
}
export interface RenderedSound {
  readonly sound: SoundId;
  readonly rate: number;
  readonly samples: Float32Array<ArrayBuffer>;
}

/** Renders the job (a sound at a rate). */
export function renderJob(job: RenderJob): RenderedSound {
  return { sound: job.sound, rate: job.rate, samples: renderPlaceholder(job.sound, job.rate) };
}
