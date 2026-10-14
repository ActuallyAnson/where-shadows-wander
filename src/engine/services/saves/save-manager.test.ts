import { describe, expect, it, vi } from 'vitest';
import { checksum } from './checksum';
import { blockedError, FakeStore, quotaError } from './fake-store';
import { MAX_SEQ, SaveManager, saveKeys, type SaveManagerOptions } from './save-manager';
import { defaultData, CURRENT_VERSION, LIMITS, type SaveData } from './schema';
import { sanitize } from './schema';
import { MemoryStore } from './storage';

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

/** An envelope exactly as the manager writes one, for planting in a store. */
function envelope(data: Partial<SaveData> | object, seq: number, v = CURRENT_VERSION): string {
  const text = JSON.stringify({ ...defaultData(1000), ...data });
  return JSON.stringify({ format: 'wsw-save', v, seq, sum: checksum(`${v}|${seq}|${text}`), data: text });
}
const read = (store: FakeStore, key: string) =>
  JSON.parse(store.map.get(key)!) as { seq: number; v: number; data: string };
const dataIn = (store: FakeStore, key: string) => JSON.parse(read(store, key).data) as SaveData;

describe('loading', () => {
  it('starts a new save, and writes nothing, when storage is empty', () => {
    const store = new FakeStore();
    const m = open(store);
    expect(m.data.progress).toEqual({ chapter: 1, puzzle: 0, chaptersCompleted: [], lastPlayedDay: '', at: 0 });
    expect(m.status).toMatchObject({ recovered: 'none', newerVersion: false, writes: 0 });
    expect(m.flush()).toBe(true);
    expect(store.sets).toEqual([]);
  });

  it('loads a save written earlier, exactly', () => {
    const store = new FakeStore();
    const a = open(store);
    a.setProgress(2, 4);
    a.discoverCreature('rabbit');
    a.recordSolution('c1-p2', 'cup');
    a.flush();
    const b = open(store);
    expect(b.data.progress).toMatchObject({ chapter: 2, puzzle: 4 });
    expect(b.hasCreature('rabbit')).toBe(true);
    expect(b.solutionsFound('c1-p2')).toEqual(['cup']);
    expect(b.isSolved('c1-p2')).toBe(true);
    expect(b.status.recovered).toBe('none');
  });

  it('takes the higher-numbered slot, and merges the older one in so nothing is lost', () => {
    const store = new FakeStore();
    const older = defaultData(1000);
    older.creatures.fox = { discoveredAt: 5 };
    const newer = defaultData(2000);
    newer.progress.chapter = 2;
    store.map.set(SLOT_KEYS[0], envelope(older, 4));
    store.map.set(SLOT_KEYS[1], envelope(newer, 5));
    const m = open(store);
    expect(m.data.progress.chapter).toBe(2);
    expect(m.hasCreature('fox')).toBe(true);
    expect(m.flush()).toBe(true);
    expect(read(store, SLOT_KEYS[0]).seq).toBe(6); // the merged copy goes to the older slot
    expect(dataIn(store, SLOT_KEYS[0]).creatures.fox).toBeDefined();
  });

  it('uses the other slot when the newest is garbage, and keeps the garbage', () => {
    const store = new FakeStore();
    const good = defaultData(1000);
    good.progress.puzzle = 2;
    store.map.set(SLOT_KEYS[0], envelope(good, 4));
    store.map.set(SLOT_KEYS[1], '{"format":"wsw-sa');
    const errors: string[] = [];
    const m = open(store, { onError: (e) => errors.push(e) });
    expect(m.data.progress.puzzle).toBe(2);
    expect(m.status.recovered).toBe('other-slot');
    expect(m.status.persistent).toBe(true); // a damaged slot is not a failing store
    expect(store.map.get(corruptKey(1, '{"format":"wsw-sa'))).toBe('{"format":"wsw-sa');
    expect(errors[0]).toMatch(/wsw\.save\.b is unreadable \(not valid JSON\)/);
  });

  it.each([
    ['a changed character', (e: string) => e.replace('\\"chapter\\":1', '\\"chapter\\":9')],
    ['a cut-off envelope', (e: string) => e.slice(0, e.length - 20)],
    ['an empty object', () => '{}'],
    ['not an object', () => '42'],
    ['a different format', (e: string) => e.replace('wsw-save', 'other')],
    ['a version of 0', (e: string) => e.replace('"v":2', '"v":0')],
    ['a fractional version', (e: string) => e.replace('"v":2', '"v":1.5')],
    ['a negative sequence number', (e: string) => e.replace('"seq":5', '"seq":-5')],
    ['text for the data', (e: string) => e.replace(/"data":".*"\}$/, '"data":5}')],
  ])('treats %s as damaged, recovers from the other slot and keeps the damaged text', (_name, damage) => {
    const store = new FakeStore();
    const good = defaultData(1000);
    good.progress.chapter = 3;
    store.map.set(SLOT_KEYS[0], envelope(good, 4));
    const bad = damage(envelope(defaultData(2000), 5));
    store.map.set(SLOT_KEYS[1], bad);
    const m = open(store);
    expect(m.data.progress.chapter).toBe(3);
    expect(m.status.recovered).toBe('other-slot');
    expect(store.map.get(corruptKey(1, bad))).toBe(bad);
  });

  it('starts fresh, keeping both damaged slots, when neither can be read', () => {
    const store = new FakeStore();
    store.map.set(SLOT_KEYS[0], 'garbage one');
    store.map.set(SLOT_KEYS[1], 'garbage two');
    const m = open(store);
    expect(m.status.recovered).toBe('fresh');
    expect(m.data.progress.chapter).toBe(1);
    expect(store.map.get(corruptKey(0, 'garbage one'))).toBe('garbage one');
    expect(store.map.get(corruptKey(1, 'garbage two'))).toBe('garbage two');
    m.discoverCreature('fox');
    expect(m.flush()).toBe(true);
    expect(open(store).hasCreature('fox')).toBe(true);
  });

  it('repairs a bad field inside a good envelope and writes the repaired copy back', () => {
    const store = new FakeStore();
    const d = defaultData(1000) as unknown as Record<string, unknown>;
    d.progress = { chapter: 'two', puzzle: 3, chaptersCompleted: [], lastPlayedDay: '', at: 0 };
    store.map.set(SLOT_KEYS[0], envelope(d, 2));
    const m = open(store);
    expect(m.status.repairs).toBe(1);
    expect(m.data.progress).toMatchObject({ chapter: 1, puzzle: 3 });
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
  const future = () =>
    envelope(
      { progress: { chapter: 9, puzzle: 0, chaptersCompleted: [], lastPlayedDay: '', at: 0 } },
      8,
      CURRENT_VERSION + 1,
    );

  it('is left exactly as it is: the session plays from defaults and is not saved, and says so', () => {
    const store = new FakeStore();
    const text = future();
    store.map.set(SLOT_KEYS[0], text);
    const m = open(store);
    expect(m.status).toMatchObject({ newerVersion: true, persistent: false });
    expect(m.data.progress.chapter).toBe(1);
    m.discoverCreature('fox');
    expect(m.hasCreature('fox')).toBe(true);
    expect(m.flush()).toBe(false);
    expect(m.puzzleEnded('p', { solved: true, solutionId: 's' })).toBe(false);
    expect(store.sets).toEqual([]);
    expect(store.map.get(SLOT_KEYS[0])).toBe(text);
    expect(hasCorrupt(store)).toBe(false);
  });

  it('also protects it when the other slot holds a current save: the current one loads, nothing is written', () => {
    const store = new FakeStore();
    const mine = defaultData(1000);
    mine.progress.chapter = 2;
    store.map.set(SLOT_KEYS[0], envelope(mine, 4));
    const text = future();
    store.map.set(SLOT_KEYS[1], text);
    const m = open(store);
    expect(m.data.progress.chapter).toBe(2);
    m.setProgress(3, 0);
    expect(m.flush()).toBe(false);
    expect(store.sets).toEqual([]);
    expect(store.map.get(SLOT_KEYS[1])).toBe(text);
  });

  it('becomes read-only when a newer save appears while the page is open (a newer build in another tab)', () => {
    const store = new FakeStore();
    const m = open(store);
    m.discoverCreature('fox');
    m.flush();
    const text = future();
    store.map.set(SLOT_KEYS[0], text); // another tab's newer build writes
    store.sets = [];
    m.discoverCreature('owl');
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
    m.discoverCreature('fox');
    expect(m.flush()).toBe(true);
    expect(open(store).hasCreature('fox')).toBe(true);
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
    const good = defaultData(1000);
    good.progress.chapter = 3;
    store.map.set(SLOT_KEYS[0], envelope(good, 4));
    store.map.set(SLOT_KEYS[1], envelope(defaultData(2000), 5).replace('"v":2', '"v":7'));
    const m = open(store);
    expect(m.status).toMatchObject({ newerVersion: false, recovered: 'other-slot' });
    expect(m.data.progress.chapter).toBe(3);
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
  const v2 = {
    version: 2,
    sanitizers: { 2: sanitize },
    migrations: { 1: (d: unknown) => ({ ...(d as object), creatures: { fox: { discoveredAt: 1 } } }) },
  };

  it('brings an older save up, and writes it back as the newer version', () => {
    const store = new FakeStore();
    store.map.set(SLOT_KEYS[0], envelope(defaultData(1000), 3, 1));
    const m = open(store, v2);
    expect(m.hasCreature('fox')).toBe(true);
    m.setProgress(2, 0);
    m.flush();
    expect(read(store, SLOT_KEYS[0]).v === 2 || read(store, SLOT_KEYS[1]).v === 2).toBe(true);
    expect(open(store, v2).hasCreature('fox')).toBe(true);
  });

  it.each([
    ['a missing step', { version: 2, sanitizers: { 2: sanitize }, migrations: {} }, /no migration from version 1 to 2/],
    [
      'a throwing step',
      {
        version: 2,
        sanitizers: { 2: sanitize },
        migrations: {
          1: () => {
            throw new Error('boom');
          },
        },
      },
      /migration from version 1 failed: boom/,
    ],
  ])('keeps the old save and starts fresh in memory after %s', (_name, extra, message) => {
    const store = new FakeStore();
    const old = envelope(defaultData(1000), 3, 1);
    store.map.set(SLOT_KEYS[0], old);
    const errors: string[] = [];
    const m = open(store, { ...extra, onError: (e) => errors.push(e) });
    expect(m.status.recovered).toBe('fresh');
    expect(errors.join()).toMatch(message);
    expect(store.map.get(corruptKey(0, old))).toBe(old);
  });

  it('a step whose output is not an object is treated as damage, not a crash', () => {
    const store = new FakeStore();
    store.map.set(SLOT_KEYS[0], envelope(defaultData(1000), 3, 1));
    const m = open(store, { version: 2, sanitizers: { 2: sanitize }, migrations: { 1: () => 42 } });
    expect(m.status.recovered).toBe('fresh');
  });
});

describe('writing', () => {
  it('writes only when something changed', () => {
    const store = new FakeStore();
    const m = open(store);
    m.setProgress(1, 0); // already there
    expect(m.flush()).toBe(true);
    expect(store.sets).toEqual([]);
    m.setProgress(1, 1);
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
      m.setProgress(1, i);
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
    m.setProgress(1, 1);
    m.flush(); // seq 1 in slot b
    m.setProgress(1, 2);
    store.distortSet = (_k, v) => v.slice(0, v.length / 2); // the tab dies mid-write
    expect(m.flush()).toBe(false);
    expect(m.status.persistent).toBe(false);
    expect(m.data.progress.puzzle).toBe(2);
    store.distortSet = null;
    expect(open(store).data.progress.puzzle).toBe(1); // the earlier copy survived intact
    expect(m.flush()).toBe(true); // and the next flush tries again
    expect(open(store).data.progress.puzzle).toBe(2);
  });

  it('gives a failed write another go at the next flush, and reports persistent again', () => {
    const store = new FakeStore();
    const m = open(store);
    m.discoverCreature('fox');
    store.setError = () => quotaError();
    expect(m.flush()).toBe(false);
    expect(m.status).toMatchObject({ persistent: false, writes: 0 });
    expect(m.status.lastError).toMatch(/could not write wsw\.save\.b: The quota has been exceeded/);
    expect(m.hasCreature('fox')).toBe(true);
    store.setError = null;
    expect(m.flush()).toBe(true);
    expect(m.status).toMatchObject({ persistent: true, writes: 1, lastError: null });
  });

  it('notices a store that accepts a write without keeping it', () => {
    const store = new FakeStore();
    const m = open(store);
    m.discoverCreature('fox');
    store.distortSet = () => null; // set "succeeds" and stores nothing
    expect(m.flush()).toBe(false);
    expect(m.status.lastError).toMatch(/did not read back the same/);
  });

  it('notices a store that changes what it keeps', () => {
    const store = new FakeStore();
    const m = open(store);
    m.discoverCreature('fox');
    store.distortSet = (_k, v) => v.replace('fox', 'fax');
    expect(m.flush()).toBe(false);
  });

  it('reports not persistent for a memory-only store, but keeps working', () => {
    const m = open(new MemoryStore());
    m.discoverCreature('fox');
    expect(m.flush()).toBe(true);
    expect(m.status.persistent).toBe(false);
    expect(m.status.writes).toBe(1);
    expect(m.hasCreature('fox')).toBe(true);
  });

  it('merges what another tab saved in the meantime, so two tabs never wipe each other', () => {
    const store = new FakeStore();
    const tabA = open(store);
    const tabB = open(store);
    tabA.discoverCreature('fox');
    tabA.recordSolution('c1-p1', 'bridge');
    tabA.flush();
    tabB.discoverCreature('rabbit');
    tabB.setProgress(2, 1);
    tabB.flush();
    const after = open(store);
    expect(after.hasCreature('fox') && after.hasCreature('rabbit')).toBe(true);
    expect(after.solutionsFound('c1-p1')).toEqual(['bridge']);
    expect(after.data.progress).toMatchObject({ chapter: 2, puzzle: 1 });
  });

  it('numbers its writes above anything another tab wrote', () => {
    const store = new FakeStore();
    const tabA = open(store);
    const tabB = open(store);
    for (let i = 0; i < 4; i++) {
      tabA.setProgress(1, i + 1);
      tabA.flush();
    }
    tabB.discoverCreature('fox');
    tabB.flush();
    expect(Math.max(read(store, SLOT_KEYS[0]).seq, read(store, SLOT_KEYS[1]).seq)).toBe(5);
    expect(open(store).hasCreature('fox')).toBe(true);
  });
});

describe('storage that fails', () => {
  it('loads defaults, reports it, and does not throw, when reading throws', () => {
    const store = new FakeStore();
    store.getError = () => blockedError();
    const errors: string[] = [];
    const m = open(store, { onError: (e) => errors.push(e) });
    expect(m.data.progress.chapter).toBe(1);
    expect(m.status.persistent).toBe(false);
    expect(errors[0]).toMatch(/could not read wsw\.save\.a: The operation is insecure/);
  });

  it('plays on from memory, then saves once storage works again', () => {
    const store = new FakeStore();
    store.getError = () => blockedError();
    store.setError = () => blockedError();
    const m = open(store);
    m.discoverCreature('fox');
    m.setProgress(1, 2);
    expect(m.flush()).toBe(false);
    store.getError = null;
    store.setError = null;
    expect(m.flush()).toBe(true);
    const again = open(store);
    expect(again.hasCreature('fox')).toBe(true);
    expect(again.data.progress.puzzle).toBe(2);
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
    m.discoverCreature('fox');
    store.setError = () => quotaError();
    expect(m.flush()).toBe(false);
    store.setError = null;
    expect(m.flush()).toBe(true);
    expect(open(store).hasCreature('fox')).toBe(true);
  });
});

describe('changes', () => {
  it('setProgress refuses what is not a whole number in range', () => {
    const m = open(new FakeStore());
    for (const [c, p] of [
      [0, 0],
      [1, -1],
      [1.5, 0],
      [1, 0.5],
      [NaN, 0],
      [1, NaN],
      [Infinity, 0],
    ] as const)
      expect(m.setProgress(c, p)).toBe(false);
    expect(m.data.progress).toMatchObject({ chapter: 1, puzzle: 0 });
    expect(m.setProgress(3, 2)).toBe(true);
  });

  it('discoverCreature says whether it is new, and refuses bad ids', () => {
    const m = open(new FakeStore());
    expect(m.discoverCreature('rabbit')).toBe(true);
    expect(m.discoverCreature('rabbit')).toBe(false);
    expect(m.discoverCreature('')).toBe(false);
    expect(m.discoverCreature('__proto__')).toBe(false);
    expect(m.discoverCreature('a b')).toBe(false);
    expect(m.discoverCreature('constructor')).toBe(true);
    expect(m.hasCreature('constructor')).toBe(true);
    expect(m.hasCreature('toString')).toBe(false);
  });

  it('stops adding creatures and puzzles at the limits', () => {
    const m = open(new FakeStore());
    for (let i = 0; i < LIMITS.creatures + 5; i++) m.discoverCreature(`c${i}`);
    expect(Object.keys(m.data.creatures)).toHaveLength(LIMITS.creatures);
    for (let i = 0; i < LIMITS.puzzles + 5; i++) m.recordSolution(`p${i}`, 's');
    expect(Object.keys(m.data.puzzles)).toHaveLength(LIMITS.puzzles);
    expect(m.recordSolution('one-more', 's')).toBe(false);
  });

  it('recordSolution says whether the solution is new, marks the puzzle solved, and caps the list', () => {
    const m = open(new FakeStore());
    expect(m.isSolved('p')).toBe(false);
    expect(m.recordSolution('p', 'cup')).toBe(true);
    expect(m.recordSolution('p', 'cup')).toBe(false);
    expect(m.recordSolution('p', 'roof')).toBe(true);
    expect(m.solutionsFound('p')).toEqual(['cup', 'roof']);
    expect(m.isSolved('p')).toBe(true);
    expect(m.recordSolution('', 'x')).toBe(false);
    expect(m.recordSolution('p', 'bad id')).toBe(false);
    for (let i = 0; i < LIMITS.solutionsPerPuzzle + 3; i++) m.recordSolution('q', `s${i}`);
    expect(m.solutionsFound('q')).toHaveLength(LIMITS.solutionsPerPuzzle);
  });

  it('completeChapter keeps a sorted list without repeats', () => {
    const m = open(new FakeStore());
    m.completeChapter(2);
    m.completeChapter(1);
    m.completeChapter(2);
    expect(m.completeChapter(0)).toBe(false);
    expect(m.completeChapter(LIMITS.chapters + 1)).toBe(false);
    expect(m.data.progress.chaptersCompleted).toEqual([1, 2]);
  });

  it('touchDay records today once', () => {
    const store = new FakeStore();
    const m = open(store);
    m.touchDay();
    expect(m.data.progress.lastPlayedDay).toBe('2026-10-11');
    expect(m.flush()).toBe(true);
    const sets = store.sets.length;
    m.touchDay();
    m.flush();
    expect(store.sets.length).toBe(sets);
  });

  it('answers questions about puzzles it has not seen', () => {
    const m = open(new FakeStore());
    expect(m.isSolved('nope')).toBe(false);
    expect(m.solutionsFound('nope')).toEqual([]);
    expect(m.hasCreature('nope')).toBe(false);
  });
});

describe('puzzleEnded', () => {
  it('records the solution, moves the resume point on and writes at once', () => {
    const store = new FakeStore();
    const m = open(store);
    expect(m.puzzleEnded('c1-p1', { solved: true, solutionId: 'flat-bridge', next: { chapter: 1, puzzle: 1 } })).toBe(
      true,
    );
    expect(store.sets).toHaveLength(1);
    const again = open(store);
    expect(again.solutionsFound('c1-p1')).toEqual(['flat-bridge']);
    expect(again.data.progress).toMatchObject({ chapter: 1, puzzle: 1 });
  });

  it('marks a puzzle solved even with no named solution', () => {
    const m = open(new FakeStore());
    m.puzzleEnded('c1-p1', { solved: true });
    expect(m.isSolved('c1-p1')).toBe(true);
    expect(m.solutionsFound('c1-p1')).toEqual([]);
  });

  it('does not move the resume point or record anything when the puzzle was not solved', () => {
    const store = new FakeStore();
    const m = open(store);
    m.puzzleEnded('c1-p1', { solved: false, solutionId: 'x', next: { chapter: 1, puzzle: 5 } });
    expect(m.data.progress.puzzle).toBe(0);
    expect(m.isSolved('c1-p1')).toBe(false);
    expect(store.sets).toEqual([]);
  });

  it('survives bad ids and a bad next without writing nonsense', () => {
    const m = open(new FakeStore());
    expect(m.puzzleEnded('bad id', { solved: true, solutionId: 'x', next: { chapter: 0, puzzle: -1 } })).toBe(true);
    expect(Object.keys(m.data.puzzles)).toEqual([]);
    expect(m.data.progress).toMatchObject({ chapter: 1, puzzle: 0 });
  });

  it('reports false when the write failed, and keeps the result in memory', () => {
    const store = new FakeStore();
    store.setError = () => quotaError();
    const m = open(store);
    expect(m.puzzleEnded('c1-p1', { solved: true, solutionId: 's' })).toBe(false);
    expect(m.isSolved('c1-p1')).toBe(true);
  });
});

describe('reset', () => {
  it('wipes both slots, so an older copy cannot come back', () => {
    const store = new FakeStore();
    const m = open(store);
    m.discoverCreature('fox');
    m.flush();
    m.discoverCreature('rabbit');
    m.flush();
    expect(m.reset()).toBe(true);
    const again = open(store);
    expect(again.hasCreature('fox') || again.hasCreature('rabbit')).toBe(false);
    expect(again.data.progress.chapter).toBe(1);
    expect(dataIn(store, SLOT_KEYS[0]).creatures).toEqual({});
    expect(dataIn(store, SLOT_KEYS[1]).creatures).toEqual({});
  });

  it('does not resurrect the old save when another tab flushes after it', () => {
    const store = new FakeStore();
    const tab = open(store);
    tab.discoverCreature('fox');
    tab.flush();
    tab.reset();
    tab.discoverCreature('owl');
    tab.flush();
    const after = open(store);
    expect(after.hasCreature('owl')).toBe(true);
    expect(after.hasCreature('fox')).toBe(false);
  });
});

describe('no per-frame work', () => {
  it('touches storage only inside load, flush, puzzleEnded and reset', () => {
    const store = new FakeStore();
    const m = open(store);
    const before = store.gets;
    for (let i = 0; i < 1000; i++) {
      m.hasCreature('fox');
      m.isSolved('p');
      m.solutionsFound('p');
      void m.data;
      void m.status;
    }
    expect(store.gets).toBe(before);
    expect(store.sets).toEqual([]);
  });

  it('a burst of changes is one write', () => {
    const store = new FakeStore();
    const m = open(store);
    for (let i = 0; i < 20; i++) m.discoverCreature(`c${i}`);
    m.setProgress(2, 2);
    m.flush();
    expect(store.sets).toHaveLength(1);
  });
});

it('uses the injected clock for timestamps', () => {
  const store = new FakeStore();
  const now = vi.fn(() => 5000);
  const m = new SaveManager({ store, now });
  m.load();
  m.discoverCreature('fox');
  expect(m.data.creatures.fox.discoveredAt).toBe(5000);
  m.flush();
  expect(dataIn(store, SLOT_KEYS[1]).updatedAt).toBe(5000);
});

describe('the slot a write goes to', () => {
  it('never the one holding the newest valid copy, even when the other slot is damaged', () => {
    const store = new FakeStore();
    const good = defaultData(1000);
    good.progress.chapter = 4;
    store.map.set(SLOT_KEYS[0], envelope(good, 4));
    store.map.set(SLOT_KEYS[1], 'damaged (it had seq 5)');
    const m = open(store);
    m.discoverCreature('fox');
    store.distortSet = (_k, v) => v.slice(0, v.length / 2); // a write cut short
    expect(m.flush()).toBe(false);
    expect(store.sets.filter((k) => SLOT_KEYS.includes(k as never))).toEqual([SLOT_KEYS[1]]);
    store.distortSet = null;
    expect(open(store).data.progress.chapter).toBe(4); // the good copy in slot a is intact
  });

  it('is not fooled by a damaged sequence number: the checksum covers it, so the slot is damaged, not newest', () => {
    const store = new FakeStore();
    const four = defaultData(1000);
    four.progress.chapter = 4;
    store.map.set(SLOT_KEYS[0], envelope(four, 4).replace('"seq":4', '"seq":5'));
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
    m.discoverCreature('fox');
    expect(m.flush()).toBe(true);
    const next = Math.max(read(store, SLOT_KEYS[0]).seq, read(store, SLOT_KEYS[1]).seq);
    expect(next).toBe(5);
  });

  it('counts up from the highest sequence number even when two slots have the same one', () => {
    const store = new FakeStore();
    store.map.set(SLOT_KEYS[0], envelope(defaultData(1000), 6));
    store.map.set(SLOT_KEYS[1], envelope(defaultData(1000), 6));
    const m = open(store);
    m.discoverCreature('fox');
    m.flush();
    expect(Math.max(read(store, SLOT_KEYS[0]).seq, read(store, SLOT_KEYS[1]).seq)).toBe(7);
  });
});

describe('a slot that cannot be read', () => {
  it('stops anything being written, because the newest copy might be the one that cannot be seen', () => {
    const store = new FakeStore();
    const a = open(store);
    a.discoverCreature('fox');
    a.flush();
    a.discoverCreature('owl');
    a.flush(); // slot a is now the newest, slot b the one before
    const newest = store.map.get(SLOT_KEYS[0])!;
    store.getError = (k) => (k === SLOT_KEYS[0] ? blockedError() : null);
    const m = open(store);
    m.discoverCreature('bat');
    store.sets = [];
    expect(m.flush()).toBe(false);
    expect(store.sets).toEqual([]);
    expect(m.status.persistent).toBe(false);
    expect(m.hasCreature('bat')).toBe(true); // kept in memory
    expect(store.map.get(SLOT_KEYS[0])).toBe(newest);
    store.getError = null;
    expect(m.flush()).toBe(true); // and it saves once it can see both slots
    expect(open(store).hasCreature('bat')).toBe(true);
  });
});

describe('the resume point', () => {
  it('can go back: replaying an earlier puzzle is not undone by the next save', () => {
    const store = new FakeStore();
    const m = open(store);
    m.setProgress(3, 2);
    m.flush();
    clock += 1000;
    m.setProgress(1, 0);
    m.flush();
    expect(m.data.progress).toMatchObject({ chapter: 1, puzzle: 0 });
    expect(open(store).data.progress).toMatchObject({ chapter: 1, puzzle: 0 });
  });

  it('does not jump while playing when nothing else changed', () => {
    const store = new FakeStore();
    const m = open(store);
    m.setProgress(2, 1);
    m.flush();
    m.setProgress(1, 0);
    m.flush();
    expect(m.data.progress).toMatchObject({ chapter: 1, puzzle: 0 });
  });

  it('takes the latest resume point when two tabs set it', () => {
    const store = new FakeStore();
    const tabA = open(store);
    const tabB = open(store);
    tabA.setProgress(2, 0);
    tabA.flush();
    clock += 1000;
    tabB.setProgress(1, 4);
    tabB.flush();
    expect(open(store).data.progress).toMatchObject({ chapter: 1, puzzle: 4 });
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
    expect(later.data.progress.lastPlayedDay).toBe('2026-10-11');
    later.flush();
    const sameNight = open(store, { today: () => '2026-10-11' });
    expect(sameNight.touchDay()).toBe('2026-10-11');
    expect(sameNight.previousDay).toBe('2026-10-11');
  });
});

describe('puzzleEnded with an unusable solution id', () => {
  it('still marks the puzzle solved and moves on, and reports it', () => {
    const store = new FakeStore();
    const errors: string[] = [];
    const m = open(store, { onError: (e) => errors.push(e) });
    expect(m.puzzleEnded('c1-p2', { solved: true, solutionId: 'Cup Shape', next: { chapter: 1, puzzle: 3 } })).toBe(
      true,
    );
    expect(m.isSolved('c1-p2')).toBe(true);
    expect(m.solutionsFound('c1-p2')).toEqual([]);
    expect(m.data.progress.puzzle).toBe(3);
    expect(errors.join()).toMatch(/"Cup Shape" is not a usable solution id/);
  });
});

describe('starting over', () => {
  it('is not undone by another open tab that still has the old save', () => {
    const store = new FakeStore();
    const tabA = open(store);
    const tabB = open(store);
    tabA.discoverCreature('fox');
    tabA.flush();
    tabB.discoverCreature('owl'); // tab B has only the owl in memory and will merge the fox in
    tabA.reset();
    expect(tabB.flush()).toBe(true);
    const after = open(store);
    expect(after.hasCreature('fox')).toBe(false);
  });

  it('is not undone in the same session when the second write fails', () => {
    const store = new FakeStore();
    const m = open(store);
    m.discoverCreature('fox');
    m.flush();
    m.discoverCreature('owl');
    m.flush();
    let n = 0;
    store.setError = () => (++n === 2 ? quotaError() : null);
    expect(m.reset()).toBe(false);
    store.setError = null;
    m.discoverCreature('bat');
    expect(m.flush()).toBe(true);
    expect(m.hasCreature('fox') || m.hasCreature('owl')).toBe(false);
    const after = open(store);
    expect(after.hasCreature('bat')).toBe(true);
    expect(after.hasCreature('fox') || after.hasCreature('owl')).toBe(false);
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
    real.discoverCreature('fox');
    real.flush();
    const mock = open(store, { prefix: 'wsw.save.mock' });
    expect(mock.hasCreature('fox')).toBe(false);
    mock.discoverCreature('owl');
    mock.flush();
    expect([...store.map.keys()].sort()).toEqual(['wsw.save.b', 'wsw.save.mock.b']);
    expect(open(store).hasCreature('owl')).toBe(false);
  });

  it('does not let callers change the save through data (checked by the compiler)', () => {
    const m = open(new FakeStore());
    // @ts-expect-error data is read-only all the way down
    m.data.progress.chapter = 9;
    // @ts-expect-error nested lists are read-only too
    m.data.progress.chaptersCompleted.push(1);
    expect(true).toBe(true);
  });

  it('a field the version does not know is dropped and counted as a repair', () => {
    const store = new FakeStore();
    store.map.set(SLOT_KEYS[0], envelope({ ...defaultData(1000), futureField: 1 }, 2));
    const m = open(store);
    expect(m.status.repairs).toBe(1);
  });

  it('says when the gallery is full instead of failing silently', () => {
    const errors: string[] = [];
    const m = open(new FakeStore(), { onError: (e) => errors.push(e) });
    for (let i = 0; i < LIMITS.creatures; i++) m.discoverCreature(`c${i}`);
    expect(m.discoverCreature('one-more')).toBe(false);
    expect(errors.join()).toMatch(/the gallery is full/);
  });
});
