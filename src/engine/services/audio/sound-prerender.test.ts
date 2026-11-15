import { describe, expect, it } from 'vitest';
import { TaskPool } from '../workers/task-pool';
import { prerenderedCount, takeSamples } from './placeholder-sounds';
import { PRERENDER_ORDER, prerenderList, startSoundPrerender } from './sound-prerender';
import { renderJob, type RenderedSound, type RenderJob } from './sound-render-job';
import { Sound, SOUND_COUNT, SOUND_DEFS } from './sounds';

/** The sounds that have a placeholder: all but the ones that only ever play from their file (the music, the laugh, the yawn). */
const PLACEHOLDERS = SOUND_DEFS.filter((d) => !d.fileOnly).length;

describe('sound prerender', () => {
  it('lists every sound once, with the loops first, and leaves out the ones with a file or no placeholder', () => {
    const list = prerenderList();
    expect(list).toHaveLength(PLACEHOLDERS);
    expect(new Set(list).size).toBe(PLACEHOLDERS);
    expect(list).not.toContain(Sound.Music);
    expect(PLACEHOLDERS).toBe(SOUND_COUNT - 3); // the music, the laugh and the yawn
    expect(list).not.toContain(Sound.Laugh);
    expect(list).not.toContain(Sound.Yawn);
    expect(list.slice(0, 2)).toEqual([Sound.Crackle, Sound.Rain]);
    for (const s of PRERENDER_ORDER) expect(list).toContain(s);
    const some = prerenderList(new Set([Sound.Rain, Sound.Thunder]));
    expect(some).toHaveLength(PLACEHOLDERS - 2);
    expect(some).not.toContain(Sound.Rain);
    expect(some[0]).toBe(Sound.Crackle);
  });

  it('renders every sound through the pool (on the main thread here), stores them, and the engine takes each once at its own rate', async () => {
    const pool = new TaskPool<RenderJob, RenderedSound>({ create: () => null, size: 1, fallback: renderJob });
    const before = prerenderedCount();
    const stored = await startSoundPrerender(pool, 22050);
    expect(stored).toBe(PLACEHOLDERS);
    expect(prerenderedCount() - before).toBe(PLACEHOLDERS);
    const note = takeSamples(Sound.Step0, 22050);
    expect(note.length).toBeGreaterThan(1000);
    expect(prerenderedCount() - before).toBe(PLACEHOLDERS - 1); // handed over once
    const again = takeSamples(Sound.Step0, 22050); // not kept: rendered afresh, and the same
    expect(again).not.toBe(note);
    expect(Array.from(again.slice(0, 100))).toEqual(Array.from(note.slice(0, 100)));
  }, 60000);

  it('keeps going when one sound fails to render', async () => {
    let n = 0;
    const pool = new TaskPool<RenderJob, RenderedSound>({
      create: () => null,
      size: 1,
      fallback: (job) => {
        if (++n === 3) throw new Error('one bad sound');
        return renderJob(job);
      },
    });
    expect(await startSoundPrerender(pool, 22050)).toBe(PLACEHOLDERS - 1);
  }, 60000);

  it('lets the page breathe between sounds when there are no workers, and does not when there are', async () => {
    const pool = new TaskPool<RenderJob, RenderedSound>({ create: () => null, size: 1, fallback: renderJob });
    expect(pool.workerBacked).toBe(false);
    let pauses = 0;
    await startSoundPrerender(pool, 22050, async () => void pauses++);
    expect(pauses).toBe(PLACEHOLDERS);
  }, 60000);

  it('renders nothing for a sound that has a file', async () => {
    const asked: number[] = [];
    const pool = new TaskPool<RenderJob, RenderedSound>({
      create: () => null,
      size: 1,
      fallback: (job) => (asked.push(job.sound), renderJob(job)),
    });
    const stored = await startSoundPrerender(pool, 8000, async () => undefined, new Set([Sound.Crackle, Sound.Rain]));
    expect(stored).toBe(PLACEHOLDERS - 2);
    expect(asked).not.toContain(Sound.Crackle);
    expect(asked).not.toContain(Sound.Rain);
  }, 60000);
});
