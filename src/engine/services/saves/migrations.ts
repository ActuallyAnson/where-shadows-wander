// Steps that bring an older save's data up to the current version, one version at a time. Plain TypeScript.
//
// MIGRATIONS[n] turns version-n data into version n + 1. Version 1 is the first. A step
// receives the data as it was stored, before any cleaning, and MUST BE TOTAL: it must never throw on odd data
// (a throw makes that slot count as damaged). When the schema changes: raise CURRENT_VERSION, add
// MIGRATIONS[old], a reader for the new version in SANITIZERS (schema.ts), a frozen fixtures/save-v<new>.json,
// and update the save-v<N>.expected.json files; save-fixtures.test.ts fails if any is missing or wrong.
import { CURRENT_VERSION } from './schema';

export type Migration = (data: unknown) => unknown;

export const MIGRATIONS: Readonly<Record<number, Migration>> = {
  // 1 to 2: accessibility settings. An old save has none, so it gets an empty block (the reader fills in the defaults).
  1: (data) =>
    typeof data === 'object' && data !== null && !Array.isArray(data) ? { ...data, settings: {}, settingsAt: 0 } : data,
  // 2 to 3: the puzzles went (ADR 0016). Their progress, puzzles and creature gallery are dropped; the day last played
  // moves out of the progress block, and the retired "travel scenes" setting is dropped.
  2: (data) => {
    if (typeof data !== 'object' || data === null || Array.isArray(data)) return data;
    const { progress, puzzles: _puzzles, creatures: _creatures, ...rest } = data as Record<string, unknown>;
    const day =
      typeof progress === 'object' && progress !== null
        ? (progress as Record<string, unknown>).lastPlayedDay
        : undefined;
    let settings = rest.settings;
    if (typeof settings === 'object' && settings !== null && !Array.isArray(settings)) {
      const { travelScenes: _travel, ...kept } = settings as Record<string, unknown>;
      settings = kept;
    }
    return { ...rest, settings, ...(day === undefined ? {} : { lastPlayedDay: day }) };
  },
};

export type MigrateResult = { ok: true; data: unknown } | { ok: false; reason: string };

/** Runs every step from `from` up to `to`. A missing or throwing step is a failure the caller handles, never a wipe. */
export function migrate(
  data: unknown,
  from: number,
  to: number = CURRENT_VERSION,
  table: Readonly<Record<number, Migration>> = MIGRATIONS,
): MigrateResult {
  let current = data;
  for (let v = from; v < to; v++) {
    const step = table[v];
    if (!step) return { ok: false, reason: `no migration from version ${v} to ${v + 1}` };
    try {
      current = step(current);
    } catch (e) {
      return { ok: false, reason: `migration from version ${v} failed: ${e instanceof Error ? e.message : String(e)}` };
    }
  }
  return { ok: true, data: current };
}
