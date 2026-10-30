// The pen's path for a line of calligraphy: where each letter goes, in what order the pen traces its outlines, and when it
// reaches each point. Plain numbers (no three, no canvas), so the drawing view only turns it into meshes and the tests can
// check the timing. Units are the font's (a 1000-unit em, y up from the baseline) until the view scales them.
import { CALLIGRAPHY_GLYPHS, CALLIGRAPHY_SPACE, CALLIGRAPHY_EM, type CalligraphyGlyph } from './calligraphy-glyphs';

/** Line spacing, in ems. */
export const LINE_HEIGHT_EM = 1.45;
/** Seconds the pen is lifted between two outlines, and between two letters. */
const LIFT_CONTOUR_S = 0.03;
const LIFT_GLYPH_S = 0.05;

export interface PlacedGlyph {
  readonly ch: string;
  readonly glyph: CalligraphyGlyph;
  /** Where its origin is: units from the left of the block, and down from the first line's baseline (y grows downward here). */
  readonly x: number;
  readonly line: number;
}

export interface TracedContour {
  /** Absolute points, x right and y UP (flat x, y pairs), in font units with the block's top-left at (0, 0 down). */
  readonly points: Float32Array;
  /** The second the pen reaches each point. */
  readonly times: Float32Array;
  /** Whether it is the outside of a letter (clockwise) or a hole in it. */
  readonly hole: boolean;
}

export interface TracedGlyph {
  readonly ch: string;
  readonly contours: readonly TracedContour[];
  /** The second the pen finishes this letter. */
  readonly doneAt: number;
}

export interface CalligraphyPlan {
  readonly glyphs: readonly TracedGlyph[];
  /** Block size in units. */
  readonly width: number;
  readonly height: number;
  /** The second the pen finishes the last letter. */
  readonly duration: number;
  /** The pen's place at `time` (clamped to the start and the end) into `out` as x, y. */
  penAt(time: number, out: { x: number; y: number }): void;
}

/** The glyph for a character (a space, or a character the data does not have, is a gap, not a letter). */
function glyphFor(ch: string): CalligraphyGlyph | null {
  return CALLIGRAPHY_GLYPHS[ch] ?? null;
}

/** Splits `text` into lines no wider than `maxEm` ems, at spaces (a word longer than a line stays whole). */
export function wrapLines(text: string, maxEm: number): string[] {
  const widthOf = (s: string): number => {
    let w = 0;
    for (const ch of s) w += glyphFor(ch)?.advance ?? CALLIGRAPHY_SPACE;
    return w / CALLIGRAPHY_EM;
  };
  const lines: string[] = [];
  let line = '';
  for (const word of text.trim().split(/\s+/)) {
    const next = line === '' ? word : line + ' ' + word;
    if (line !== '' && widthOf(next) > maxEm) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line !== '') lines.push(line);
  return lines;
}

/** Places each letter of `lines`, each line centred on the widest. */
export function layout(lines: readonly string[]): { placed: PlacedGlyph[]; width: number } {
  const widths = lines.map((l) => {
    let w = 0;
    for (const ch of l) w += glyphFor(ch)?.advance ?? CALLIGRAPHY_SPACE;
    return w;
  });
  const width = Math.max(0, ...widths);
  const placed: PlacedGlyph[] = [];
  lines.forEach((l, line) => {
    let x = (width - widths[line]) / 2;
    for (const ch of l) {
      const glyph = glyphFor(ch);
      if (glyph) placed.push({ ch, glyph, x, line });
      x += glyph?.advance ?? CALLIGRAPHY_SPACE;
    }
  });
  return { placed, width };
}

/** Clockwise outlines (the outside of a letter, y up) have a negative signed area. */
function signedArea(points: readonly number[]): number {
  let a = 0;
  for (let i = 0, n = points.length / 2; i < n; i++) {
    const j = (i + 1) % n;
    a += points[i * 2] * points[j * 2 + 1] - points[j * 2] * points[i * 2 + 1];
  }
  return a / 2;
}

/**
 * The plan for `text`: wrapped to `maxEm` ems, laid out, and traced letter by letter, left to right, line by line, at
 * `speed` units a second along the outlines (a letter's outside first, then its holes).
 */
export function planCalligraphy(text: string, maxEm: number, speed: number): CalligraphyPlan {
  const lines = wrapLines(text, maxEm);
  const { placed, width } = layout(lines);
  const height = Math.max(1, lines.length) * LINE_HEIGHT_EM * CALLIGRAPHY_EM;
  const glyphs: TracedGlyph[] = [];
  // For the pen's place at a time: every point in order, with its time.
  const trail: number[] = [];
  let t = 0.15;
  for (const p of placed) {
    const baseY = -(p.line * LINE_HEIGHT_EM + 1) * CALLIGRAPHY_EM; // y up: lower lines are more negative
    // Outsides before holes.
    const order = [...p.glyph.contours].sort((a, b) => signedArea(a) - signedArea(b));
    const contours: TracedContour[] = [];
    for (const c of order) {
      const n = c.length / 2;
      const points = new Float32Array((n + 1) * 2);
      const times = new Float32Array(n + 1);
      let prevX = 0;
      let prevY = 0;
      for (let i = 0; i <= n; i++) {
        const k = (i % n) * 2; // the last point closes the outline
        const x = p.x + c[k];
        const y = baseY + c[k + 1];
        if (i > 0) t += Math.hypot(x - prevX, y - prevY) / speed;
        points[i * 2] = x;
        points[i * 2 + 1] = y;
        times[i] = t;
        trail.push(t, x, y);
        prevX = x;
        prevY = y;
      }
      contours.push({ points, times, hole: signedArea(c) > 0 });
      t += LIFT_CONTOUR_S;
    }
    t += LIFT_GLYPH_S;
    glyphs.push({ ch: p.ch, contours, doneAt: t });
  }
  const duration = glyphs.length > 0 ? glyphs[glyphs.length - 1].doneAt : 0;
  return {
    glyphs,
    width,
    height,
    duration,
    penAt(time, out) {
      const n = trail.length / 3;
      if (n === 0) {
        out.x = 0;
        out.y = 0;
        return;
      }
      // The last point the pen has reached (binary search on time).
      let lo = 0;
      let hi = n - 1;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (trail[mid * 3] <= time) lo = mid;
        else hi = mid - 1;
      }
      out.x = trail[lo * 3 + 1];
      out.y = trail[lo * 3 + 2];
    },
  };
}

/**
 * Like planCalligraphy, but at the pen speed that finishes the whole text in about `seconds` (never less than the pen's lifts
 * need, so a very short time gives a very fast pen, not a broken plan).
 */
export function planCalligraphyIn(text: string, maxEm: number, seconds: number): CalligraphyPlan {
  const probe = planCalligraphy(text, maxEm, 10000);
  if (probe.glyphs.length === 0) return probe;
  let contours = 0;
  for (const g of probe.glyphs) contours += g.contours.length;
  const lifts = 0.15 + contours * LIFT_CONTOUR_S + probe.glyphs.length * LIFT_GLYPH_S;
  const drawing = Math.max(0.01, probe.duration - lifts); // seconds of pen travel at the probe speed
  const wanted = Math.max(0.2, seconds - lifts);
  return planCalligraphy(text, maxEm, (10000 * drawing) / wanted);
}
