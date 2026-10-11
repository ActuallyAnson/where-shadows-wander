# ADR 0009: Saves are two checksummed slots, written only on events

| | |
|---|---|
| Status | Accepted |
| Date | 11 Oct 2026 |

## Context

The GDD promises that returning players resume where they left off, that a gallery of discovered creatures persists, and that each puzzle remembers which solutions were found. All of it lives in the browser. Browser storage can be missing (blocked or private mode), full, or hold a save that was cut short or written by another version of the game, and an old save must always load.

## Decision

`src/engine/services/saves`, plain TypeScript with the store and the clock injected.

1. **Schema** (`schema.ts`). Version 1:

   ```jsonc
   // each slot holds this envelope; `data` is the save as a JSON string; `sum` checksums v, seq and data together
   { "format": "wsw-save", "v": 1, "seq": 42, "sum": "9f3a1c7e", "data": "{...}" }
   // data
   { "createdAt": 1760000000000, "updatedAt": 1760001234567,
     "progress": { "chapter": 1, "puzzle": 3, "chaptersCompleted": [], "lastPlayedDay": "2026-10-11", "at": 1760001200000 },
     "puzzles": { "c1-p2": { "solved": true, "solutions": ["cup", "roof"] } },
     "creatures": { "rabbit": { "discoveredAt": 1760000999000 } },
     "resetCount": 0 }
   ```

   Ids are plain strings the game chooses (letters, digits, `_` and `-`, up to 40 characters), so a new puzzle, solution or creature needs no new version. Lists have limits (200 puzzles, 100 creatures, 20 solutions a puzzle, 50 chapters) so a damaged save cannot grow without bound. Records have no prototype, so an id such as `constructor` is just a key and `__proto__` is refused.
   `progress.chapter` and `puzzle` are where to **resume**, set by the latest `setProgress` (`at` is when), so replaying an earlier puzzle moves it back; what has been finished is in `chaptersCompleted` and `puzzles`.
2. **Two slots; a write goes to the slot that does not hold the newest valid copy**, worked out from the slots just read, with a sequence number above everything seen, and is read back and compared before it counts. A write cut short therefore only ever damages the older copy. The checksum covers `v` and `seq` as well as the data, so a damaged version or sequence number is noticed (sequence numbers above one billion are refused as damage). If a slot cannot be read at all (the store throws), nothing is written that session, since the newest copy might be the one that cannot be seen.
3. **Loading** reads both slots and keeps every valid one: it checks the format, version, sequence number and checksum, brings older data up with migrations, repairs it field by field (`sanitize`: one bad value costs that value, not the save; a field the version does not know is dropped and counted as a repair, which catches a schema change that forgot its migration), and merges the slots, so a stale or damaged slot costs nothing.
4. **Damage is kept, not deleted.** A slot that cannot be read is copied to `<prefix>.corrupt.<slot>.<0-2>` (up to three different damaged copies per slot) and the other slot loads (`status.recovered = 'other-slot'`). If neither loads, the game starts fresh in memory (`'fresh'`) with the damaged text kept. A later, different damage can replace a kept copy that shares its place.
5. **Migrations** (`migrations.ts`): `MIGRATIONS[n]` turns version n into n + 1; version 1 is the first, so the table is empty. **A migration must be total: it must never throw on odd data** (it receives the data as stored, before cleaning; a throw makes that slot count as damaged). After migrating, the current version's reader (`SANITIZERS`) repairs the data. When the schema changes: raise `CURRENT_VERSION`, add the step, add a reader for the new version, add `fixtures/save-v<new>.json` (a file the new version wrote, frozen) and update every `fixtures/save-v<N>.expected.json` (what loading that old file must give today). `save-fixtures.test.ts` loads every fixture, compares the result with its expected file by deep equality, and fails if a fixture, a step or an expected file is missing.
6. **A save from a newer game is never written over**, including one that appears while the page is open (a newer build in another tab): the session turns read-only, `flush()` and `puzzleEnded()` return false and `status.persistent` is false. `reset()` is the way out: it moves the newer save to `<prefix>.newer.<slot>` first (and refuses to start over if that fails), then starts over. A newer slot that is also damaged is just damage.
7. **Storage can fail.** Every call is guarded, including the first touch of `localStorage` (it can throw just to read the property). `browserStore()` returns null if storage is unusable and the game uses a `MemoryStore`; if reads or writes fail later, the save stays in memory and `status.persistent` is false until a write works again, which the next flush tries.
8. **Two tabs merge, and usually do not lose anything.** Before each write the manager re-reads both slots and merges (union of creatures and solutions and finished chapters, the resume point set last, earliest discovery date). There is no lock, so two tabs saving in the same instant can still lose one update (the loser's next change saves it again): this makes it rare, not impossible.
9. **Starting over** (`reset()`) overwrites both slots with a higher `resetCount`; a copy with a higher count replaces one with a lower outright instead of merging, so a stale tab cannot bring the old save back, even if the second write failed.
10. **Writes happen on events, never per frame** (`save-hooks.ts` and `main.ts`): when the visibility signal says paused (headset off, system menu), when the VR session ends (leaving VR does not hide the page, so `main.ts` flushes there), on `pagehide`, when the page becomes hidden, and in `puzzleEnded`. Changes only mark the save dirty, so a burst is one write, and a flush with nothing changed does no storage work. Covering the lantern flame (a pause the GDD saves on) is A's gesture: call `saves.flush()` there.
11. **The Hand Lab (`?mock=1`) keeps its own save** under `wsw.save.mock.*`, so a development session never touches a real one.
12. **The nightly chapter:** `touchDay()` records today and returns the day before; `saves.previousDay` keeps that value, so the game can tell a new night from a return the same evening.

## How teammates use it

`saves` is on the dev handle (`__wsw.saves`) and created in `main.ts`. Read `saves.data` each time you need it (do not keep a piece of it: a merge with another tab's save can replace the objects) and change it only through the methods. For Teammate A's puzzle code: `saves.puzzleEnded('c1-p2', { solved: true, solutionId: 'cup', next: { chapter: 1, puzzle: 3 } })` when a puzzle ends (it writes at once), `saves.discoverCreature('rabbit')` when a creature is found (returns true if new), and `saves.data.progress` to resume (`puzzleEnded` ignores `next` if the puzzle was not solved). For Teammate B's gallery: `saves.hasCreature(id)` and `saves.data.creatures`. `saves.status` (persistent, recovered, newerVersion, repairs, writes, lastError) is in the diagnostics report.

## Consequences

- One save per browser (no player profiles); settings (volumes, tolerance, shadow size) are not in it yet and would arrive as a version 2 migration.
- `localStorage` is shared per origin, so the dev server and the Pages build do not share a save, and a player who clears site data loses it. Nothing here can prevent that.
- Verified in a real browser (`scripts/saves-probe.mjs`, with a synthetic `pagehide` event): a save survives a reload, is written when the page is hidden and when a puzzle ends but not while idle, a damaged newest slot recovers from the other, blocked storage and a full disk do not stop the game. Not verified on a headset: that Pico and Quest browsers keep `localStorage` between sessions and fire `pagehide` or the visibility events when the headset comes off.
