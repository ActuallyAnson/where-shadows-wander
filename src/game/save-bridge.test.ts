// The game's saves through the bridge: written on events only, and read back after a quit so the
// night resumes at the right puzzle with every solution found. The store here is a stand-in with
// the save service's behaviour (changes are marked, `flush` writes them, a reopen reads what was
// written); pure code may not import the service itself.
import { describe, expect, it } from 'vitest';
import { Game } from './game';
import { Headless } from './headless';
import { LEDGE_TOP } from './puzzles/bedroom';
import { createNight } from './puzzles/index';
import { NIGHT_CHAPTER, SaveBridge, saveStateFrom, type SaveStore } from './save-bridge';

interface Data {
  progress: { chapter: number; puzzle: number; chaptersCompleted: number[] };
  puzzles: Record<string, { solved: boolean; solutions: string[] }>;
}

/** Storage that outlives the store, as localStorage outlives the page. */
class Disk {
  saved: string | null = null;
}

/** Behaves like SaveManager for the calls the bridge makes: changes are marked, `flush` writes them. */
class FakeSaveStore implements SaveStore {
  data: Data;
  dirty = false;
  calls = 0;
  failWrites = false;

  constructor(readonly disk: Disk) {
    this.data = disk.saved
      ? (JSON.parse(disk.saved) as Data)
      : { progress: { chapter: 1, puzzle: 0, chaptersCompleted: [] }, puzzles: {} };
  }

  setProgress(chapter: number, puzzle: number): boolean {
    this.calls++;
    const p = this.data.progress;
    if (p.chapter !== chapter || p.puzzle !== puzzle) {
      p.chapter = chapter;
      p.puzzle = puzzle;
      this.dirty = true;
    }
    return true;
  }

  puzzleEnded(
    puzzleId: string,
    outcome: { solved: boolean; solutionId?: string; next?: { chapter: number; puzzle: number } },
  ): boolean {
    this.calls++;
    const rec = (this.data.puzzles[puzzleId] ??= { solved: false, solutions: [] });
    rec.solved = true;
    if (outcome.solutionId && !rec.solutions.includes(outcome.solutionId)) rec.solutions.push(outcome.solutionId);
    if (outcome.next) this.setProgress(outcome.next.chapter, outcome.next.puzzle);
    this.dirty = true;
    return this.flush();
  }

  completeChapter(chapter: number): boolean {
    this.calls++;
    if (!this.data.progress.chaptersCompleted.includes(chapter)) this.data.progress.chaptersCompleted.push(chapter);
    this.dirty = true;
    return true;
  }

  flush(): boolean {
    if (this.failWrites) return false;
    if (this.dirty) this.disk.saved = JSON.stringify(this.data);
    this.dirty = false;
    return true;
  }
}

const BRIDGE_Y = LEDGE_TOP - 0.01;
const ids = createNight().map((p) => p.id);

/** A session: the store opened from `disk`, a game resumed from it, and the bridge between them. */
function open(disk: Disk) {
  const store = new FakeSaveStore(disk);
  const h = new Headless({ puzzles: createNight(), save: saveStateFrom(store, ids) });
  const bridge = new SaveBridge(store, h.game);
  // The app calls bridge.update() after every game frame; the headless run calls `each` before the
  // next frame, while the last frame's events are still queued.
  const each = () => bridge.update();
  return { store, h, bridge, each };
}

describe('save bridge', () => {
  it('starts a first night at the first puzzle with nothing found', () => {
    const { h } = open(new Disk());
    expect(h.game.puzzle.id).toBe('n1-books');
    expect(h.game.save.solutions).toEqual({});
  });

  it('resumes after a quit mid-puzzle at that puzzle, with the solutions found', () => {
    const disk = new Disk();
    const a = open(disk);
    a.h.pose('right', 'flat', 0, BRIDGE_Y);
    expect(a.h.runUntil(() => a.h.game.puzzle.id === 'n2-drip', 30, a.each)).toBe(true);
    // A few seconds into the drips, then the headset comes off: the service's hooks flush.
    a.h.hide('right').run(3, a.each);
    a.store.flush();

    const b = open(disk);
    expect(b.h.game.puzzle.id).toBe('n2-drip');
    expect(b.h.game.save.solutions).toEqual({ 'n1-books': ['bridge'] });
    expect(b.store.data.puzzles['n1-books']).toEqual({ solved: true, solutions: ['bridge'] });
  });

  it('writes a solved puzzle at once, without waiting for a flush', () => {
    const disk = new Disk();
    const a = open(disk);
    a.h.pose('right', 'flat', 0, BRIDGE_Y);
    expect(a.h.runUntil(() => a.h.saw('puzzle-solved'), 30, a.each)).toBe(true);
    a.h.run(0.1, a.each);
    // No flush: the page could be killed now and the solution would still be on disk.
    expect(JSON.parse(disk.saved!).puzzles['n1-books'].solutions).toEqual(['bridge']);
    expect(a.bridge.writes).toBe(1);
  });

  it('calls the store only on events, never per frame', () => {
    const a = open(new Disk());
    a.h.run(0.1, a.each);
    const calls = a.store.calls;
    // Twenty seconds of the traveller waiting at the gap: frames, but no events worth saving.
    a.h.run(20, a.each);
    expect(a.store.calls).toBe(calls);
  });

  it('records the night as finished, and a reopened game knows it', () => {
    const disk = new Disk();
    const store = new FakeSaveStore(disk);
    store.data.progress.puzzle = 4;
    const h = new Headless({ puzzles: createNight(), save: saveStateFrom(store, ids) });
    const bridge = new SaveBridge(store, h.game);
    h.pose('right', 'fist', -0.3, 0.07);
    expect(
      h.runUntil(
        () => h.saw('chapter-complete'),
        50,
        () => bridge.update(),
      ),
    ).toBe(true);
    h.run(0.1, () => bridge.update());
    expect(store.data.progress.chaptersCompleted).toEqual([NIGHT_CHAPTER]);
    const again = new Game({ puzzles: createNight(), save: saveStateFrom(new FakeSaveStore(disk), ids) });
    expect(again.complete).toBe(true);
  });

  it('keeps playing when storage fails, and counts the failed writes', () => {
    const a = open(new Disk());
    a.store.failWrites = true;
    a.h.pose('right', 'flat', 0, BRIDGE_Y);
    expect(a.h.runUntil(() => a.h.game.puzzle.id === 'n2-drip', 30, a.each)).toBe(true);
    expect(a.bridge.failedWrites).toBe(1);
  });

  it('ignores a resume point in another chapter', () => {
    const store = new FakeSaveStore(new Disk());
    store.data.progress = { chapter: 2, puzzle: 3, chaptersCompleted: [] };
    expect(saveStateFrom(store, ids).puzzle).toBe(0);
  });
});
