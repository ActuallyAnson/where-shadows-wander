import { describe, expect, it } from 'vitest';
import { validateCutscene } from '../engine/sim/cutscene';
import { createNightLevels, LEVEL_COUNT } from './puzzles/index';
import { interludeFor, KINDRED_AWAY_FROM, SLEEPERS, stageLine, STIR_LINES } from './story';

/** The puppets the cutscene view can draw (src/engine/shadow/cutscene-view.ts and pure/puppets.ts). */
const PUPPETS = new Set(['fox', 'fox-flying', 'bird', 'traveller', 'traveller-wait', 'traveller-cheer']);
/** Interludes stay short: they come between every two scenes. */
const MAX_INTERLUDE_S = 8;

const levels = createNightLevels();

describe('the story between the scenes', () => {
  it('has a sleeper, a line and an interlude for every level and stage of the night', () => {
    expect(SLEEPERS).toHaveLength(LEVEL_COUNT);
    expect(levels).toHaveLength(LEVEL_COUNT);
    levels.forEach((stages, level) => {
      stages.forEach((_, stage) => {
        if (stage === 0) {
          expect(stageLine(level, 0)).toBe(''); // the level's own line (src/app/story.ts)
          expect(interludeFor(level, 0) === null).toBe(level === 0); // the opening is the first card
        } else {
          expect(stageLine(level, stage).length).toBeGreaterThan(0);
          expect(interludeFor(level, stage)).not.toBeNull();
        }
      });
    });
  });

  it('gives every interlude playable data, short, with puppets the view can draw', () => {
    for (let level = 0; level < LEVEL_COUNT; level++) {
      for (let stage = 0; stage < 3; stage++) {
        const c = interludeFor(level, stage);
        if (!c) continue;
        expect(validateCutscene(c), c.id).toEqual([]);
        let end = 0;
        for (const b of c.beats) {
          end = Math.max(end, b.at + b.duration);
          if (b.kind === 'puppet') expect(PUPPETS.has(b.puppet), `${c.id}: ${b.puppet}`).toBe(true);
        }
        expect(end, c.id).toBeLessThanOrEqual(MAX_INTERLUDE_S);
      }
    }
  });

  it('says the sleeper stirring between stages, and names it on the chapter card', () => {
    const caption = (level: number, stage: number) =>
      interludeFor(level, stage)!.beats.find((b) => b.kind === 'caption');
    expect(caption(1, 0)).toMatchObject({ text: 'II · The bunting' });
    expect(caption(0, 1)).toMatchObject({ text: STIR_LINES[0][0] });
    expect(caption(4, 2)).toMatchObject({ text: STIR_LINES[4][1] });
  });

  it('keeps the kindred out of the interludes while it is away (from the dimming to the return)', () => {
    for (let level = 0; level < LEVEL_COUNT; level++) {
      for (let stage = 0; stage < 3; stage++) {
        const foxes = (interludeFor(level, stage)?.beats ?? []).filter(
          (b) => b.kind === 'puppet' && b.puppet.startsWith('fox'),
        );
        if (level >= KINDRED_AWAY_FROM) expect(foxes, `level ${level} stage ${stage}`).toHaveLength(0);
        else if (stage > 0 || level > 0) expect(foxes.length, `level ${level} stage ${stage}`).toBeGreaterThan(0);
      }
    }
  });

  it('is the same data each time it is asked for (built once, at load)', () => {
    expect(interludeFor(2, 1)).toBe(interludeFor(2, 1));
    expect(interludeFor(9, 0)).toBeNull();
  });
});
