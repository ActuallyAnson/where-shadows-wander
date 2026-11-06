// The night's puzzles, in play order (GDD "Puzzles": a kid's bedroom, the ground made of the
// shadows of invisible props). The night is five levels, one new idea each, and each level is three
// stages on that idea, each harder than the last: the first stage teaches it, the second asks more
// of it, and the last combines it with an idea from an earlier level. Each puzzle's layout and props
// are written beside it (ADR 0014), and each level's document is in docs/levels/.
//
// The game plays the stages as one flat list (saves, replays and goto count puzzles, not levels);
// each puzzle carries its `level` and `stage`, and the app plays a level's story beats only when the
// level changes.
//
// Adding a stage: write a PuzzleDef in the level's file with its `layout`, `props` and hooks (see
// docs/SIMULATION.md, "Adding a puzzle"), add it to the level's list, and add a headless test that
// solves it each way it should be solvable and checks one way it shouldn't.
import type { PuzzleDef } from '../puzzle';
import { createBooksLevel } from './n1-books';
import { createLedgeLevel } from './n2-ledge';
import { createDripLevel } from './n3-drip';
import { createFanLevel } from './n4-fan';
import { createCastleLevel } from './n5-castle';

/** The night's levels, each a list of its stages in order, freshly made. */
export function createNightLevels(): PuzzleDef[][] {
  return [createBooksLevel(), createLedgeLevel(), createDripLevel(), createFanLevel(), createCastleLevel()];
}

/**
 * The night's puzzles in play order, every stage of every level, each marked with its level and
 * stage, freshly made: pass a new list to each Game (puzzles keep per-game state).
 */
export function createNight(): PuzzleDef[] {
  const night: PuzzleDef[] = [];
  createNightLevels().forEach((stages, level) => stages.forEach((def, stage) => night.push({ ...def, level, stage })));
  return night;
}

export const NIGHT_ID = 'night';
/** How many levels the night has. */
export const LEVEL_COUNT = 5;

/** The index in createNight()'s list of `level`'s first stage. */
export function firstStageOf(level: number): number {
  const levels = createNightLevels();
  if (!(level >= 0 && level < levels.length)) throw new RangeError(`no level ${level}`);
  let i = 0;
  for (let l = 0; l < level; l++) i += levels[l].length;
  return i;
}
