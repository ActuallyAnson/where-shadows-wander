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

/** The story before the night: the room dreams every night; tonight its dreams have sunk too deep; one spark is left to wake them. */
export const PROLOGUE_PAGES: readonly ProloguePage[] = [
  page('When the house holds its breath, the room begins to dream.'),
  page('But tonight the dreams have sunk too deep to wake themselves.'),
  page('One spark is left, small as a held breath.'),
  page('It cannot fly. It can only walk.'),
  page('Give it a road of shadow, and it will wake them, one by one.'),
];

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

/** Seconds the whole prologue takes, with its black before and after. */
export function prologueSeconds(pages: readonly ProloguePage[] = PROLOGUE_PAGES): number {
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
    private readonly pages: readonly ProloguePage[] = PROLOGUE_PAGES,
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
