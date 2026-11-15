// Renders the placeholder sounds ahead of time, off the main thread, so that the first time the game plays one (the footsteps) the engine finds it ready instead of stopping the frame loop to synthesise it (on a headset's CPU that is tens
// of milliseconds for each sound). A sound with a real file is left out: its file is used, not its placeholder. The sounds most
// needed first are done first. If workers are not available the pool does the same work on the main thread, a sound at a time as
// the page idles, so nothing is worse than before. Plain TypeScript: the pool is passed in.
import type { TaskPool } from '../workers/task-pool';
import { storePrerendered } from './placeholder-sounds';
import type { RenderedSound, RenderJob } from './sound-render-job';
import { Sound, SOUND_COUNT, SOUND_DEFS, type SoundId } from './sounds';

/** The sounds in the order they are likely to be wanted: the room's loops, the opening's sounds, then the rest. */
export const PRERENDER_ORDER: readonly SoundId[] = [Sound.Crackle, Sound.Rain, Sound.Ignite, Sound.Tick, Sound.Press];

/** A short wait that lets the browser draw a frame. */
const framePause = () => new Promise<void>((resolve) => setTimeout(resolve, 12));

/** Every sound once, the likely-first ones first, leaving out those in `skip` (the ones with a file) and those with no placeholder. */
export function prerenderList(skip: ReadonlySet<SoundId> = new Set()): SoundId[] {
  const list: SoundId[] = [...PRERENDER_ORDER];
  for (let i = 0; i < SOUND_COUNT; i++) if (!list.includes(i as SoundId)) list.push(i as SoundId);
  return list.filter((s) => !skip.has(s) && !SOUND_DEFS[s].fileOnly);
}

/**
 * Asks the pool to render every sound not in `skip` at `rate` and keeps each for the engine to take. Resolves with how many were
 * stored. Jobs go one after another, so the worker is never swamped and a failure loses one sound at most.
 */
export async function startSoundPrerender(
  pool: TaskPool<RenderJob, RenderedSound>,
  rate = 48000,
  pause: () => Promise<void> = framePause,
  skip: ReadonlySet<SoundId> = new Set(),
): Promise<number> {
  let stored = 0;
  for (const sound of prerenderList(skip)) {
    // Without workers each sound is made on this thread: let a frame or two run between them rather than freeze the page.
    if (!pool.workerBacked) await pause();
    try {
      const out = await pool.run({ sound, rate });
      storePrerendered(out.sound, out.rate, out.samples);
      stored++;
    } catch {
      // This one will be rendered when it is first needed, as before.
    }
  }
  return stored;
}
