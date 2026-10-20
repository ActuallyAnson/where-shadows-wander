// What a save holds (version 2) and how to repair what was read back. Plain TypeScript, no browser.
//
// Ids are plain strings the game chooses (a puzzle "c1-p2", a solution "cup", a creature "rabbit"), so adding a
// puzzle, solution or creature never needs a new version. A new FIELD does: bump CURRENT_VERSION, add a step
// to migrations.ts and a frozen fixture (fixtures/save-v<N>.json), and a test fails if any of those is missing.

import { DEFAULT_SETTINGS, repairSettings, type Settings } from '../settings/settings';

export const SAVE_FORMAT = 'wsw-save';
export const CURRENT_VERSION = 2;

export interface SaveProgress {
  /** The chapter to resume (1 is the first). */
  chapter: number;
  /** The puzzle to resume within it (0 is the first). */
  puzzle: number;
  /** Chapters the player has finished. */
  chaptersCompleted: number[];
  /** The local date last played, "YYYY-MM-DD", or "" if never (for the nightly chapter). */
  lastPlayedDay: string;
  /** When the resume point was last set, ms since 1970 (0 if never): the latest setting wins when two copies merge. */
  at: number;
}

export interface PuzzleRecord {
  solved: boolean;
  /** Solutions found, in the order found. */
  solutions: string[];
}

export interface CreatureRecord {
  /** When it joined the gallery, ms since 1970. */
  discoveredAt: number;
}

export interface SaveData {
  createdAt: number;
  updatedAt: number;
  progress: SaveProgress;
  puzzles: Record<string, PuzzleRecord>;
  creatures: Record<string, CreatureRecord>;
  /** How many times the player has started over. A copy with a higher count replaces one with a lower, so a reset is not undone by a stale copy (a merge would bring it back). */
  resetCount: number;
  /** The accessibility settings (version 2). */
  settings: Settings;
  /** When the settings last changed, ms since 1970 (0 if never): the latest change wins when two copies merge. */
  settingsAt: number;
}

/** Everything in T, read-only all the way down: callers change the save only through SaveManager's methods. */
export type DeepReadonly<T> = T extends readonly (infer U)[]
  ? readonly DeepReadonly<U>[]
  : T extends object
    ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
    : T;

/** Limits, so a damaged or hand-edited save cannot grow without bound. */
export const LIMITS = { puzzles: 200, creatures: 100, solutionsPerPuzzle: 20, chapters: 50, idLength: 40 } as const;

const ID = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
const DAY = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export function isValidId(id: unknown): id is string {
  return typeof id === 'string' && id.length <= LIMITS.idLength && ID.test(id);
}

/** A record with no prototype, so an id such as "__proto__" or "constructor" is just a key. */
export function emptyRecord<T>(): Record<string, T> {
  return Object.create(null) as Record<string, T>;
}

export function defaultData(now: number): SaveData {
  return {
    createdAt: now,
    updatedAt: now,
    progress: { chapter: 1, puzzle: 0, chaptersCompleted: [], lastPlayedDay: '', at: 0 },
    puzzles: emptyRecord(),
    creatures: emptyRecord(),
    resetCount: 0,
    settings: { ...DEFAULT_SETTINGS },
    settingsAt: 0,
  };
}

export interface Sanitized {
  data: SaveData;
  /** How many fields or entries were repaired or dropped. 0 means the input was already exactly right. */
  repairs: number;
}

/**
 * Reads untrusted data (parsed JSON of any shape) into a valid SaveData. Anything wrong is repaired or dropped
 * one field or entry at a time, so one bad value costs that value, never the whole save. `fallbackNow` fills
 * missing timestamps. Returns null only if `raw` is not an object at all.
 */
export function sanitize(raw: unknown, fallbackNow: number): Sanitized | null {
  if (!isObj(raw)) return null;
  let repairs = 0;
  const bad = () => void repairs++;
  // A field this version does not know is dropped and counted: it means a schema change forgot its migration.
  for (const k of Object.keys(raw)) if (!TOP_KEYS.includes(k)) bad();
  const num = (v: unknown, fallback: number): number => {
    if (typeof v === 'number' && Number.isFinite(v) && v >= 0) return v;
    bad();
    return fallback;
  };
  const int = (v: unknown, fallback: number, min: number): number => {
    if (typeof v === 'number' && Number.isInteger(v) && v >= min) return v;
    bad();
    return fallback;
  };

  const createdAt = num(raw.createdAt, fallbackNow);
  let updatedAt = num(raw.updatedAt, createdAt);
  if (updatedAt < createdAt) {
    bad();
    updatedAt = createdAt;
  }
  const p = isObj(raw.progress) ? raw.progress : (bad(), {});
  for (const k of Object.keys(p)) if (!PROGRESS_KEYS.includes(k)) bad();
  const done: number[] = [];
  if (Array.isArray(p.chaptersCompleted)) {
    for (const c of p.chaptersCompleted) {
      if (
        typeof c === 'number' &&
        Number.isInteger(c) &&
        c >= 1 &&
        c <= LIMITS.chapters &&
        done.length < LIMITS.chapters
      ) {
        if (!done.includes(c)) done.push(c);
        else bad();
      } else bad();
    }
    done.sort((a, b) => a - b);
  } else if (p.chaptersCompleted !== undefined) bad();
  const lastPlayedDay = typeof p.lastPlayedDay === 'string' && DAY.test(p.lastPlayedDay) ? p.lastPlayedDay : '';
  if (p.lastPlayedDay !== undefined && p.lastPlayedDay !== '' && lastPlayedDay === '') bad();

  const puzzles = emptyRecord<PuzzleRecord>();
  if (isObj(raw.puzzles)) {
    for (const id of Object.keys(raw.puzzles)) {
      const r = raw.puzzles[id];
      if (!isValidId(id) || !isObj(r) || Object.keys(puzzles).length >= LIMITS.puzzles) {
        bad();
        continue;
      }
      const solutions: string[] = [];
      if (Array.isArray(r.solutions)) {
        for (const s of r.solutions) {
          if (isValidId(s) && !solutions.includes(s) && solutions.length < LIMITS.solutionsPerPuzzle) solutions.push(s);
          else bad();
        }
      } else if (r.solutions !== undefined) bad();
      if (typeof r.solved !== 'boolean') bad();
      puzzles[id] = { solved: r.solved === true, solutions };
    }
  } else if (raw.puzzles !== undefined) bad();

  const creatures = emptyRecord<CreatureRecord>();
  if (isObj(raw.creatures)) {
    for (const id of Object.keys(raw.creatures)) {
      const r = raw.creatures[id];
      if (!isValidId(id) || !isObj(r) || Object.keys(creatures).length >= LIMITS.creatures) {
        bad();
        continue;
      }
      creatures[id] = { discoveredAt: num(r.discoveredAt, updatedAt) };
    }
  } else if (raw.creatures !== undefined) bad();

  // Settings: a save with none (an older one, migrated) gets the defaults without a repair.
  const fixed = repairSettings(raw.settings);
  repairs += fixed.repairs;

  return {
    data: {
      createdAt,
      updatedAt,
      progress: {
        chapter: int(p.chapter, 1, 1),
        puzzle: int(p.puzzle, 0, 0),
        chaptersCompleted: done,
        lastPlayedDay,
        at: num(p.at, 0),
      },
      puzzles,
      creatures,
      resetCount: int(raw.resetCount, 0, 0),
      settings: fixed.settings,
      settingsAt: raw.settingsAt === undefined ? 0 : num(raw.settingsAt, 0),
    },
    repairs,
  };
}

const TOP_KEYS = ['createdAt', 'updatedAt', 'progress', 'puzzles', 'creatures', 'resetCount', 'settings', 'settingsAt'];
const PROGRESS_KEYS = ['chapter', 'puzzle', 'chaptersCompleted', 'lastPlayedDay', 'at'];

/** Reads a version's data into valid SaveData, by version. A schema change adds its version's reader here. */
export const SANITIZERS: Readonly<Record<number, (raw: unknown, fallbackNow: number) => Sanitized | null>> = {
  2: sanitize,
};

type Obj = Record<string, unknown>;
function isObj(v: unknown): v is Obj {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
