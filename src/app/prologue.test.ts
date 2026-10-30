import { describe, expect, it } from 'vitest';
import {
  FINALE_PAGES,
  hasSeenPrologue,
  LEAD_IN_S,
  markPrologueSeen,
  PROLOGUE_PAGES,
  Prologue,
  prologueSeconds,
  type PageWriter,
} from './prologue';

/** A page writer that "plays" each page for its write and hold time plus a second of fade. */
function fakeWriter() {
  const shown: string[] = [];
  let left = 0;
  const w: PageWriter & { shown: string[]; cleared: number } = {
    shown,
    cleared: 0,
    get playing() {
      return left > 0;
    },
    show: (text, o) => {
      shown.push(text);
      left = o.write + o.hold + 1;
    },
    update: (dt) => void (left = Math.max(0, left - dt)),
    clear: () => {
      left = 0;
      w.cleared++;
    },
  };
  return w;
}

function setup() {
  const writer = fakeWriter();
  const calls: string[] = [];
  const prologue = new Prologue(writer, { enter: () => calls.push('enter'), leave: () => calls.push('leave') });
  const run = (seconds: number) => {
    for (let t = 0; t < seconds; t += 0.05) prologue.update(0.05);
  };
  return { writer, calls, prologue, run };
}

describe('PROLOGUE_PAGES', () => {
  it('has a few short pages, each readable in a glance and quick enough to write', () => {
    expect(PROLOGUE_PAGES.length).toBeGreaterThanOrEqual(4);
    for (const p of PROLOGUE_PAGES) {
      expect(p.text.length).toBeGreaterThan(10);
      expect(p.text.length).toBeLessThanOrEqual(70);
      expect(p.write).toBeGreaterThanOrEqual(3);
      expect(p.write).toBeLessThanOrEqual(7);
    }
  });

  it('takes about half a minute in all, so it is skippable but not a chore', () => {
    expect(prologueSeconds()).toBeGreaterThan(20);
    expect(prologueSeconds()).toBeLessThan(45);
  });
});

describe('FINALE_PAGES', () => {
  it('ends on the lullaby line, with short pages and a finale of about half a minute or less', () => {
    expect(FINALE_PAGES.length).toBeGreaterThanOrEqual(4);
    expect(FINALE_PAGES[FINALE_PAGES.length - 1].text).toBe('Sleep well.');
    for (const p of FINALE_PAGES) expect(p.text.length).toBeLessThanOrEqual(60);
    expect(prologueSeconds(FINALE_PAGES)).toBeLessThan(40);
  });

  it('plays through the same player as the prologue, page by page', () => {
    const writer = fakeWriter();
    const calls: string[] = [];
    const finale = new Prologue(
      writer,
      { enter: () => calls.push('enter'), leave: () => calls.push('leave') },
      FINALE_PAGES,
    );
    finale.start();
    for (let t = 0; t < prologueSeconds(FINALE_PAGES) + 2; t += 0.05) finale.update(0.05);
    expect(writer.shown).toEqual(FINALE_PAGES.map((p) => p.text));
    expect(calls).toEqual(['enter', 'leave']);
  });
});

describe('Prologue', () => {
  it('darkens the room, waits in the black, writes each page in order and then gives the room back', () => {
    const { writer, calls, prologue, run } = setup();
    let done = false;
    prologue.start(() => (done = true));
    expect(calls).toEqual(['enter']);
    expect(prologue.playing).toBe(true);
    run(LEAD_IN_S - 0.2);
    expect(writer.shown).toHaveLength(0); // still black
    run(prologueSeconds() + 2);
    expect(writer.shown).toEqual(PROLOGUE_PAGES.map((p) => p.text));
    expect(calls).toEqual(['enter', 'leave']);
    expect(done).toBe(true);
    expect(prologue.playing).toBe(false);
  });

  it('can be skipped at once, putting the room back and saying it is done', () => {
    const { writer, calls, prologue, run } = setup();
    let done = 0;
    prologue.start(() => done++);
    run(8);
    prologue.skip();
    expect(calls).toEqual(['enter', 'leave']);
    expect(writer.cleared).toBeGreaterThan(0);
    expect(done).toBe(1);
    prologue.skip(); // nothing to skip now
    expect(done).toBe(1);
  });

  it('starts over, without entering twice, when started while playing', () => {
    const { writer, calls, prologue, run } = setup();
    prologue.start();
    run(10);
    const before = writer.shown.length;
    expect(before).toBeGreaterThan(0);
    prologue.start();
    expect(calls).toEqual(['enter']);
    run(LEAD_IN_S + 0.3);
    expect(writer.shown[before]).toBe(PROLOGUE_PAGES[0].text);
  });
});

describe('the prologue is seen once', () => {
  it('is not seen until it is marked, and then is', () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    };
    expect(hasSeenPrologue(storage)).toBe(false);
    markPrologueSeen(storage);
    expect(hasSeenPrologue(storage)).toBe(true);
  });

  it('plays every time, without throwing, when the storage is blocked', () => {
    const blocked = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(hasSeenPrologue(blocked)).toBe(false);
    expect(() => markPrologueSeen(blocked)).not.toThrow();
    expect(hasSeenPrologue(null)).toBe(false);
  });
});
