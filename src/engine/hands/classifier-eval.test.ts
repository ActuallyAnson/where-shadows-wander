import { describe, expect, it } from 'vitest';
import { evaluateRecording, formatReport, percentile, sourceOf, summarise } from './classifier-eval';
import { createHandFrame } from './hand';
import { createRecording, recordFrame, type HandRecording, type ShapeLabel } from './hand-recording';
import { SETTLE_S } from './shape-script';
import { PRESETS, writeHandPose, type PresetName } from './synthetic-hand';

const FPS = 50;

/** A recording of the right hand following `pose(t)` (null = not tracked), with labels. */
function recording(
  seconds: number,
  pose: (t: number) => PresetName | null,
  labels: ShapeLabel[],
  note = 'Hand Lab guided, script',
) {
  const rec = createRecording(note, 'ua', '2026-10-03T00:00:00Z');
  const l = createHandFrame('left'),
    r = createHandFrame('right');
  for (let i = 0; i <= seconds * FPS; i++) {
    const t = i / FPS;
    const p = pose(t);
    if (p) writeHandPose(PRESETS[p], [0.1, 1, -0.4], r);
    else r.tracked = false;
    r.validJoints = p ? 25 : 0;
    recordFrame(rec, t, l, r, null);
  }
  rec.labels = labels;
  return JSON.parse(JSON.stringify(rec)) as HandRecording;
}

const label = (start: number, end: number, shape: ShapeLabel['shape']): ShapeLabel => ({
  start,
  end,
  hand: 'right',
  shape,
});

describe('classifier evaluation', () => {
  it('scores only labelled frames, and a held shape inside its label', () => {
    // Fist from 1 s; labelled fist 1.5-3.5 s (prompt at 1 s).
    const e = evaluateRecording(recording(4, (t) => (t < 1 ? 'relaxed' : 'fist'), [label(1.5, 3.5, 'fist')]));
    const r = e.labels[0];
    expect(r.frames).toBe(2 * FPS + 1);
    expect(r.correct).toBe(r.frames);
    expect(r.hit).toBe(true);
    expect(r.timeToCommit!).toBeCloseTo(0.4, 1); // from the prompt at start - SETTLE_S
    expect(SETTLE_S).toBe(0.5);
    expect(e.falseCommits).toEqual([]);
  });

  it('ignores commits in unlabelled time', () => {
    const e = evaluateRecording(recording(4, (t) => (t < 2 ? 'fist' : 'relaxed'), [label(3, 3.8, 'none')]));
    expect(e.falseCommits).toEqual([]);
  });

  it('counts a commit during a none label, or of the wrong shape, as a false trigger', () => {
    const during = evaluateRecording(recording(3, (t) => (t < 1 ? 'relaxed' : 'fist'), [label(0.5, 2.5, 'none')]));
    expect(during.falseCommits).toMatchObject([{ shape: 'fist', label: 'none' }]);
    const wrong = evaluateRecording(recording(3, (t) => (t < 1 ? 'relaxed' : 'cup'), [label(1.2, 2.8, 'fist')]));
    expect(wrong.falseCommits).toMatchObject([{ shape: 'cup', label: 'fist' }]);
    expect(wrong.labels[0].hit).toBe(false);
    expect(wrong.labels[0].timeToCommit).toBeNull();
  });

  it('counts a shape already committed at the prompt as a hit', () => {
    const e = evaluateRecording(recording(4, () => 'fist', [label(2, 3.5, 'fist')]));
    expect(e.labels[0]).toMatchObject({ hit: true, timeToCommit: 0 });
  });

  it('puts paused frames in their own column', () => {
    const e = evaluateRecording(recording(3, (t) => (t > 1.5 && t < 2 ? null : 'fist'), [label(1, 2.5, 'fist')]));
    expect(e.labels[0].paused).toBeGreaterThan(0);
    const s = summarise([e]).overall!;
    expect(s.confusion[1][7]).toBe(e.labels[0].paused); // row fist, column paused
    expect(s.pausedShare).toBeGreaterThan(0);
  });

  it('counts re-commits of the same shape inside a label as flicker', () => {
    const e = evaluateRecording(
      recording(4, (t) => (t > 1.5 && t < 2.2 ? 'relaxed' : 'fist'), [label(0.2, 3.8, 'fist')]),
    );
    expect(e.labels[0].flicker).toBe(1);
  });

  it('skips recordings without labels and replays', () => {
    expect(evaluateRecording(recording(1, () => 'fist', [])).skipped).toContain('no labels');
    expect(
      evaluateRecording(recording(1, () => 'fist', [label(0.2, 0.8, 'fist')], 'Hand Lab, replay: x.json')).source,
    ).toBe('skipped');
  });

  it('tells sources apart by note and user agent', () => {
    const rec = (note: string, userAgent: string) => ({ ...recording(0.1, () => 'fist', []), note, userAgent });
    expect(sourceOf(rec('Hand Lab guided, webcam', 'Mac'))).toBe('webcam');
    expect(sourceOf(rec('Webcam (MediaPipe) via webcam.html, guided', 'Mac'))).toBe('webcam');
    expect(sourceOf(rec('Hand Lab guided, script', 'Mac'))).toBe('synthetic');
    expect(sourceOf(rec('Hand Lab, replay: a.json', 'Mac'))).toBe('replay');
    expect(sourceOf(rec('guided: shapes', 'Mozilla/5.0 (Linux; Android 12; PICO 4) PicoBrowser'))).toBe('pico');
    expect(sourceOf(rec('guided: shapes', 'Mozilla/5.0 (Linux; Android 14; Quest 3) OculusBrowser/38'))).toBe('quest');
    expect(sourceOf(rec('guided: shapes', 'Mozilla/5.0 (X11; Linux x86_64; Quest 3) OculusBrowser/33'))).toBe(
      'emulator',
    );
  });

  it('uses nearest-rank percentiles', () => {
    expect(percentile([5, 1, 3, 2, 4], 50)).toBe(3);
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 95)).toBe(10);
    expect(percentile([], 50)).toBeNull();
  });

  it('formats a report with a table per source', () => {
    const text = formatReport(summarise([evaluateRecording(recording(4, () => 'fist', [label(1, 3, 'fist')]))]));
    expect(text).toContain('synthetic');
    expect(text).toContain('confusion');
  });
});
