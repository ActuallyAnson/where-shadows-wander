// Combines two saves into one that has everything in both, so two browser tabs (or a stale copy) can never
// make a creature, a found solution or a finished chapter disappear. The exception is starting over: a copy
// made after more resets wins outright, so a stale tab cannot bring a wiped save back. Plain TypeScript.
import { emptyRecord, LIMITS, type CreatureRecord, type PuzzleRecord, type SaveData } from './schema';

export function mergeData(a: SaveData, b: SaveData): SaveData {
  if (a.resetCount !== b.resetCount) return a.resetCount > b.resetCount ? a : b;
  const puzzles = emptyRecord<PuzzleRecord>();
  for (const src of [a.puzzles, b.puzzles]) {
    for (const id of Object.keys(src)) {
      if (!(id in puzzles) && Object.keys(puzzles).length >= LIMITS.puzzles) continue;
      const have = puzzles[id];
      const add = src[id];
      const solutions = have ? [...have.solutions] : [];
      for (const s of add.solutions)
        if (!solutions.includes(s) && solutions.length < LIMITS.solutionsPerPuzzle) solutions.push(s);
      puzzles[id] = { solved: (have?.solved ?? false) || add.solved, solutions };
    }
  }
  const creatures = emptyRecord<CreatureRecord>();
  for (const src of [a.creatures, b.creatures]) {
    for (const id of Object.keys(src)) {
      if (!(id in creatures) && Object.keys(creatures).length >= LIMITS.creatures) continue;
      const have = creatures[id];
      creatures[id] = { discoveredAt: have ? Math.min(have.discoveredAt, src[id].discoveredAt) : src[id].discoveredAt };
    }
  }
  // The resume point is where the player last was, not how far they have been: the latest setting wins (a
  // replay of chapter 1 must not jump back to chapter 3). Chapters finished are a union.
  const resume = resumesLater(a, b) ? a.progress : b.progress;
  const done = [...new Set([...a.progress.chaptersCompleted, ...b.progress.chaptersCompleted])].sort((x, y) => x - y);
  return {
    createdAt: Math.min(a.createdAt, b.createdAt),
    updatedAt: Math.max(a.updatedAt, b.updatedAt),
    progress: {
      chapter: resume.chapter,
      puzzle: resume.puzzle,
      chaptersCompleted: done.slice(0, LIMITS.chapters),
      lastPlayedDay:
        a.progress.lastPlayedDay > b.progress.lastPlayedDay ? a.progress.lastPlayedDay : b.progress.lastPlayedDay,
      at: Math.max(a.progress.at, b.progress.at),
    },
    puzzles,
    creatures,
    resetCount: a.resetCount,
    // The settings changed last win, whole (mixing two copies' values would give a combination nobody chose).
    settings: a.settingsAt >= b.settingsAt ? a.settings : b.settings,
    settingsAt: Math.max(a.settingsAt, b.settingsAt),
  };
}

/** True if `a`'s resume point was set later than `b`'s; on a tie, the further one (so the result does not depend on the order). */
function resumesLater(a: SaveData, b: SaveData): boolean {
  if (a.progress.at !== b.progress.at) return a.progress.at > b.progress.at;
  return a.progress.chapter !== b.progress.chapter
    ? a.progress.chapter > b.progress.chapter
    : a.progress.puzzle >= b.progress.puzzle;
}
