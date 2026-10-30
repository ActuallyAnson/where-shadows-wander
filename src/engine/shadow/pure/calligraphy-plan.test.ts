import { describe, expect, it } from 'vitest';
import { CALLIGRAPHY_EM, CALLIGRAPHY_GLYPHS } from './calligraphy-glyphs';
import { layout, planCalligraphy, planCalligraphyIn, wrapLines } from './calligraphy-plan';

describe('calligraphy glyph data', () => {
  it('has every letter, the space marks the story uses, and outlines for each', () => {
    for (const ch of 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz.,’') {
      const g = CALLIGRAPHY_GLYPHS[ch];
      expect(g, ch).toBeDefined();
      expect(g.advance).toBeGreaterThan(0);
      expect(g.contours.length).toBeGreaterThan(0);
      for (const c of g.contours) expect(c.length % 2).toBe(0);
    }
  });
});

describe('wrapLines', () => {
  it('breaks at spaces and keeps every word', () => {
    const lines = wrapLines('When the house holds its breath, the room begins to dream.', 8);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join(' ')).toBe('When the house holds its breath, the room begins to dream.');
  });

  it('keeps a word that is longer than the line whole, and copes with nothing', () => {
    expect(wrapLines('Extraordinarily long', 2)).toEqual(['Extraordinarily', 'long']);
    expect(wrapLines('   ', 8)).toEqual([]);
  });
});

describe('layout', () => {
  it('centres each line on the widest and puts the letters in order', () => {
    const { placed, width } = layout(['Sleep well', 'now']);
    expect(width).toBeGreaterThan(0);
    const first = placed.filter((p) => p.line === 0);
    for (let i = 1; i < first.length; i++) expect(first[i].x).toBeGreaterThan(first[i - 1].x);
    const second = placed.filter((p) => p.line === 1);
    expect(second[0].x).toBeGreaterThan(0); // the short line is centred, not flush left
  });
});

describe('planCalligraphy', () => {
  const plan = planCalligraphy('The lamp wakes first.', 12, 12000);

  it('traces every letter once, in order, with the pen only moving forward in time', () => {
    expect(plan.glyphs.map((g) => g.ch).join('')).toBe('Thelampwakesfirst.');
    let last = 0;
    for (const g of plan.glyphs) {
      for (const c of g.contours) {
        for (let i = 0; i < c.times.length; i++) {
          expect(c.times[i]).toBeGreaterThanOrEqual(last);
          last = c.times[i];
        }
      }
      expect(g.doneAt).toBeGreaterThanOrEqual(last);
    }
    expect(plan.duration).toBe(plan.glyphs[plan.glyphs.length - 1].doneAt);
  });

  it('closes every outline, and does the outside of a letter before its holes', () => {
    for (const g of plan.glyphs) {
      for (const c of g.contours) {
        const n = c.points.length;
        expect(c.points[0]).toBe(c.points[n - 2]);
        expect(c.points[1]).toBe(c.points[n - 1]);
      }
      let seenHole = false;
      for (const c of g.contours) {
        if (c.hole) seenHole = true;
        else expect(seenHole).toBe(false);
      }
    }
  });

  it('takes longer at a slower pen, and says where the pen is at any time', () => {
    const slow = planCalligraphy('The lamp wakes first.', 12, 6000);
    expect(slow.duration).toBeGreaterThan(plan.duration * 1.5);
    const p = { x: 0, y: 0 };
    plan.penAt(-1, p);
    const start = { ...p };
    plan.penAt(plan.duration / 2, p);
    expect(p.x).toBeGreaterThan(start.x);
    plan.penAt(1e9, p);
    expect(p.x).toBeGreaterThan(0);
    expect(p.x).toBeLessThanOrEqual(plan.width + CALLIGRAPHY_EM);
  });

  it('is empty, not broken, for no text', () => {
    const empty = planCalligraphy('', 12, 12000);
    expect(empty.glyphs).toHaveLength(0);
    expect(empty.duration).toBe(0);
    const p = { x: 5, y: 5 };
    empty.penAt(1, p);
    expect(p).toEqual({ x: 0, y: 0 });
  });
});

describe('planCalligraphyIn', () => {
  it('finishes in about the time asked for', () => {
    for (const seconds of [4, 7, 12]) {
      const plan = planCalligraphyIn('The lamp wakes first. It remembers being fire.', 14, seconds);
      expect(plan.duration).toBeGreaterThan(seconds * 0.95);
      expect(plan.duration).toBeLessThan(seconds * 1.05);
    }
  });

  it('copes with no text and with a time too short for the pen to lift in', () => {
    expect(planCalligraphyIn('', 14, 5).duration).toBe(0);
    const rushed = planCalligraphyIn('The lamp wakes first.', 14, 0.1);
    expect(Number.isFinite(rushed.duration)).toBe(true);
    expect(rushed.duration).toBeGreaterThan(0);
  });
});
