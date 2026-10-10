// The player's progress, as plain JSON-safe data. The game updates it as things happen; Teammate B's
// save service stores it (browser storage, versioned with migrations) and hands it back on launch.
// Plain TypeScript: no storage access here.
//
// GDD: progress saves immediately; a returning player resumes at the same puzzle; each puzzle
// tracks which solutions were found; discovered creatures live in the gallery.

export const SAVE_VERSION = 1;

export interface SaveState {
  version: typeof SAVE_VERSION;
  /** Chapter id, e.g. "chapter-1". */
  chapter: string;
  /** Index of the puzzle to resume at. */
  puzzle: number;
  /** Per puzzle id: the solution ids found so far, in the order found. */
  solutions: Record<string, string[]>;
  /** Creatures discovered, in the order found (the gallery). */
  creatures: string[];
  chapterComplete: boolean;
}

export function newSave(chapter = 'chapter-1'): SaveState {
  return { version: SAVE_VERSION, chapter, puzzle: 0, solutions: {}, creatures: [], chapterComplete: false };
}

/**
 * Reads untrusted saved data (from storage, maybe an old or damaged version) into a valid SaveState.
 * Anything missing or malformed falls back to a new save's value; it never throws.
 */
export function readSave(data: unknown, chapter = 'chapter-1'): SaveState {
  const save = newSave(chapter);
  if (typeof data !== 'object' || data === null) return save;
  const d = data as Record<string, unknown>;
  // Version 1 is the first; later versions add migrations here, oldest first.
  if (d.version !== SAVE_VERSION) return save;
  if (typeof d.chapter === 'string') save.chapter = d.chapter;
  if (typeof d.puzzle === 'number' && Number.isInteger(d.puzzle) && d.puzzle >= 0) save.puzzle = d.puzzle;
  if (typeof d.solutions === 'object' && d.solutions !== null && !Array.isArray(d.solutions)) {
    for (const [id, list] of Object.entries(d.solutions as Record<string, unknown>)) {
      if (Array.isArray(list)) save.solutions[id] = list.filter((s): s is string => typeof s === 'string');
    }
  }
  if (Array.isArray(d.creatures)) save.creatures = d.creatures.filter((s): s is string => typeof s === 'string');
  save.chapterComplete = d.chapterComplete === true;
  return save;
}

/** Records a solution; @returns true if it is new for that puzzle. */
export function addSolution(save: SaveState, puzzleId: string, solution: string): boolean {
  const list = (save.solutions[puzzleId] ??= []);
  if (list.includes(solution)) return false;
  list.push(solution);
  return true;
}

/** Records a creature; @returns true if it is new. */
export function addCreature(save: SaveState, creature: string): boolean {
  if (save.creatures.includes(creature)) return false;
  save.creatures.push(creature);
  return true;
}
