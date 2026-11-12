// Renders every placeholder sound ahead of time, off the main thread, so that the first time the game plays one (a lullaby note, the
// wind, the clock) the engine finds it ready instead of stopping the frame loop to synthesise it (on a headset's CPU that is tens of
// milliseconds for each sound, and the music alone about a second). The sounds most needed first (the room's loops) are done first.
// If workers are not available the pool does the same work on the main thread, a sound at a time as the page idles, so nothing is
// worse than before. Plain TypeScript: the pool is passed in.
import type { TaskPool } from '../workers/task-pool';
import { MUSIC_RATE, storePrerendered } from './placeholder-sounds';
import type { RenderedSound, RenderJob } from './sound-render-job';
import { Sound, SOUND_COUNT, type SoundId } from './sounds';

/** The sounds in the order they are likely to be wanted: the room's loops, the opening's sounds, then the rest. */
export const PRERENDER_ORDER: readonly SoundId[] = [
  Sound.Hum,
  Sound.Crackle,
  Sound.Music,
  Sound.Rain,
  Sound.Clock,
  Sound.Wind,
  Sound.Ignite,
  Sound.Tick,
  Sound.Press,
  Sound.Chime,
  Sound.Note0,
  Sound.Note1,
  Sound.Note2,
  Sound.Note3,
  Sound.Note4,
];

/** A short wait that lets the browser draw a frame. */
const framePause = () => new Promise<void>((resolve) => setTimeout(resolve, 12));

/** Every sound once, the likely-first ones first. */
export function prerenderList(): SoundId[] {
  const list: SoundId[] = [...PRERENDER_ORDER];
  for (let i = 0; i < SOUND_COUNT; i++) if (!list.includes(i as SoundId)) list.push(i as SoundId);
  return list;
}

/**
 * Asks the pool to render every sound at `rate` (the music always at its own low rate) and keeps each for the engine to take.
 * Resolves with how many were stored. Jobs go one after another, so the worker is never swamped and a failure loses one sound at most.
 */
export async function startSoundPrerender(
  pool: TaskPool<RenderJob, RenderedSound>,
  rate = 48000,
  pause: () => Promise<void> = framePause,
): Promise<number> {
  let stored = 0;
  for (const sound of prerenderList()) {
    // Without workers each sound is made on this thread: let a frame or two run between them rather than freeze the page.
    if (!pool.workerBacked) await pause();
    try {
      const out = await pool.run({ sound, rate: sound === Sound.Music ? MUSIC_RATE : rate });
      storePrerendered(out.sound, out.rate, out.samples);
      stored++;
    } catch {
      // This one will be rendered when it is first needed, as before.
    }
  }
  return stored;
}
