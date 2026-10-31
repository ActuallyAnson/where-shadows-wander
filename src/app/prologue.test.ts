import { describe, expect, it } from 'vitest';
import {
  FINALE_PAGES,
  hasSeenPrologue,
  LEAD_IN_S,
  markPrologueSeen,
  Prologue,
  PrologueReel,
  prologueSeconds,
  REEL_END_S,
  REEL_FADE_S,
  REEL_NOTES,
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
  const prologue = new Prologue(
    writer,
    { enter: () => calls.push('enter'), leave: () => calls.push('leave') },
    FINALE_PAGES,
  );
  const run = (seconds: number) => {
    for (let t = 0; t < seconds; t += 0.05) prologue.update(0.05);
  };
  return { writer, calls, prologue, run };
}

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
    run(prologueSeconds(FINALE_PAGES) + 2);
    expect(writer.shown).toEqual(FINALE_PAGES.map((p) => p.text));
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
    expect(writer.shown[before]).toBe(FINALE_PAGES[0].text);
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

describe('PrologueReel', () => {
  function reelSetup() {
    const times: number[] = [];
    const notes: number[] = [];
    const calls: string[] = [];
    const reel = new PrologueReel(
      { setReelTime: (s) => void times.push(s) },
      { enter: () => calls.push('enter'), leave: () => calls.push('leave') },
      (n) => void notes.push(n),
    );
    const run = (seconds: number) => {
      for (let t = 0; t < seconds - 1e-9; t += 0.05) reel.update(0.05);
    };
    return { reel, times, notes, calls, run };
  }

  it('is a short wordless reel, not a wall of text: under half a minute', () => {
    expect(REEL_END_S).toBeGreaterThan(12);
    expect(REEL_END_S).toBeLessThan(30);
  });

  it('darkens the room, runs the scene on its own clock after the fade, plays the notes once each in order, and gives the room back', () => {
    const { reel, times, notes, calls, run } = reelSetup();
    let done = 0;
    reel.start(() => done++);
    expect(calls).toEqual(['enter']);
    expect(reel.playing).toBe(true);
    run(REEL_FADE_S + 8);
    expect(notes[0]).toBe(4); // the last sleeper's light goes out first, and its note is the highest
    run(REEL_END_S + 2);
    expect(notes).toEqual(REEL_NOTES.map(([, n]) => n));
    expect(Math.max(...times)).toBeGreaterThanOrEqual(REEL_END_S);
    expect(calls).toEqual(['enter', 'leave']);
    expect(done).toBe(1);
    expect(reel.playing).toBe(false);
  });

  it('can be skipped at once and says it is done once, starts over without entering twice, and ignores bad frame times', () => {
    const { reel, calls, notes, run } = reelSetup();
    let done = 0;
    reel.start(() => done++);
    run(5);
    reel.skip();
    reel.skip();
    expect(done).toBe(1);
    expect(calls).toEqual(['enter', 'leave']);
    reel.start();
    run(9);
    expect(notes.length).toBeGreaterThan(0);
    reel.start(); // again while playing
    expect(calls).toEqual(['enter', 'leave', 'enter']);
    expect(() => {
      reel.update(-1);
      reel.update(NaN);
    }).not.toThrow();
  });
});
