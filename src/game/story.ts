// The night's story between its scenes (docs/levels/night.md, "Story beats"). The room dreams every
// night, but tonight its dreams have sunk too deep to wake, and the traveller carries the one spark
// left to wake the five sleepers (the lamp, the bunting, the pictures, the globe, the window). Each
// level is one sleeper, and it takes all three of the level's stages to wake it: the first stage
// solved, it stirs; the second, it half wakes; the third, it wakes (that line is the app's,
// src/app/story.ts, with the level's own opening line).
//
// This file holds what is said and shown between the stages:
// - a line for each later stage, said a moment after it appears (what lies in the way, told as
//   a story, never as an instruction);
// - the interludes, short wall cutscenes (src/engine/sim/cutscene.ts) that play as a scene begins:
//   between two stages of a level the sleeper stirs while the kindred (or, once it has fled, a paper
//   bird) crosses the new land; at the start of each level after the first, its chapter card.
//
// Plain data, built once at load. The puppets are the ones the cutscene view draws: 'fox',
// 'fox-flying', 'bird' and the traveller's poses.
import type { Beat, CutsceneData } from '../engine/sim/cutscene';

/** The levels from which the kindred is away (the dimming, before the fan, until the return). */
export const KINDRED_AWAY_FROM = 3;

/** The sleeper each level wakes, for the chapter cards. */
export const SLEEPERS: readonly string[] = ['The lamp', 'The bunting', 'The pictures', 'The globe', 'The window'];

const NUMERALS = ['I', 'II', 'III', 'IV', 'V'];
/**
 * The interludes' captions stand high on the wall, where the story's lines are written: low down
 * they would cross the ledges' black shadows. The puppets fly below them.
 */
const CAPTION_HIGH = 0.32;

/**
 * The line under each later stage, [level][stage - 1]: said a moment after the stage appears, as
 * the level's own line is on its first stage.
 */
export const STAGE_LINES: readonly (readonly [string, string])[] = [
  ['Here the books lie farther apart.', 'One gap is wider than any bridge.'],
  ['The shelves climb like a stair.', 'A gap first, and then the step.'],
  ['The rain hangs long here, and sways.', 'Rain, and the floor gives way beneath it.'],
  ['Two winds now, and the second is stronger.', 'Out of the wind, and up.'],
  ['The moat is wider here.', 'The keep stands high behind its gate.'],
];

/** What each level's sleeper does as its first and second stages are solved, [level][stage - 1]. */
export const STIR_LINES: readonly (readonly [string, string])[] = [
  ['The lamp stirs. A little light leaks out.', 'It dreams of a match, and almost wakes.'],
  ['One paper flag lifts, and falls back.', 'The string hums, half awake.'],
  ['A painted bird ruffles its feathers.', 'Behind the glass, the painted sky turns.'],
  ['The globe creaks a quarter turn.', 'One of its seas begins to shine.'],
  ["Starlight gathers at the window's edge.", 'The glass fogs, as if something breathed.'],
];

/** The line for stage `stage` of `level`, or '' (the first stage's line is the level's, in src/app/story.ts). */
export function stageLine(level: number, stage: number): string {
  if (stage < 1) return '';
  return STAGE_LINES[level]?.[stage - 1] ?? '';
}

/**
 * The stir interlude: the sleeper's line, and the kindred sweeping across the new land from the
 * right (the way the traveller is going); once the kindred is away, a paper bird instead, tumbling
 * on the fan's wind or circling toward the castle window. About 6.5 s.
 */
function stir(level: number, stage: number): CutsceneData {
  const text = STIR_LINES[level][stage - 1];
  const beats: Beat[] = [{ kind: 'caption', at: 0.6, duration: 5.4, text, y: CAPTION_HIGH }];
  if (level < KINDRED_AWAY_FROM) {
    beats.push({ kind: 'puppet', at: 0.3, duration: 6, puppet: 'fox-flying', from: [0.7, 0.12], to: [-0.6, -0.02] });
    // The pictures' sleeper is a painted bird: it follows the kindred out of its frame.
    if (level === 2)
      beats.push({ kind: 'puppet', at: 1.6, duration: 4.6, puppet: 'bird', from: [0.6, 0.16], to: [-0.4, 0.04] });
  } else if (level === 3) {
    // The fan's wind blows the bird backwards, against the way the traveller walks.
    beats.push({ kind: 'puppet', at: 0.4, duration: 5, puppet: 'bird', from: [-0.65, 0.1], to: [0.65, 0.0] });
  } else {
    beats.push({ kind: 'puppet', at: 0.4, duration: 5.8, puppet: 'bird', from: [-0.5, -0.05], to: [0.45, 0.15] });
  }
  return { id: `stir-${level}-${stage}`, beats };
}

/** The chapter card: the level's number and sleeper, and the kindred (if it is about) leading the way in. About 4.5 s. */
function chapter(level: number): CutsceneData {
  const text = `${NUMERALS[level]} · ${SLEEPERS[level]}`;
  const beats: Beat[] = [{ kind: 'caption', at: 0.4, duration: 4, text, y: CAPTION_HIGH }];
  if (level < KINDRED_AWAY_FROM)
    beats.push({ kind: 'puppet', at: 0.2, duration: 4.2, puppet: 'fox-flying', from: [-0.7, -0.02], to: [0.6, 0.14] });
  return { id: `chapter-${level}`, beats };
}

const INTERLUDES: readonly (readonly (CutsceneData | null)[])[] = SLEEPERS.map((_, level) => [
  level === 0 ? null : chapter(level), // the night's opening is the first level's card
  stir(level, 1),
  stir(level, 2),
]);

/**
 * The interlude that plays as stage `stage` of `level` begins after the one before it, or null
 * (the first level's first stage: the opening has just played).
 */
export function interludeFor(level: number, stage: number): CutsceneData | null {
  return INTERLUDES[level]?.[stage] ?? null;
}
