// Connects the game to the saves service (ADR 0010, src/engine/services/saves): where to resume and
// the solutions found are read from it on launch, and written back when something happens in the
// game, never per frame. Pure code may not import the service, so this talks to `SaveStore`, the
// part of SaveManager it uses (a SaveManager fits it as it is). Plain TypeScript.
//
// What it writes, on the game's events:
//   puzzle-start      the resume point moves to this puzzle (marked to save; the service's hooks
//                     write it when the headset comes off or the page is hidden)
//   puzzle-solved     the puzzle and its solution, and the resume point past it, written at once
//   chapter-complete  the night is finished, written at once
//
// Quitting mid-puzzle resumes at the start of that puzzle, with every solution found so far.

import type { Game } from './game';
import { readSave, type SaveState } from './save-state';

/** The service's number for the night (it numbers chapters from 1). */
export const NIGHT_CHAPTER = 1;

/** The part of SaveManager (src/engine/services/saves/save-manager.ts) the game uses. */
export interface SaveStore {
  readonly data: {
    readonly progress: {
      readonly chapter: number;
      readonly puzzle: number;
      readonly chaptersCompleted: readonly number[];
    };
    readonly puzzles: Readonly<Record<string, { readonly solved: boolean; readonly solutions: readonly string[] }>>;
  };
  setProgress(chapter: number, puzzle: number): boolean;
  puzzleEnded(
    puzzleId: string,
    outcome: { solved: boolean; solutionId?: string; next?: { chapter: number; puzzle: number } },
  ): boolean;
  completeChapter(chapter: number): boolean;
  flush(): boolean;
}

/**
 * The game's SaveState from the service's save: the resume point (only if it is in this night), the
 * solutions found for each of `puzzleIds`, and whether the night was finished.
 */
export function saveStateFrom(store: SaveStore, puzzleIds: readonly string[], chapterId = 'night'): SaveState {
  const d = store.data;
  const solutions: Record<string, string[]> = {};
  for (const id of puzzleIds) {
    const rec = d.puzzles[id];
    if (rec && rec.solutions.length > 0) solutions[id] = [...rec.solutions];
  }
  const inNight = d.progress.chapter === NIGHT_CHAPTER;
  return readSave(
    {
      version: 1,
      chapter: chapterId,
      puzzle: inNight ? d.progress.puzzle : 0,
      solutions,
      creatures: [],
      chapterComplete: d.progress.chaptersCompleted.includes(NIGHT_CHAPTER),
    },
    chapterId,
  );
}

export class SaveBridge {
  /** Writes that reached storage, and that did not (for the diagnostics report). */
  writes = 0;
  failedWrites = 0;

  constructor(
    private readonly store: SaveStore,
    private readonly game: Game,
  ) {}

  /** Once a frame, after game.frame(): saves what this frame's events changed. Writes only on events. */
  update(): void {
    const ev = this.game.events;
    for (let i = 0; i < ev.count; i++) {
      const e = ev.at(i);
      if (e.type === 'puzzle-start') {
        this.store.setProgress(NIGHT_CHAPTER, e.value);
      } else if (e.type === 'puzzle-solved') {
        const index = e.value;
        const id = this.game.puzzleIdAt(index);
        this.count(
          this.store.puzzleEnded(id, {
            solved: true,
            solutionId: e.id,
            next: { chapter: NIGHT_CHAPTER, puzzle: index + 1 },
          }),
        );
      } else if (e.type === 'chapter-complete') {
        this.store.completeChapter(NIGHT_CHAPTER);
        this.count(this.store.flush());
      }
    }
  }

  private count(ok: boolean): void {
    if (ok) this.writes++;
    else this.failedWrites++;
  }
}
