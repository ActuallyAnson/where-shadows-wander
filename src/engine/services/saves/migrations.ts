// Steps that bring an older save's data up to the current version, one version at a time. Plain TypeScript.
//
// MIGRATIONS[n] turns version-n data into version n + 1. Version 1 is the first, so the table is empty. A step
// receives the data as it was stored, before any cleaning, and MUST BE TOTAL: it must never throw on odd data
// (a throw makes that slot count as damaged). When the schema changes: raise CURRENT_VERSION, add
// MIGRATIONS[old], a reader for the new version in SANITIZERS (schema.ts), a frozen fixtures/save-v<new>.json,
// and update the save-v<N>.expected.json files; save-fixtures.test.ts fails if any is missing or wrong.
import { CURRENT_VERSION } from './schema';

export type Migration = (data: unknown) => unknown;

export const MIGRATIONS: Readonly<Record<number, Migration>> = {};

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
