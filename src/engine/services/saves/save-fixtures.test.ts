// Every old save format we ever shipped stays loadable. Each fixtures/save-v<N>.json is a file written by version N,
// frozen (never edit one), with save-v<N>.expected.json what loading it must give in the CURRENT schema (update that
// when the schema changes, and a migration must produce it). When CURRENT_VERSION goes up, add a fixture for the
// new version and a migration step from the old one.
import { describe, expect, it } from 'vitest';
import { MemoryStore } from './storage';
import { MIGRATIONS } from './migrations';
import { SaveManager, saveKeys } from './save-manager';
import { CURRENT_VERSION } from './schema';

const SLOT_KEYS = saveKeys().slots;
const expected = import.meta.glob('./fixtures/save-v*.expected.json', { eager: true, import: 'default' }) as Record<
  string,
  unknown
>;
const files = import.meta.glob('./fixtures/save-v*.json', { eager: true, query: '?raw', import: 'default' }) as Record<
  string,
  string
>;
const byVersion = new Map<number, string>();
for (const [path, text] of Object.entries(files)) {
  if (path.endsWith('.expected.json')) continue;
  byVersion.set(Number(/save-v(\d+)\.json$/.exec(path)![1]), text);
}

describe('save fixtures', () => {
  it('has a fixture for every version up to the current one', () => {
    for (let v = 1; v <= CURRENT_VERSION; v++) expect(byVersion.has(v), `fixtures/save-v${v}.json`).toBe(true);
  });

  it('has no fixture from a version this build does not know', () => {
    for (const v of byVersion.keys()) expect(v).toBeLessThanOrEqual(CURRENT_VERSION);
  });

  it('has a migration step for every version below the current one', () => {
    for (let v = 1; v < CURRENT_VERSION; v++) expect(MIGRATIONS[v]).toBeTypeOf('function');
  });

  for (const [v, text] of byVersion) {
    it(`loads the version ${v} file into the current schema with no repairs`, () => {
      const store = new MemoryStore();
      store.set(SLOT_KEYS[0], text);
      const saves = new SaveManager({ store, now: () => 5 });
      saves.load();
      expect(saves.status).toMatchObject({ recovered: 'none', newerVersion: false, repairs: 0 });
      expect(store.get('wsw.save.corrupt.a')).toBeNull();
    });
  }

  for (const [v] of byVersion) {
    it(`the version ${v} file loads into exactly the data frozen in save-v${v}.expected.json`, () => {
      const want = expected[`./fixtures/save-v${v}.expected.json`];
      expect(want, `fixtures/save-v${v}.expected.json (what loading the old file must give today)`).toBeDefined();
      const store = new MemoryStore();
      store.set(SLOT_KEYS[0], byVersion.get(v)!);
      const saves = new SaveManager({ store });
      saves.load();
      expect(JSON.parse(JSON.stringify(saves.data))).toEqual(want);
    });
  }
});
