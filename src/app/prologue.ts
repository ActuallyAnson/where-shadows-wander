// The prologue: before the room, a black void, and the story written in white calligraphy that draws itself, page by page, in
// the dark. This file holds the pages and plays them one after another through a CalligraphyView; main.ts hides the room while it
// plays (the `host`) and the Hand Lab's Prologue button starts it. Plain TypeScript apart from the view it is given.

export interface ProloguePage {
  readonly text: string;
  /** Seconds the pen takes to write it, and how long it stays once written. */
  readonly write: number;
  readonly hold: number;
}

/** Seconds the pen takes per character on a page, with a floor. */
const WRITE_PER_CHAR_S = 0.085;
const WRITE_MIN_S = 3.2;
const HOLD_S = 1.4;

const page = (text: string): ProloguePage => ({
  text,
  write: Math.max(WRITE_MIN_S, text.length * WRITE_PER_CHAR_S),
  hold: HOLD_S,
});

/** The finale's pages, in the hall of the great crystal: everything awake, the light home, the room dreaming for the child. */
export const FINALE_PAGES: readonly ProloguePage[] = [
  page('Every sleeper is awake.'),
  page('The light found its way home.'),
  page('Sleep well.'),
];

/** What the reel needs from the scene it plays in (CinematicScene fits). */
export interface ReelScene {
  setReelTime(seconds: number): void;
}

/** The opening reel's length (seconds from its start, after the fade), and the moments its notes play. */
export const REEL_END_S = 21;
/** Seconds after the reel starts before the scene is showing (the fade to black takes this long). */
export const REEL_FADE_S = 0.7;
/**
 * The lullaby notes the reel plays and when (seconds into the scene): as the five lights go out, last sleeper first, the notes fall
 * 4, 3, 2, 1, 0; then, as the ember lights, the first note once, alone.
 */
export const REEL_NOTES: readonly (readonly [number, number])[] = [
  [7.6, 4],
  [8.4, 3],
  [9.2, 2],
  [10.0, 1],
  [10.8, 0],
  [12.2, 0],
];

/**
 * The wordless opening: a short cinematic reel (no pages of text) in which the five sleepers' lights over the castle go out one by
 * one as the little traveller walks in, the sun sinks, an ember lights at its lantern, and the title appears with one line. The
 * scene draws it from the time it is given; this keeps the time, the notes and the way out (it can be skipped at any moment).
 */
export class PrologueReel {
  private onDone: (() => void) | null = null;
  private t = 0;
  private noted = 0;
  private active = false;

  constructor(
    private readonly scene: ReelScene,
    private readonly host: PrologueHost,
    /** Called when a note should sound, with its number. */
    private readonly onNote?: (index: number) => void,
  ) {}

  get playing(): boolean {
    return this.active;
  }

  /** Starts the reel (the room goes dark; one already playing starts over). */
  start(onDone?: () => void): void {
    if (!this.active) this.host.enter();
    this.active = true;
    this.onDone = onDone ?? null;
    this.t = 0;
    this.noted = 0;
    this.scene.setReelTime(0);
  }

  /** Ends it now (a skip), and puts the room back. */
  skip(): void {
    if (this.active) this.finish();
  }

  /** Once per frame. */
  update(dt: number): void {
    if (!this.active) return;
    this.t += dt > 0 ? Math.min(dt, 0.1) : 0;
    const r = this.t - REEL_FADE_S;
    this.scene.setReelTime(r);
    while (this.noted < REEL_NOTES.length && r >= REEL_NOTES[this.noted][0]) {
      this.onNote?.(REEL_NOTES[this.noted][1]);
      this.noted++;
    }
    if (r >= REEL_END_S) this.finish();
  }

  private finish(): void {
    this.active = false;
    this.host.leave();
    const done = this.onDone;
    this.onDone = null;
    done?.();
  }
}

/** Where the browser remembers that the prologue has played once (so it comes only the first time a headset starts the game). */
export const PROLOGUE_SEEN_KEY = 'wsw.prologueSeen';

/** The part of localStorage this uses. */
export interface SeenStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function browserStorage(): SeenStorage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage; // reading the property can throw when blocked
  } catch {
    return null;
  }
}

/** Whether the prologue has played in this browser before (false if the storage is blocked: it plays then, every time). */
export function hasSeenPrologue(storage: SeenStorage | null = browserStorage()): boolean {
  try {
    return storage?.getItem(PROLOGUE_SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

/** Remembers that it has played. */
export function markPrologueSeen(storage: SeenStorage | null = browserStorage()): void {
  try {
    storage?.setItem(PROLOGUE_SEEN_KEY, '1');
  } catch {
    // blocked storage: it just plays again next time
  }
}

/** Seconds of black between two pages. */
export const PAGE_GAP_S = 0.5;
/** Seconds of black before the first page, and after the last. */
export const LEAD_IN_S = 1.5;
export const LEAD_OUT_S = 1;

/** What the prologue needs from the page-drawing side (CalligraphyView fits). */
export interface PageWriter {
  readonly playing: boolean;
  show(text: string, options: { write: number; hold: number; maxEm: number }): void;
  update(dt: number): void;
  clear(): void;
}

/** What it needs from the app: the room hidden while it plays, and shown again after. */
export interface PrologueHost {
  enter(): void;
  leave(): void;
}

/** Seconds a run of pages takes, with its black before and after. */
export function prologueSeconds(pages: readonly ProloguePage[]): number {
  let s = LEAD_IN_S + LEAD_OUT_S;
  pages.forEach((p, i) => {
    s += p.write + p.hold + 1 + (i > 0 ? PAGE_GAP_S : 0); // 1 s is the page's fade out
  });
  return s;
}

export class Prologue {
  private onDone: (() => void) | null = null;
  private index = -1;
  private wait = 0;
  private active = false;

  constructor(
    private readonly writer: PageWriter,
    private readonly host: PrologueHost,
    private readonly pages: readonly ProloguePage[],
    /** Called as each page starts, with its number (a note to play with it, say). */
    private readonly onPage?: (index: number) => void,
  ) {}

  get playing(): boolean {
    return this.active;
  }

  /** Starts the prologue (the room goes dark; a prologue already playing starts over). */
  start(onDone?: () => void): void {
    if (this.active) this.writer.clear();
    else this.host.enter();
    this.active = true;
    this.onDone = onDone ?? null;
    this.index = -1;
    this.wait = LEAD_IN_S;
  }

  /** Ends it now (a skip), and puts the room back. */
  skip(): void {
    if (!this.active) return;
    this.finish();
  }

  /** Once per frame. */
  update(dt: number): void {
    if (!this.active) return;
    this.writer.update(dt);
    if (this.writer.playing) return;
    this.wait -= dt > 0 ? Math.min(dt, 0.1) : 0;
    if (this.wait > 0) return;
    this.index++;
    if (this.index >= this.pages.length) {
      // The last page is gone: a moment of black, then the room.
      if (this.index === this.pages.length) {
        this.wait = LEAD_OUT_S;
        return;
      }
      this.finish();
      return;
    }
    const p = this.pages[this.index];
    this.writer.show(p.text, { write: p.write, hold: p.hold, maxEm: 15 });
    this.onPage?.(this.index);
    this.wait = PAGE_GAP_S;
  }

  private finish(): void {
    this.active = false;
    this.writer.clear();
    this.host.leave();
    const done = this.onDone;
    this.onDone = null;
    done?.();
  }
}
