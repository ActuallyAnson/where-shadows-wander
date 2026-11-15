import { describe, expect, it, vi } from 'vitest';
import { checksum } from './checksum';
import { blockedError, FakeStore, quotaError } from './fake-store';
import { MAX_SEQ, SaveManager, saveKeys, type SaveManagerOptions } from './save-manager';
import { defaultData, CURRENT_VERSION, type SaveData } from './schema';
import { sanitize } from './schema';
import { MemoryStore } from './storage';
import { DEFAULT_SETTINGS } from '../settings/settings';

const KEYS = saveKeys();
const SLOT_KEYS = KEYS.slots;
const corruptKey = (slot: number, raw: string) => KEYS.corrupt(slot, raw);
const hasCorrupt = (store: FakeStore) => [...store.map.keys()].some((k) => k.includes('.corrupt.'));
let clock = 1_760_000_000_000;
const opts = (store: FakeStore | MemoryStore, extra: Partial<SaveManagerOptions> = {}): SaveManagerOptions => ({
  store,
  now: () => (clock += 10),
  today: () => '2026-10-11',
  ...extra,
});
const open = (store: FakeStore | MemoryStore, extra: Partial<SaveManagerOptions> = {}) => {
  const m = new SaveManager(opts(store, extra));
  m.load();
  return m;
};

/** Changes one setting: the simplest change that gives the save something to write. */
const setVolume = (m: SaveManager, volumeMaster: number) => m.setSettings({ ...m.data.settings, volumeMaster });
const volume = (m: SaveManager) => m.data.settings.volumeMaster;
/** Save data whose settings were changed at `at`. */
const withVolume = (volumeMaster: number, at: number, now = 1000): SaveData => ({
  ...defaultData(now),
  settings: { ...DEFAULT_SETTINGS, volumeMaster },
  settingsAt: at,
});
const withDay = (lastPlayedDay: string, now = 1000): SaveData => ({ ...defaultData(now), lastPlayedDay });

/** An envelope around exactly this data, for planting in a store (any version's shape). */
function rawEnvelope(data: object, seq: number, v: number): string {
  const text = JSON.stringify(data);
  return JSON.stringify({ format: 'wsw-save', v, seq, sum: checksum(`${v}|${seq}|${text}`), data: text });
}
/** An envelope exactly as the manager writes one, for planting in a store. */
function envelope(data: Partial<SaveData> | object, seq: number, v = CURRENT_VERSION): string {
  return rawEnvelope({ ...defaultData(1000), ...data }, seq, v);
}
const read = (store: FakeStore, key: string) =>
  JSON.parse(store.map.get(key)!) as { seq: number; v: number; data: string };
const dataIn = (store: FakeStore, key: string) => JSON.parse(read(store, key).data) as SaveData;

describe('loading', () => {
  it('starts a new save, and writes nothing, when storage is empty', () => {
    const store = new FakeStore();
    const m = open(store);
    expect(m.data.lastPlayedDay).toBe('');
    expect(m.data.resetCount).toBe(0);
    expect(m.data.settings).toEqual(DEFAULT_SETTINGS);
    expect(m.data.settingsAt).toBe(0);
    expect(m.status).toMatchObject({ recovered: 'none', newerVersion: false, writes: 0 });
    expect(m.flush()).toBe(true);
    expect(store.sets).toEqual([]);
  });

  it('loads a save written earlier, exactly', () => {
    const store = new FakeStore();
    const a = open(store);
    setVolume(a, 0.5);
    a.touchDay();
    a.flush();
    const b = open(store);
    expect(volume(b)).toBe(0.5);
    expect(b.data.settingsAt).toBe(a.data.settingsAt);
    expect(b.data.lastPlayedDay).toBe('2026-10-11');
    expect(b.status.recovered).toBe('none');
    expect(b.status.repairs).toBe(0);
  });

  it('takes the higher-numbered slot, and merges the older one in so nothing is lost', () => {
    const store = new FakeStore();
    const older = withVolume(0.5, 3000); // its settings changed after the newer slot's
    const newer = withDay('2026-10-10', 2000);
    store.map.set(SLOT_KEYS[0], envelope(older, 4));
    store.map.set(SLOT_KEYS[1], envelope(newer, 5));
    const m = open(store);
    expect(m.data.lastPlayedDay).toBe('2026-10-10');
    expect(volume(m)).toBe(0.5);
    expect(m.flush()).toBe(true);
    expect(read(store, SLOT_KEYS[0]).seq).toBe(6); // the merged copy goes to the older slot
    expect(dataIn(store, SLOT_KEYS[0])).toMatchObject({ lastPlayedDay: '2026-10-10', settingsAt: 3000 });
    expect(dataIn(store, SLOT_KEYS[0]).settings.volumeMaster).toBe(0.5);
  });

  it('lets a slot with more resets win outright, even when it is the older slot', () => {
    const store = new FakeStore();
    const wiped = { ...defaultData(1000), resetCount: 1 };
    const stale = { ...withVolume(0.5, 3000, 2000), lastPlayedDay: '2026-10-10' };
    store.map.set(SLOT_KEYS[0], envelope(wiped, 4));
    store.map.set(SLOT_KEYS[1], envelope(stale, 5));
    const m = open(store);
    expect(m.data).toMatchObject({ resetCount: 1, lastPlayedDay: '', settingsAt: 0 });
    expect(volume(m)).toBe(DEFAULT_SETTINGS.volumeMaster);
  });

  it('uses the other slot when the newest is garbage, and keeps the garbage', () => {
    const store = new FakeStore();
    store.map.set(SLOT_KEYS[0], envelope(withDay('2026-10-02'), 4));
    store.map.set(SLOT_KEYS[1], '{"format":"wsw-sa');
    const errors: string[] = [];
    const m = open(store, { onError: (e) => errors.push(e) });
    expect(m.data.lastPlayedDay).toBe('2026-10-02');
    expect(m.status.recovered).toBe('other-slot');
    expect(m.status.persistent).toBe(true); // a damaged slot is not a failing store
    expect(store.map.get(corruptKey(1, '{"format":"wsw-sa'))).toBe('{"format":"wsw-sa');
    expect(errors[0]).toMatch(/wsw\.save\.b is unreadable \(not valid JSON\)/);
  });

  it.each([
    ['a changed character', (e: string) => e.replace('\\"resetCount\\":0', '\\"resetCount\\":9')],
    ['a cut-off envelope', (e: string) => e.slice(0, e.length - 20)],
    ['an empty object', () => '{}'],
    ['not an object', () => '42'],
    ['a different format', (e: string) => e.replace('wsw-save', 'other')],
    ['a version of 0', (e: string) => e.replace(`"v":${CURRENT_VERSION}`, '"v":0')],
    ['a fractional version', (e: string) => e.replace(`"v":${CURRENT_VERSION}`, '"v":1.5')],
    ['a negative sequence number', (e: string) => e.replace('"seq":5', '"seq":-5')],
    ['text for the data', (e: string) => e.replace(/"data":".*"\}$/, '"data":5}')],
  ])('treats %s as damaged, recovers from the other slot and keeps the damaged text', (_name, damage) => {
    const store = new FakeStore();
    store.map.set(SLOT_KEYS[0], envelope(withDay('2026-10-03'), 4));
    const good = envelope(defaultData(2000), 5);
    const bad = damage(good);
    expect(bad).not.toBe(good);
    store.map.set(SLOT_KEYS[1], bad);
    const m = open(store);
    expect(m.data.lastPlayedDay).toBe('2026-10-03');
    expect(m.status.recovered).toBe('other-slot');
    expect(store.map.get(corruptKey(1, bad))).toBe(bad);
  });

  it('starts fresh, keeping both damaged slots, when neither can be read', () => {
    const store = new FakeStore();
    store.map.set(SLOT_KEYS[0], 'garbage one');
    store.map.set(SLOT_KEYS[1], 'garbage two');
    const m = open(store);
    expect(m.status.recovered).toBe('fresh');
    expect(m.data.lastPlayedDay).toBe('');
    expect(store.map.get(corruptKey(0, 'garbage one'))).toBe('garbage one');
    expect(store.map.get(corruptKey(1, 'garbage two'))).toBe('garbage two');
    setVolume(m, 0.5);
    expect(m.flush()).toBe(true);
    expect(volume(open(store))).toBe(0.5);
  });

  it('repairs a bad field inside a good envelope and writes the repaired copy back', () => {
    const store = new FakeStore();
    const d = withDay('2026-10-03') as unknown as Record<string, unknown>;
    d.resetCount = 'two';
    store.map.set(SLOT_KEYS[0], envelope(d, 2));
    const m = open(store);
    expect(m.status.repairs).toBe(1);
    expect(m.data).toMatchObject({ resetCount: 0, lastPlayedDay: '2026-10-03' });
    m.flush();
    expect(open(store).status.repairs).toBe(0);
  });

  it('never throws, whatever the store holds', () => {
    for (const junk of ['', ' ', 'null', '[]', '"x"', '{"format":"wsw-save"}', '\u0000', 'x'.repeat(100000)]) {
      const store = new FakeStore();
      store.map.set(SLOT_KEYS[0], junk);
      store.map.set(SLOT_KEYS[1], junk);
      expect(() => open(store)).not.toThrow();
    }
  });
});

describe('a save from a newer version', () => {
  const future = () => envelope({ lastPlayedDay: '2026-12-31' }, 8, CURRENT_VERSION + 1);

  it('is left exactly as it is: the session plays from defaults and is not saved, and says so', () => {
    const store = new FakeStore();
    const text = future();
    store.map.set(SLOT_KEYS[0], text);
    const m = open(store);
    expect(m.status).toMatchObject({ newerVersion: true, persistent: false });
    expect(m.data.lastPlayedDay).toBe('');
    setVolume(m, 0.5);
    expect(volume(m)).toBe(0.5);
    expect(m.flush()).toBe(false);
    expect(store.sets).toEqual([]);
    expect(store.map.get(SLOT_KEYS[0])).toBe(text);
    expect(hasCorrupt(store)).toBe(false);
  });

  it('also protects it when the other slot holds a current save: the current one loads, nothing is written', () => {
    const store = new FakeStore();
    store.map.set(SLOT_KEYS[0], envelope(withDay('2026-10-02'), 4));
    const text = future();
    store.map.set(SLOT_KEYS[1], text);
    const m = open(store);
    expect(m.data.lastPlayedDay).toBe('2026-10-02');
    setVolume(m, 0.5);
    expect(m.flush()).toBe(false);
    expect(store.sets).toEqual([]);
    expect(store.map.get(SLOT_KEYS[1])).toBe(text);
  });

  it('becomes read-only when a newer save appears while the page is open (a newer build in another tab)', () => {
    const store = new FakeStore();
    const m = open(store);
    setVolume(m, 0.5);
    m.flush();
    const text = future();
    store.map.set(SLOT_KEYS[0], text); // another tab's newer build writes
    store.sets = [];
    setVolume(m, 0.3);
    expect(m.flush()).toBe(false);
    expect(m.status).toMatchObject({ newerVersion: true, persistent: false });
    expect(store.sets).toEqual([]);
    expect(store.map.get(SLOT_KEYS[0])).toBe(text);
    expect(m.flush()).toBe(false); // and it stays that way
  });

  it('can be started over on request: the newer save is moved aside, never deleted', () => {
    const store = new FakeStore();
    const text = future();
    store.map.set(SLOT_KEYS[0], text);
    const m = open(store);
    expect(m.reset()).toBe(true);
    expect(store.map.get(KEYS.newer(0))).toBe(text);
    expect(m.status).toMatchObject({ newerVersion: false, persistent: true });
    setVolume(m, 0.5);
    expect(m.flush()).toBe(true);
    expect(volume(open(store))).toBe(0.5);
  });

  it('does not start over if the newer save cannot be moved aside first', () => {
    const store = new FakeStore();
    store.map.set(SLOT_KEYS[0], future());
    const m = open(store);
    store.setError = (k) => (k.includes('.newer.') ? quotaError() : null);
    expect(m.reset()).toBe(false);
    expect(store.map.get(SLOT_KEYS[0])).toBe(future());
  });

  it('a damaged version number is damage, not a newer version: the other slot loads', () => {
    const store = new FakeStore();
    store.map.set(SLOT_KEYS[0], envelope(withDay('2026-10-03'), 4));
    store.map.set(SLOT_KEYS[1], envelope(defaultData(2000), 5).replace(`"v":${CURRENT_VERSION}`, '"v":7'));
    const m = open(store);
    expect(m.status).toMatchObject({ newerVersion: false, recovered: 'other-slot' });
    expect(m.data.lastPlayedDay).toBe('2026-10-03');
  });

  it('a newer slot that is also damaged is kept as damage', () => {
    const store = new FakeStore();
    const bad = future().slice(0, 30);
    store.map.set(SLOT_KEYS[0], bad);
    open(store);
    expect(store.map.get(corruptKey(0, bad))).toBe(bad);
  });
});

describe('migrations through the manager', () => {
  // Pretends the schema is one version further on, with a step that stamps a day into the data.
  const NEXT = CURRENT_VERSION + 1;
  const next = {
    version: NEXT,
    sanitizers: { [NEXT]: sanitize },
    migrations: { [CURRENT_VERSION]: (d: unknown) => ({ ...(d as object), lastPlayedDay: '2026-01-01' }) },
  };

  it('brings an older save up, and writes it back as the newer version', () => {
    const store = new FakeStore();
    store.map.set(SLOT_KEYS[0], envelope(defaultData(1000), 3));
    const m = open(store, next);
    expect(m.data.lastPlayedDay).toBe('2026-01-01');
    setVolume(m, 0.5);
    m.flush();
    expect(read(store, SLOT_KEYS[0]).v === NEXT || read(store, SLOT_KEYS[1]).v === NEXT).toBe(true);
    const again = open(store, next);
    expect(again.data.lastPlayedDay).toBe('2026-01-01');
    expect(volume(again)).toBe(0.5);
  });

  it.each([
    [
      'a missing step',
      { version: NEXT, sanitizers: { [NEXT]: sanitize }, migrations: {} },
      new RegExp(`no migration from version ${CURRENT_VERSION} to ${NEXT}`),
    ],
    [
      'a throwing step',
      {
        version: NEXT,
        sanitizers: { [NEXT]: sanitize },
        migrations: {
          [CURRENT_VERSION]: () => {
            throw new Error('boom');
          },
        },
      },
      new RegExp(`migration from version ${CURRENT_VERSION} failed: boom`),
    ],
  ])('keeps the old save and starts fresh in memory after %s', (_name, extra, message) => {
    const store = new FakeStore();
    const old = envelope(defaultData(1000), 3);
    store.map.set(SLOT_KEYS[0], old);
    const errors: string[] = [];
    const m = open(store, { ...extra, onError: (e) => errors.push(e) });
    expect(m.status.recovered).toBe('fresh');
    expect(errors.join()).toMatch(message);
    expect(store.map.get(corruptKey(0, old))).toBe(old);
  });

  it('a step whose output is not an object is treated as damage, not a crash', () => {
    const store = new FakeStore();
    store.map.set(SLOT_KEYS[0], envelope(defaultData(1000), 3));
    const m = open(store, {
      version: NEXT,
      sanitizers: { [NEXT]: sanitize },
      migrations: { [CURRENT_VERSION]: () => 42 },
    });
    expect(m.status.recovered).toBe('fresh');
  });

  // The real steps: a puzzle-game save (versions 1 and 2) keeps its day last played and its settings.
  const puzzleData = {
    createdAt: 1000,
    updatedAt: 2000,
    progress: { chapter: 3, puzzle: 2, chaptersCompleted: [1, 2], lastPlayedDay: '2026-10-01', at: 1500 },
    puzzles: { 'c1-p2': { solved: true, solutions: ['cup'] } },
    creatures: { fox: { discoveredAt: 1200 } },
    resetCount: 2,
  };

  it('brings a version 2 save up to the current version, dropping the puzzles and keeping settings and day', () => {
    const store = new FakeStore();
    const v2 = { ...puzzleData, settings: { volumeMaster: 0.4, travelScenes: false }, settingsAt: 1800 };
    store.map.set(SLOT_KEYS[0], rawEnvelope(v2, 7, 2));
    const m = open(store);
    expect(m.status).toMatchObject({ recovered: 'none', repairs: 0, newerVersion: false });
    expect(m.data).toMatchObject({ createdAt: 1000, lastPlayedDay: '2026-10-01', resetCount: 2, settingsAt: 1800 });
    expect(m.data.settings).toEqual({ ...DEFAULT_SETTINGS, volumeMaster: 0.4 });
    expect(Object.keys(m.data).sort()).toEqual(Object.keys(defaultData(0)).sort());
    setVolume(m, 0.5);
    expect(m.flush()).toBe(true);
    expect(read(store, SLOT_KEYS[1])).toMatchObject({ v: CURRENT_VERSION, seq: 8 });
    expect(dataIn(store, SLOT_KEYS[1])).not.toHaveProperty('puzzles');
    expect(store.map.get(SLOT_KEYS[0])).toBe(rawEnvelope(v2, 7, 2)); // the old copy is untouched
    expect(open(store).data.lastPlayedDay).toBe('2026-10-01');
  });

  it('brings a version 1 save (no settings yet) up to the current version', () => {
    const store = new FakeStore();
    store.map.set(SLOT_KEYS[0], rawEnvelope(puzzleData, 3, 1));
    const m = open(store);
    expect(m.status).toMatchObject({ recovered: 'none', repairs: 0 });
    expect(m.data).toMatchObject({ lastPlayedDay: '2026-10-01', resetCount: 2, settingsAt: 0 });
    expect(m.data.settings).toEqual(DEFAULT_SETTINGS);
  });
});

describe('writing', () => {
  it('writes only when something changed', () => {
    const store = new FakeStore();
    const m = open(store);
    expect(m.setSettings({ ...m.data.settings })).toBe(false); // already so
    expect(m.flush()).toBe(true);
    expect(store.sets).toEqual([]);
    setVolume(m, 0.5);
    m.flush();
    expect(store.sets).toHaveLength(1);
    m.flush();
    expect(store.sets).toHaveLength(1);
  });

  it('alternates slots, counts up, and never touches the slot holding the newest good copy', () => {
    const store = new FakeStore();
    const m = open(store);
    const newestBefore: number[] = [];
    for (let i = 1; i <= 5; i++) {
      newestBefore.push(Math.max(-1, ...SLOT_KEYS.filter((k) => store.map.has(k)).map((k) => read(store, k).seq)));
      setVolume(m, i / 10);
      m.flush();
      const written = store.sets.at(-1)!;
      const other = SLOT_KEYS.find((k) => k !== written)!;
      if (store.map.has(other)) expect(read(store, other).seq).toBe(newestBefore[i - 1]); // the newest copy is untouched
    }
    expect(store.sets).toEqual([SLOT_KEYS[1], SLOT_KEYS[0], SLOT_KEYS[1], SLOT_KEYS[0], SLOT_KEYS[1]]);
    expect(Math.abs(read(store, SLOT_KEYS[0]).seq - read(store, SLOT_KEYS[1]).seq)).toBe(1);
  });

  it('a write cut short leaves the previous copy, and the game still has the new data in memory', () => {
    const store = new FakeStore();
    const m = open(store);
    setVolume(m, 0.5);
    m.flush(); // seq 1 in slot b
    setVolume(m, 0.3);
    store.distortSet = (_k, v) => v.slice(0, v.length / 2); // the tab dies mid-write
    expect(m.flush()).toBe(false);
    expect(m.status.persistent).toBe(false);
    expect(volume(m)).toBe(0.3);
    store.distortSet = null;
    expect(volume(open(store))).toBe(0.5); // the earlier copy survived intact
    expect(m.flush()).toBe(true); // and the next flush tries again
    expect(volume(open(store))).toBe(0.3);
  });

  it('gives a failed write another go at the next flush, and reports persistent again', () => {
    const store = new FakeStore();
    const m = open(store);
    setVolume(m, 0.5);
    store.setError = () => quotaError();
    expect(m.flush()).toBe(false);
    expect(m.status).toMatchObject({ persistent: false, writes: 0 });
    expect(m.status.lastError).toMatch(/could not write wsw\.save\.b: The quota has been exceeded/);
    expect(volume(m)).toBe(0.5);
    store.setError = null;
    expect(m.flush()).toBe(true);
    expect(m.status).toMatchObject({ persistent: true, writes: 1, lastError: null });
  });

  it('notices a store that accepts a write without keeping it', () => {
    const store = new FakeStore();
    const m = open(store);
    setVolume(m, 0.5);
    store.distortSet = () => null; // set "succeeds" and stores nothing
    expect(m.flush()).toBe(false);
    expect(m.status.lastError).toMatch(/did not read back the same/);
  });

  it('notices a store that changes what it keeps', () => {
    const store = new FakeStore();
    const m = open(store);
    setVolume(m, 0.5);
    store.distortSet = (_k, v) => v.replace('volumeMaster', 'volumeMastex');
    expect(m.flush()).toBe(false);
  });

  it('reports not persistent for a memory-only store, but keeps working', () => {
    const m = open(new MemoryStore());
    setVolume(m, 0.5);
    expect(m.flush()).toBe(true);
    expect(m.status.persistent).toBe(false);
    expect(m.status.writes).toBe(1);
    expect(volume(m)).toBe(0.5);
  });

  it('merges what another tab saved in the meantime, so two tabs never wipe each other', () => {
    const store = new FakeStore();
    const tabA = open(store);
    const tabB = open(store, { today: () => '2026-10-12' });
    setVolume(tabA, 0.5);
    tabA.flush();
    tabB.touchDay();
    tabB.flush();
    const after = open(store);
    expect(volume(after)).toBe(0.5);
    expect(after.data.lastPlayedDay).toBe('2026-10-12');
    expect(volume(tabB)).toBe(0.5); // tab B picked up tab A's change as it wrote
  });

  it('takes the settings changed last when two tabs change them, whichever writes last', () => {
    const store = new FakeStore();
    const tabA = open(store);
    const tabB = open(store);
    setVolume(tabB, 0.3); // changed first...
    clock += 1000;
    setVolume(tabA, 0.5);
    tabA.flush();
    tabB.flush(); // ...but written last
    expect(volume(open(store))).toBe(0.5);
    expect(volume(tabB)).toBe(0.5);
    clock += 1000;
    setVolume(tabB, 0.2);
    tabB.flush();
    expect(volume(open(store))).toBe(0.2);
  });

  it('keeps the latest day played when two tabs disagree', () => {
    const store = new FakeStore();
    const later = open(store, { today: () => '2026-10-12' });
    const earlier = open(store, { today: () => '2026-10-10' });
    later.touchDay();
    later.flush();
    earlier.touchDay();
    earlier.flush();
    expect(open(store).data.lastPlayedDay).toBe('2026-10-12');
  });

  it('numbers its writes above anything another tab wrote', () => {
    const store = new FakeStore();
    const tabA = open(store);
    const tabB = open(store);
    for (let i = 0; i < 4; i++) {
      setVolume(tabA, (i + 1) / 10);
      tabA.flush();
    }
    tabB.touchDay();
    tabB.flush();
    expect(Math.max(read(store, SLOT_KEYS[0]).seq, read(store, SLOT_KEYS[1]).seq)).toBe(5);
    const after = open(store);
    expect(after.data.lastPlayedDay).toBe('2026-10-11');
    expect(volume(after)).toBe(0.4);
  });
});

describe('storage that fails', () => {
  it('loads defaults, reports it, and does not throw, when reading throws', () => {
    const store = new FakeStore();
    store.getError = () => blockedError();
    const errors: string[] = [];
    const m = open(store, { onError: (e) => errors.push(e) });
    expect(m.data.lastPlayedDay).toBe('');
    expect(m.status.persistent).toBe(false);
    expect(errors[0]).toMatch(/could not read wsw\.save\.a: The operation is insecure/);
  });

  it('plays on from memory, then saves once storage works again', () => {
    const store = new FakeStore();
    store.getError = () => blockedError();
    store.setError = () => blockedError();
    const m = open(store);
    setVolume(m, 0.5);
    m.touchDay();
    expect(m.flush()).toBe(false);
    store.getError = null;
    store.setError = null;
    expect(m.flush()).toBe(true);
    const again = open(store);
    expect(volume(again)).toBe(0.5);
    expect(again.data.lastPlayedDay).toBe('2026-10-11');
  });

  it('still recovers when keeping the damaged slot fails too', () => {
    const store = new FakeStore();
    store.map.set(SLOT_KEYS[0], 'garbage');
    store.setError = () => quotaError();
    expect(() => open(store)).not.toThrow();
    expect(open(store).status.recovered).toBe('fresh');
  });

  it('a throwing onError does not break saving', () => {
    const store = new FakeStore();
    const m = open(store, {
      onError: () => {
        throw new Error('logger broke');
      },
    });
    setVolume(m, 0.5);
    store.setError = () => quotaError();
    expect(m.flush()).toBe(false);
    store.setError = null;
    expect(m.flush()).toBe(true);
    expect(volume(open(store))).toBe(0.5);
  });
});

describe('changes', () => {
  it('setSettings repairs each value into range, stamps the time and says whether anything changed', () => {
    const m = open(new FakeStore(), { now: () => 7000 });
    expect(m.setSettings({ ...m.data.settings, volumeMaster: -3, holdTime: 0.43 })).toBe(true);
    expect(m.data.settings).toMatchObject({ volumeMaster: 0, holdTime: 0.4 });
    expect(m.data.settingsAt).toBe(7000);
    expect(m.setSettings({ ...m.data.settings })).toBe(false);
    expect(m.setSettings({ ...m.data.settings, volumeMaster: -1 })).toBe(false); // repairs to the same
  });

  it('touchDay records today once', () => {
    const store = new FakeStore();
    const m = open(store);
    m.touchDay();
    expect(m.data.lastPlayedDay).toBe('2026-10-11');
    expect(m.flush()).toBe(true);
    const sets = store.sets.length;
    m.touchDay();
    m.flush();
    expect(store.sets.length).toBe(sets);
  });
});

describe('reset', () => {
  it('wipes both slots, so an older copy cannot come back', () => {
    const store = new FakeStore();
    const m = open(store, { today: () => '2026-10-10' });
    m.touchDay();
    m.flush();
    setVolume(m, 0.5);
    m.flush();
    expect(m.reset()).toBe(true);
    const again = open(store);
    expect(again.data).toMatchObject({ lastPlayedDay: '', resetCount: 1 });
    expect(dataIn(store, SLOT_KEYS[0])).toMatchObject({ lastPlayedDay: '', resetCount: 1 });
    expect(dataIn(store, SLOT_KEYS[1])).toMatchObject({ lastPlayedDay: '', resetCount: 1 });
  });

  it("keeps the player's settings", () => {
    const store = new FakeStore();
    const m = open(store);
    setVolume(m, 0.5);
    const at = m.data.settingsAt;
    m.touchDay();
    m.flush();
    expect(m.reset()).toBe(true);
    expect(volume(m)).toBe(0.5);
    expect(m.data.settingsAt).toBe(at);
    expect(volume(open(store))).toBe(0.5);
  });

  it('does not resurrect the old save when the same tab flushes after it', () => {
    const store = new FakeStore();
    const tab = open(store);
    tab.touchDay();
    tab.flush();
    tab.reset();
    setVolume(tab, 0.5);
    tab.flush();
    const after = open(store);
    expect(volume(after)).toBe(0.5);
    expect(after.data.lastPlayedDay).toBe('');
  });
});

describe('no per-frame work', () => {
  it('touches storage only inside load, flush and reset', () => {
    const store = new FakeStore();
    const m = open(store);
    const before = store.gets;
    for (let i = 0; i < 1000; i++) {
      void m.data.settings.volumeMaster;
      void m.data.lastPlayedDay;
      void m.status;
      void m.previousDay;
    }
    expect(store.gets).toBe(before);
    expect(store.sets).toEqual([]);
  });

  it('a burst of changes is one write', () => {
    const store = new FakeStore();
    const m = open(store);
    for (let i = 0; i < 10; i++) setVolume(m, i / 10);
    m.touchDay();
    m.flush();
    expect(store.sets).toHaveLength(1);
  });
});

it('uses the injected clock for timestamps', () => {
  const store = new FakeStore();
  const now = vi.fn(() => 5000);
  const m = new SaveManager({ store, now });
  m.load();
  setVolume(m, 0.5);
  expect(m.data.settingsAt).toBe(5000);
  m.flush();
  expect(dataIn(store, SLOT_KEYS[1]).updatedAt).toBe(5000);
});

describe('the slot a write goes to', () => {
  it('never the one holding the newest valid copy, even when the other slot is damaged', () => {
    const store = new FakeStore();
    store.map.set(SLOT_KEYS[0], envelope(withDay('2026-10-04'), 4));
    store.map.set(SLOT_KEYS[1], 'damaged (it had seq 5)');
    const m = open(store);
    setVolume(m, 0.5);
    store.distortSet = (_k, v) => v.slice(0, v.length / 2); // a write cut short
    expect(m.flush()).toBe(false);
    expect(store.sets.filter((k) => SLOT_KEYS.includes(k as never))).toEqual([SLOT_KEYS[1]]);
    store.distortSet = null;
    expect(open(store).data.lastPlayedDay).toBe('2026-10-04'); // the good copy in slot a is intact
  });

  it('is not fooled by a damaged sequence number: the checksum covers it, so the slot is damaged, not newest', () => {
    const store = new FakeStore();
    store.map.set(SLOT_KEYS[0], envelope(withDay('2026-10-04'), 4).replace('"seq":4', '"seq":5'));
    store.map.set(SLOT_KEYS[1], envelope(defaultData(2000), 3));
    const m = open(store);
    expect(m.status.recovered).toBe('other-slot');
    expect(hasCorrupt(store)).toBe(true);
  });

  it.each([
    ['one past the safe limit', MAX_SEQ + 1],
    ['a number too big to add one to', Number.MAX_SAFE_INTEGER + 2],
    ['infinity', Infinity],
  ])('refuses a sequence number of %s as damage', (_name, seq) => {
    const store = new FakeStore();
    store.map.set(SLOT_KEYS[0], envelope(defaultData(1000), 4));
    store.map.set(SLOT_KEYS[1], envelope(defaultData(2000), seq as number));
    const m = open(store);
    expect(m.status.recovered).toBe('other-slot');
    setVolume(m, 0.5);
    expect(m.flush()).toBe(true);
    const next = Math.max(read(store, SLOT_KEYS[0]).seq, read(store, SLOT_KEYS[1]).seq);
    expect(next).toBe(5);
  });

  it('counts up from the highest sequence number even when two slots have the same one', () => {
    const store = new FakeStore();
    store.map.set(SLOT_KEYS[0], envelope(defaultData(1000), 6));
    store.map.set(SLOT_KEYS[1], envelope(defaultData(1000), 6));
    const m = open(store);
    setVolume(m, 0.5);
    m.flush();
    expect(Math.max(read(store, SLOT_KEYS[0]).seq, read(store, SLOT_KEYS[1]).seq)).toBe(7);
  });
});

describe('a slot that cannot be read', () => {
  it('stops anything being written, because the newest copy might be the one that cannot be seen', () => {
    const store = new FakeStore();
    const a = open(store);
    setVolume(a, 0.5);
    a.flush();
    setVolume(a, 0.3);
    a.flush(); // slot a is now the newest, slot b the one before
    const newest = store.map.get(SLOT_KEYS[0])!;
    store.getError = (k) => (k === SLOT_KEYS[0] ? blockedError() : null);
    const m = open(store);
    setVolume(m, 0.2);
    store.sets = [];
    expect(m.flush()).toBe(false);
    expect(store.sets).toEqual([]);
    expect(m.status.persistent).toBe(false);
    expect(volume(m)).toBe(0.2); // kept in memory
    expect(store.map.get(SLOT_KEYS[0])).toBe(newest);
    store.getError = null;
    expect(m.flush()).toBe(true); // and it saves once it can see both slots
    expect(volume(open(store))).toBe(0.2);
  });
});

describe('touchDay', () => {
  it('returns the day before and remembers it, so a new night can be told from a return the same evening', () => {
    const store = new FakeStore();
    const first = open(store, { today: () => '2026-10-10' });
    expect(first.touchDay()).toBe('');
    expect(first.previousDay).toBe('');
    first.flush();
    const later = open(store, { today: () => '2026-10-11' });
    expect(later.touchDay()).toBe('2026-10-10');
    expect(later.previousDay).toBe('2026-10-10');
    expect(later.data.lastPlayedDay).toBe('2026-10-11');
    later.flush();
    const sameNight = open(store, { today: () => '2026-10-11' });
    expect(sameNight.touchDay()).toBe('2026-10-11');
    expect(sameNight.previousDay).toBe('2026-10-11');
  });
});

describe('starting over', () => {
  it('is not undone by another open tab that still has the old save', () => {
    const store = new FakeStore();
    const tabA = open(store);
    const tabB = open(store);
    tabA.touchDay();
    tabA.flush();
    setVolume(tabB, 0.3); // tab B will merge tab A's day in as it writes
    tabA.reset();
    expect(tabB.flush()).toBe(true);
    const after = open(store);
    expect(after.data).toMatchObject({ lastPlayedDay: '', resetCount: 1 });
  });

  it('is not undone in the same session when the second write fails', () => {
    const store = new FakeStore();
    const m = open(store);
    m.touchDay();
    m.flush();
    setVolume(m, 0.5);
    m.flush();
    let n = 0;
    store.setError = () => (++n === 2 ? quotaError() : null);
    expect(m.reset()).toBe(false);
    store.setError = null;
    setVolume(m, 0.3);
    expect(m.flush()).toBe(true);
    expect(m.data.lastPlayedDay).toBe('');
    const after = open(store);
    expect(volume(after)).toBe(0.3);
    expect(after.data).toMatchObject({ lastPlayedDay: '', resetCount: 1 });
  });
});

describe('damaged copies', () => {
  it('keeps different damage side by side instead of overwriting', () => {
    const store = new FakeStore();
    // Two damaged texts that the keying puts in different places.
    const texts: string[] = [];
    for (let i = 0; texts.length < 2 && i < 200; i++) {
      const t = `damaged ${i}`;
      if (texts.every((o) => corruptKey(0, o) !== corruptKey(0, t))) texts.push(t);
    }
    for (const t of texts) {
      store.map.set(SLOT_KEYS[0], t);
      store.map.set(SLOT_KEYS[1], envelope(defaultData(1000), 2));
      open(store);
    }
    expect(texts.map((t) => store.map.get(corruptKey(0, t)))).toEqual(texts);
  });

  it('says it could not keep a damaged slot when keeping it failed', () => {
    const store = new FakeStore();
    store.map.set(SLOT_KEYS[0], 'garbage');
    store.setError = () => quotaError();
    const errors: string[] = [];
    open(store, { onError: (e) => errors.push(e) });
    expect(errors.join()).toMatch(/could not be kept/);
    expect(errors.join()).not.toMatch(/; kept as/);
  });
});

describe('keys and types', () => {
  it('a manager with its own prefix never reads or writes another prefix’s save', () => {
    const store = new FakeStore();
    const real = open(store);
    setVolume(real, 0.5);
    real.flush();
    const mock = open(store, { prefix: 'wsw.save.mock' });
    expect(volume(mock)).toBe(DEFAULT_SETTINGS.volumeMaster);
    setVolume(mock, 0.3);
    mock.flush();
    expect([...store.map.keys()].sort()).toEqual(['wsw.save.b', 'wsw.save.mock.b']);
    expect(volume(open(store))).toBe(0.5);
  });

  it('does not let callers change the save through data (checked by the compiler)', () => {
    const m = open(new FakeStore());
    // @ts-expect-error data is read-only
    m.data.lastPlayedDay = '2026-01-01';
    // @ts-expect-error nested objects are read-only too
    m.data.settings.volumeMaster = 0;
    expect(true).toBe(true);
  });

  it('a field the version does not know is dropped and counted as a repair', () => {
    const store = new FakeStore();
    store.map.set(SLOT_KEYS[0], envelope({ ...defaultData(1000), futureField: 1 }, 2));
    const m = open(store);
    expect(m.status.repairs).toBe(1);
  });
});
