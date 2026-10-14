// The save: loads it once, changes it through small methods, and writes it only on events (never per frame).
// Plain TypeScript; the store and the clock are injected.
//
// Storage layout: two slots, `<prefix>.a` and `<prefix>.b` (prefix `wsw.save`). Each holds an envelope
//   { format: "wsw-save", v, seq, sum, data }  where `data` is the save as a JSON string and `sum` is a checksum
// of `v`, `seq` and `data` together, so a damaged version or sequence number is noticed too.
// A write goes to the slot that does NOT hold the newest valid copy (worked out from what was just read),
// with a sequence number above everything seen, and is read back and compared before it counts. A write cut
// short therefore only ever damages the older copy. Loading takes every slot that is valid, brings older
// versions up with migrations, repairs what is wrong field by field, and merges them, so a damaged, cut-short
// or stale slot costs nothing. A slot that cannot be read is kept (up to three different damaged copies per slot
// under `<prefix>.corrupt.*`). A save from a NEWER game version is never written over: the session is
// read-only, and `reset()` first moves it aside to `<prefix>.newer.*`. If a slot cannot even be read (the store
// throws), nothing is written that session, since the newest copy might be the one that cannot be seen.
//
// Honest limits: localStorage is shared by every tab and there is no lock, so two tabs saving in the same
// instant can still lose one of the updates (the loser's next change saves it again); the merge makes this rare,
// not impossible. A player who clears site data loses the save, and nothing here can prevent that.
import { checksum } from './checksum';
import { mergeData } from './merge';
import { MIGRATIONS, migrate, type Migration } from './migrations';
import {
  CURRENT_VERSION,
  LIMITS,
  SANITIZERS,
  SAVE_FORMAT,
  defaultData,
  isValidId,
  type DeepReadonly,
  type Sanitized,
  type SaveData,
} from './schema';
import { repairSettings, settingsEqual, type Settings } from '../settings/settings';
import type { KeyValueStore } from './storage';

/** Sequence numbers above this are refused as damage, so `seq + 1` can never stop changing the number. */
export const MAX_SEQ = 1_000_000_000;

/** The storage keys for a prefix (the game uses `wsw.save`; mock mode uses its own so it never touches a real save). */
export function saveKeys(prefix = 'wsw.save') {
  return {
    slots: [`${prefix}.a`, `${prefix}.b`] as const,
    /** One of three places for a damaged slot's text, chosen by the text, so different damage is kept side by side. */
    corrupt: (slot: number, raw: string) => `${prefix}.corrupt.${'ab'[slot]}.${checksum(raw).charCodeAt(0) % 3}`,
    newer: (slot: number) => `${prefix}.newer.${'ab'[slot]}`,
  };
}

export interface SaveStatus {
  /** The last write reached storage that survives the page. False for a memory-only save, a failing store or a read-only session. */
  persistent: boolean;
  /** 'other-slot': one slot was unreadable and the other loaded. 'fresh': nothing readable, started new (the old data is kept under `<prefix>.corrupt.*`). */
  recovered: 'none' | 'other-slot' | 'fresh';
  /** A save from a newer game version was found; it is left untouched and this session is not saved (until `reset()`). */
  newerVersion: boolean;
  /** Fields or entries repaired or dropped while loading the newest slot. */
  repairs: number;
  writes: number;
  lastError: string | null;
}

export interface SaveManagerOptions {
  store: KeyValueStore;
  /** Storage key prefix. */
  prefix?: string;
  /** ms since 1970. */
  now?: () => number;
  /** The local date, "YYYY-MM-DD". */
  today?: () => string;
  /** Called with a short message when something goes wrong; the save carries on regardless. */
  onError?: (message: string) => void;
  /** For tests: pretend the schema is at another version, with its own migration steps and readers. */
  version?: number;
  migrations?: Readonly<Record<number, Migration>>;
  sanitizers?: Readonly<Record<number, (raw: unknown, fallbackNow: number) => Sanitized | null>>;
}

type SlotRead =
  | { kind: 'empty' }
  | { kind: 'unreadable' }
  | { kind: 'valid'; seq: number; data: SaveData; repairs: number }
  | { kind: 'newer'; seq: number; version: number; raw: string; slot: number }
  | { kind: 'corrupt'; reason: string; raw: string };

export interface PuzzleOutcome {
  solved: boolean;
  /** Which solution the player found, if solved. */
  solutionId?: string;
  /** Where to resume after this puzzle. Ignored if the puzzle was not solved. */
  next?: { chapter: number; puzzle: number };
}

/** What a look at both slots found. */
interface Scan {
  /** The highest sequence number seen in any slot. */
  maxSeq: number;
  /** The slot to write next: the one that is not holding the newest valid copy. */
  target: number;
  unreadable: boolean;
  newer: Extract<SlotRead, { kind: 'newer' }>[];
  maxReset: number;
}

export class SaveManager {
  readonly status: SaveStatus = {
    persistent: true,
    recovered: 'none',
    newerVersion: false,
    repairs: 0,
    writes: 0,
    lastError: null,
  };
  /** The date last played before today, as it was when `touchDay` first ran ('' for a first visit). Compare with today to tell a new night. */
  previousDay = '';
  private current: SaveData;
  private seq = 0;
  private dirty = false;
  private readOnly = false;
  private touchedDay = false;
  private readonly store: KeyValueStore;
  private readonly keys: ReturnType<typeof saveKeys>;
  private readonly now: () => number;
  private readonly today: () => string;
  private readonly onError: (message: string) => void;
  private readonly version: number;
  private readonly migrations: Readonly<Record<number, Migration>>;
  private readonly sanitizers: NonNullable<SaveManagerOptions['sanitizers']>;

  constructor(options: SaveManagerOptions) {
    this.store = options.store;
    this.keys = saveKeys(options.prefix);
    this.status.persistent = options.store.volatile !== true; // true until a write or read fails
    this.now = options.now ?? (() => Date.now());
    this.today = options.today ?? localDay;
    const report = options.onError;
    // A logger that throws must never break saving.
    this.onError = (message) => {
      try {
        report?.(message);
      } catch {
        // ignore
      }
    };
    this.version = options.version ?? CURRENT_VERSION;
    this.migrations = options.migrations ?? MIGRATIONS;
    this.sanitizers = options.sanitizers ?? SANITIZERS;
    this.current = defaultData(this.now());
  }

  /**
   * The save as it is now, read-only. Read it each time you need it; do not keep a piece of it, since a merge
   * with another tab's save can replace the objects. Change it only through the methods below.
   */
  get data(): DeepReadonly<SaveData> {
    return this.current;
  }

  /** Reads the save from storage. Call once at start. Never throws, and never deletes anything. */
  load(): void {
    const reads = [this.readSlot(0), this.readSlot(1)];
    reads.forEach((r, i) => {
      if (r.kind === 'corrupt') this.keepCorrupt(i, r.raw, r.reason);
    });
    const valid = reads.filter((r): r is Extract<SlotRead, { kind: 'valid' }> => r.kind === 'valid');
    const newer = reads.filter((r): r is Extract<SlotRead, { kind: 'newer' }> => r.kind === 'newer');
    const corrupt = reads.some((r) => r.kind === 'corrupt');
    if (valid.length > 0) {
      valid.sort((a, b) => b.seq - a.seq);
      this.status.repairs = valid[0].repairs; // an older slot's flaws are overwritten by the next write
      this.current = valid.length === 2 ? mergeData(valid[0].data, valid[1].data) : valid[0].data;
      this.status.recovered = corrupt ? 'other-slot' : 'none';
      // Write back anything repaired or merged in, on the next event.
      this.dirty = this.status.repairs > 0 || (valid.length === 2 && !sameData(this.current, valid[0].data));
    } else {
      this.status.recovered = corrupt ? 'fresh' : 'none';
    }
    this.seq = Math.max(0, ...valid.map((r) => r.seq), ...newer.map((r) => r.seq));
    if (newer.length > 0) this.enterReadOnly(newer[0].version);
  }

  // ---- changes (each only marks the save dirty; `flush` writes it) ----

  /** Sets where to resume. Returns false (and changes nothing) for a value that is not a whole number in range. The latest setting wins, even a step back. */
  setProgress(chapter: number, puzzle: number): boolean {
    if (!Number.isInteger(chapter) || chapter < 1 || !Number.isInteger(puzzle) || puzzle < 0) return false;
    const p = this.current.progress;
    if (p.chapter === chapter && p.puzzle === puzzle) return true;
    p.chapter = chapter;
    p.puzzle = puzzle;
    p.at = this.now();
    return this.touch();
  }

  completeChapter(chapter: number): boolean {
    const done = this.current.progress.chaptersCompleted;
    if (!Number.isInteger(chapter) || chapter < 1 || chapter > LIMITS.chapters) return false;
    if (done.includes(chapter)) return true;
    done.push(chapter);
    done.sort((a, b) => a - b);
    return this.touch();
  }

  /** Stores the player's settings (each value repaired into range). Returns false if nothing changed. */
  setSettings(next: Readonly<Settings>): boolean {
    const fixed = repairSettings(next).settings;
    if (settingsEqual(fixed, this.current.settings)) return false;
    this.current.settings = fixed;
    this.current.settingsAt = this.now();
    return this.touch();
  }

  /**
   * Records today as the day last played, and returns the day before ('' for a first visit), so the game can
   * tell a new night from a return the same evening. Call once at start.
   */
  touchDay(): string {
    const day = this.today();
    const before = this.current.progress.lastPlayedDay;
    if (!this.touchedDay) {
      this.touchedDay = true;
      this.previousDay = before;
    }
    if (before !== day) {
      this.current.progress.lastPlayedDay = day;
      this.touch();
    }
    return before;
  }

  /** Adds a creature to the gallery. Returns true if it is new (false for a known one, a bad id, or a full gallery). */
  discoverCreature(id: string): boolean {
    const c = this.current.creatures;
    if (!isValidId(id) || id in c) return false;
    if (Object.keys(c).length >= LIMITS.creatures) {
      this.warn(`the gallery is full (${LIMITS.creatures}); "${id}" was not added`);
      return false;
    }
    c[id] = { discoveredAt: this.now() };
    return this.touch();
  }

  /** Records that a puzzle was solved in a particular way. Returns true if it is a solution not found before. */
  recordSolution(puzzleId: string, solutionId: string): boolean {
    if (!isValidId(puzzleId) || !isValidId(solutionId)) return false;
    const rec = this.puzzleRecord(puzzleId);
    if (!rec) return false;
    const wasSolved = rec.solved;
    rec.solved = true;
    const isNew = !rec.solutions.includes(solutionId) && rec.solutions.length < LIMITS.solutionsPerPuzzle;
    if (isNew) rec.solutions.push(solutionId);
    if (isNew || !wasSolved) this.touch();
    return isNew;
  }

  /**
   * A puzzle ended: record how, move the resume point on, and write the save now. A solved puzzle is always
   * marked solved, even if its solution id is not usable (that is reported, not lost). Returns whether it was written.
   */
  puzzleEnded(puzzleId: string, outcome: PuzzleOutcome): boolean {
    if (outcome.solved) {
      if (outcome.solutionId !== undefined && !isValidId(outcome.solutionId))
        this.warn(`"${outcome.solutionId}" is not a usable solution id; "${puzzleId}" is marked solved without it`);
      if (outcome.solutionId !== undefined && isValidId(outcome.solutionId) && isValidId(puzzleId)) {
        this.recordSolution(puzzleId, outcome.solutionId);
      } else if (isValidId(puzzleId)) {
        const rec = this.puzzleRecord(puzzleId);
        if (rec && !rec.solved) {
          rec.solved = true;
          this.touch();
        }
      }
      if (outcome.next) this.setProgress(outcome.next.chapter, outcome.next.puzzle);
    }
    return this.flush();
  }

  hasCreature(id: string): boolean {
    return id in this.current.creatures;
  }

  isSolved(puzzleId: string): boolean {
    return this.current.puzzles[puzzleId]?.solved === true;
  }

  solutionsFound(puzzleId: string): readonly string[] {
    return this.current.puzzles[puzzleId]?.solutions ?? [];
  }

  // ---- writing ----

  /**
   * Writes the save if it changed. Call when the headset comes off, the page is hidden or a puzzle ends: not per
   * frame. Picks up anything another tab wrote first, so the two merge. Never throws.
   * @returns true if there was nothing to write or the write reached storage and was read back correctly;
   *   false if it did not (a failing store, an unreadable slot, or a read-only session).
   */
  flush(): boolean {
    if (this.readOnly) return false;
    if (!this.dirty) return true;
    const scan = this.scan(true);
    if (scan.newer.length > 0) {
      this.enterReadOnly(scan.newer[0].version);
      return false;
    }
    if (scan.unreadable) {
      this.fail(
        'a save slot could not be read, so nothing is written (the newest copy might be the one that cannot be seen)',
      );
      return false;
    }
    return this.write(scan.maxSeq + 1, scan.target);
  }

  /**
   * Starts over, on the player's request. Both slots are overwritten, and the new save carries a higher reset
   * count so a stale copy (another tab's) cannot bring the old one back. A save from a newer game is first
   * moved aside to `<prefix>.newer.*`, never deleted. Returns whether it was written.
   */
  reset(): boolean {
    const scan = this.scan(false);
    for (const r of scan.newer) {
      try {
        this.store.set(this.keys.newer(r.slot), r.raw);
      } catch (e) {
        this.fail(`could not keep the newer save before starting over: ${e instanceof Error ? e.message : String(e)}`);
        return false;
      }
    }
    const resetCount = Math.max(this.current.resetCount, scan.maxReset) + 1;
    this.current = { ...defaultData(this.now()), resetCount };
    this.readOnly = false;
    this.status.newerVersion = false;
    this.dirty = true;
    const first = this.write(scan.maxSeq + 1, scan.target);
    const second = this.write(scan.maxSeq + 2, 1 - scan.target);
    return first && second;
  }

  // ---- internals ----

  private enterReadOnly(version: number): void {
    if (!this.readOnly) {
      this.warn(`a save from a newer version (${version}) was found; it is left alone and this session is not saved`);
    }
    this.readOnly = true;
    this.dirty = false;
    this.status.newerVersion = true;
    this.status.persistent = false;
    this.status.lastError = `a save from a newer version (${version}) was found; this session is not saved`;
  }

  private puzzleRecord(id: string) {
    const puzzles = this.current.puzzles;
    if (!(id in puzzles)) {
      if (Object.keys(puzzles).length >= LIMITS.puzzles) return null;
      puzzles[id] = { solved: false, solutions: [] };
    }
    return puzzles[id];
  }

  private touch(): boolean {
    this.dirty = true;
    return true;
  }

  /** Reads both slots; if `adopt`, merges what is valid into the save in memory. */
  private scan(adopt: boolean): Scan {
    const out: Scan = { maxSeq: this.seq, target: (this.seq + 1) % 2, unreadable: false, newer: [], maxReset: 0 };
    let newestSeq = -1;
    let newestSlot = -1;
    for (const i of [0, 1]) {
      const r = this.readSlot(i);
      if (r.kind === 'unreadable') out.unreadable = true;
      else if (r.kind === 'corrupt') this.keepCorrupt(i, r.raw, r.reason);
      else if (r.kind === 'newer') {
        out.newer.push(r);
        if (r.seq > newestSeq) [newestSeq, newestSlot] = [r.seq, i];
        out.maxSeq = Math.max(out.maxSeq, r.seq);
      } else if (r.kind === 'valid') {
        if (r.seq > newestSeq) [newestSeq, newestSlot] = [r.seq, i];
        out.maxSeq = Math.max(out.maxSeq, r.seq);
        out.maxReset = Math.max(out.maxReset, r.data.resetCount);
        if (adopt) {
          const merged = mergeData(this.current, r.data);
          if (merged !== this.current && !sameData(merged, this.current)) this.current = merged;
        }
      }
    }
    if (newestSlot >= 0) out.target = 1 - newestSlot;
    return out;
  }

  private write(seq: number, slot: number): boolean {
    this.current.updatedAt = this.now();
    const data = JSON.stringify(this.current);
    const text = JSON.stringify({
      format: SAVE_FORMAT,
      v: this.version,
      seq,
      sum: checksum(sumInput(this.version, seq, data)),
      data,
    });
    const key = this.keys.slots[slot];
    try {
      this.store.set(key, text);
      if (this.store.get(key) !== text) throw new Error('what was written did not read back the same');
    } catch (e) {
      this.fail(`could not write ${key}: ${e instanceof Error ? e.message : String(e)}`);
      return false;
    }
    this.seq = seq;
    this.dirty = false;
    this.status.writes++;
    this.status.persistent = this.store.volatile !== true;
    this.status.lastError = null;
    return true;
  }

  private readSlot(i: number): SlotRead {
    let raw: unknown;
    try {
      raw = this.store.get(this.keys.slots[i]);
    } catch (e) {
      this.fail(`could not read ${this.keys.slots[i]}: ${e instanceof Error ? e.message : String(e)}`);
      return { kind: 'unreadable' };
    }
    if (raw === null || raw === undefined || raw === '') return { kind: 'empty' };
    if (typeof raw !== 'string') return { kind: 'corrupt', reason: 'not text', raw: String(raw) };
    const bad = (reason: string): SlotRead => ({ kind: 'corrupt', reason, raw: raw as string });
    let env: unknown;
    try {
      env = JSON.parse(raw);
    } catch {
      return bad('not valid JSON');
    }
    if (typeof env !== 'object' || env === null) return bad('not an object');
    const e = env as Record<string, unknown>;
    if (e.format !== SAVE_FORMAT) return bad('not a save');
    if (typeof e.v !== 'number' || !Number.isInteger(e.v) || e.v < 1) return bad('bad version');
    if (typeof e.seq !== 'number' || !Number.isInteger(e.seq) || e.seq < 0 || e.seq > MAX_SEQ)
      return bad('bad sequence number');
    if (typeof e.data !== 'string' || typeof e.sum !== 'string' || checksum(sumInput(e.v, e.seq, e.data)) !== e.sum)
      return bad('checksum mismatch');
    if (e.v > this.version) return { kind: 'newer', seq: e.seq, version: e.v, raw, slot: i };
    let parsed: unknown;
    try {
      parsed = JSON.parse(e.data);
    } catch {
      return bad('data is not valid JSON');
    }
    const migrated = migrate(parsed, e.v, this.version, this.migrations);
    if (!migrated.ok) return bad(migrated.reason);
    const sanitizer = this.sanitizers[this.version];
    const clean = sanitizer ? sanitizer(migrated.data, this.now()) : null;
    if (!clean) return bad('data is not an object');
    return { kind: 'valid', seq: e.seq, data: clean.data, repairs: clean.repairs };
  }

  /** Keeps an unreadable slot's text where a later build (or a person) can still get at it. */
  private keepCorrupt(i: number, raw: string, reason: string): void {
    const key = this.keys.corrupt(i, raw);
    try {
      if (this.store.get(key) !== raw) this.store.set(key, raw);
      this.warn(`${this.keys.slots[i]} is unreadable (${reason}); kept as ${key}`);
    } catch (e) {
      this.warn(
        `${this.keys.slots[i]} is unreadable (${reason}) and could not be kept: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  /** Records a problem that does not mean storage is failing (a damaged slot was found). */
  private warn(message: string): void {
    this.status.lastError = message;
    this.onError(message);
  }

  /** Records that storage itself failed. */
  private fail(message: string): void {
    this.status.persistent = false;
    this.warn(message);
  }
}

/** What the checksum covers: the version and sequence number as well as the data. */
function sumInput(v: number, seq: number, data: string): string {
  return `${v}|${seq}|${data}`;
}

function sameData(a: SaveData, b: SaveData): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Today's date in the player's own time zone, "YYYY-MM-DD". */
function localDay(): string {
  const d = new Date();
  const two = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
}
