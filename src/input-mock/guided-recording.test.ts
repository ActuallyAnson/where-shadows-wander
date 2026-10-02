// Acceptance test for #7: a recording made with the shapes script has correct
// labels for every prompt. Lives here because pure folders can't import the
// mock ScriptedSource, which knows which shape each hand is posed as.
import { describe, expect, it } from 'vitest';
import { createHandFrame, type Handedness } from '../engine/hands/hand';
import { GuidedRecording } from '../engine/hands/guided-recording';
import { parseRecording } from '../engine/hands/hand-recording';
import { SHAPES_SCRIPT, ShapeScript } from '../engine/hands/shape-script';
import { ScriptedSource } from './scripted-source';

function guidedRun(fps: number) {
  const source = new ScriptedSource(SHAPES_SCRIPT, false);
  const guided = new GuidedRecording(new ShapeScript(SHAPES_SCRIPT), 'test', 'ua', '2026-10-03T00:00:00Z');
  const l = createHandFrame('left'),
    r = createHandFrame('right');
  const posed: { t: number; left: string | null; right: string | null }[] = [];
  for (let i = 0; ; i++) {
    const t = i / fps;
    source.update(t, l, r);
    if (!guided.frame(t, l, r, null)) break;
    const as = (h: Handedness) => {
      const s = source.shapeOf(h);
      return s === 'relaxed' ? 'none' : s;
    };
    posed.push({ t: Math.round(t * 1000) / 1000, left: as('left'), right: as('right') });
  }
  const rec = parseRecording(JSON.parse(JSON.stringify(guided.finish())));
  return { rec, posed };
}

describe.each([72, 30])('a guided run of the shapes script at %d fps', (fps) => {
  const { rec, posed } = guidedRun(fps);

  it('has a label for every prompt long enough to settle', () => {
    const expected = SHAPES_SCRIPT.filter((s) => s.shape !== null && s.seconds > 1).length;
    expect(rec.labels).toHaveLength(expected);
  });

  it('labels match the shape the hand was posed as on every frame inside them', () => {
    for (const label of rec.labels) {
      const inside = rec.frames.filter((f) => f.t >= label.start && f.t <= label.end);
      expect(inside.length).toBeGreaterThan(fps * 0.9);
      for (const f of inside) {
        expect(f[label.hand]).not.toBeNull();
        expect(posed.find((p) => p.t === f.t)![label.hand]).toBe(label.shape);
      }
    }
  });

  it("doesn't overlap labels for the same hand", () => {
    for (const hand of ['left', 'right'] as const) {
      const mine = rec.labels.filter((l) => l.hand === hand);
      for (let i = 1; i < mine.length; i++) expect(mine[i].start).toBeGreaterThanOrEqual(mine[i - 1].end);
    }
  });
});
