// The ways found: every puzzle can be solved in more than one way (the tutorial in one), and the save remembers which ones the player
// has used. The wall mentions that another way exists after a solve, and the end screen counts them, so there is a reason to walk the
// night again. Plain data and functions.

/** The part of a puzzle the journal reads. */
export interface WaysSource {
  readonly id: string;
  readonly solutions: readonly string[];
}

/** The solutions recorded per puzzle id (the save's `solutions`). */
export type FoundSolutions = Readonly<Record<string, readonly string[] | undefined>>;

export interface Ways {
  found: number;
  total: number;
}

/** How many of a puzzle's ways have been found. A way the puzzle does not list (a solution nobody designed) does not count. */
export function waysOf(puzzle: WaysSource, found: FoundSolutions): Ways {
  const have = found[puzzle.id] ?? [];
  return { found: puzzle.solutions.filter((s) => have.includes(s)).length, total: puzzle.solutions.length };
}

/** The ways found across the whole night. */
export function nightWays(puzzles: readonly WaysSource[], found: FoundSolutions): Ways {
  const sum: Ways = { found: 0, total: 0 };
  for (const p of puzzles) {
    const w = waysOf(p, found);
    sum.found += w.found;
    sum.total += w.total;
  }
  return sum;
}

/** What the wall says after a solve: that another way is there to find, or nothing. */
export function anotherWayLine(ways: Ways): string {
  if (ways.total <= 1 || ways.found >= ways.total) return '';
  return ways.total - ways.found === 1 ? 'There is another way through.' : 'There are other ways through.';
}

/** The end screen's line: the ways found, or the old line when the night has not been walked yet. */
export function endLine(ways: Ways, fallback: string): string {
  if (ways.total === 0) return fallback;
  if (ways.found >= ways.total) return 'Every way found. The light is yours to keep.';
  return `${ways.found} of ${ways.total} ways found. The light is yours to keep.`;
}
