// What a save holds (version 3) and how to repair what was read back. Plain TypeScript, no browser.
//
// Version 3 holds the settings and the day last played; the puzzle game's progress, puzzles and creature gallery
// (versions 1 and 2) went with the puzzles. A new FIELD needs a new version: bump CURRENT_VERSION, add a step to
// migrations.ts and a frozen fixture (fixtures/save-v<N>.json), and a test fails if any of those is missing.

import { DEFAULT_SETTINGS, repairSettings, type Settings } from '../settings/settings';

export const SAVE_FORMAT = 'wsw-save';
export const CURRENT_VERSION = 3;

export interface SaveData {
  createdAt: number;
  updatedAt: number;
  /** The local date last played, "YYYY-MM-DD", or "" if never (to tell a new night from a return the same evening). */
  lastPlayedDay: string;
  /** How many times the player has started over. A copy with a higher count replaces one with a lower, so a reset is not undone by a stale copy (a merge would bring it back). */
  resetCount: number;
  /** The accessibility settings. */
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

const DAY = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export function defaultData(now: number): SaveData {
  return {
    createdAt: now,
    updatedAt: now,
    lastPlayedDay: '',
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
  const lastPlayedDay = typeof raw.lastPlayedDay === 'string' && DAY.test(raw.lastPlayedDay) ? raw.lastPlayedDay : '';
  if (raw.lastPlayedDay !== undefined && raw.lastPlayedDay !== '' && lastPlayedDay === '') bad();

  // Settings: a save with none (an older one, migrated) gets the defaults without a repair.
  const fixed = repairSettings(raw.settings);
  repairs += fixed.repairs;

  return {
    data: {
      createdAt,
      updatedAt,
      lastPlayedDay,
      resetCount: int(raw.resetCount, 0, 0),
      settings: fixed.settings,
      settingsAt: raw.settingsAt === undefined ? 0 : num(raw.settingsAt, 0),
    },
    repairs,
  };
}

const TOP_KEYS = ['createdAt', 'updatedAt', 'lastPlayedDay', 'resetCount', 'settings', 'settingsAt'];

/** Reads a version's data into valid SaveData, by version. A schema change adds its version's reader here. */
export const SANITIZERS: Readonly<Record<number, (raw: unknown, fallbackNow: number) => Sanitized | null>> = {
  3: sanitize,
};

type Obj = Record<string, unknown>;
function isObj(v: unknown): v is Obj {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
