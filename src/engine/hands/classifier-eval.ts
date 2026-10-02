// Scores the shape classifier against labelled recordings (#12): replays each
// recording through a fresh ShapeRecognizer and compares it with the labels
// (what the wearer was asked to do, see shape-script.ts). Plain TypeScript: no
// IWSDK, no three.js; the `npm run eval` runner does the file reading.
//
// Only time inside a label for a hand is scored; unlabelled time is replayed
// (so the classifier's state carries on) but not counted.
// - Recognised shape per frame: paused, else the committed shape, else the
//   shape being held, else none. Frame accuracy compares that with the label.
//   (Committed alone would score companions badly by design: a 1 s hold
//   inside a 2 s label.)
// - Label hit: a commit of the label's shape between the prompt (label start
//   - SETTLE_S) and the label's end, or the shape already committed at the
//   prompt. Time to commit is measured from the prompt (left out of the time
//   statistics when the shape was already committed).
// - False trigger: a commit inside a label for that hand whose shape differs
//   from the commit, including any commit during a `none` label.
// - Flicker: commits of the label's shape after the first, from the prompt to
//   the label's end (a shape committed at the prompt counts as the first).
// Labels are half-open, [start, end), so touching labels don't share a frame.
import { createHandFrame, type Handedness } from './hand';
import { biasFromSamples, MAX_CURL_BIAS } from './hand-calibration';
import { computeHandFeatures, createHandFeatures, FINGER_NAMES } from './hand-features';
import { replayInto, type HandRecording, type LabelShape, type ShapeLabel } from './hand-recording';
import type { ClassifierConfig } from './shape-classifier';
import { ShapeRecognizer } from './shape-recognizer';
import { SETTLE_S } from './shape-script';
import { COMPANION_SHAPES, SHAPES, type Shape } from './shapes';

export const EVAL_SOURCES = ['pico', 'quest', 'webcam', 'emulator', 'synthetic'] as const;
export type EvalSource = (typeof EVAL_SOURCES)[number];
/** Confusion matrix rows (labels) and columns (what the classifier said). */
export const LABEL_ROWS: readonly LabelShape[] = [...SHAPES, 'none'];
export const RECOGNISED_COLS = [...SHAPES, 'none', 'paused'] as const;
export type Recognised = (typeof RECOGNISED_COLS)[number];

export interface LabelResult {
  label: ShapeLabel;
  /** Frames inside the label, and how many were recognised correctly or paused. */
  frames: number;
  correct: number;
  paused: number;
  /** For shape labels: committed in time? null for `none` labels. */
  hit: boolean | null;
  /** Seconds from the prompt to the commit, for hits; null if missed or already committed at the prompt. */
  timeToCommit: number | null;
  flicker: number;
}

export interface FalseCommit {
  t: number;
  hand: Handedness;
  shape: Shape;
  label: LabelShape;
}

export interface RecordingEval {
  source: EvalSource | 'skipped';
  /** Why a recording was skipped (no labels, a replay of another recording). */
  skipped: string | null;
  labels: LabelResult[];
  /** Rows LABEL_ROWS, columns RECOGNISED_COLS, frame counts. */
  confusion: number[][];
  falseCommits: FalseCommit[];
  labelledMinutes: number;
  noneMinutes: number;
  /** Each hand's calibration, if evaluated with `calibrate` (null: no flat prompt to calibrate from, or refused). */
  calibration: Record<Handedness, number[] | null> | null;
}

export interface EvalOptions {
  /**
   * Calibrate each hand from its first `flat` label, as a player would before
   * playing (hand-calibration.ts), instead of scoring raw curl.
   */
  calibrate?: boolean;
}

/** Where a recording came from, by its note, then its browser's user agent. */
export function sourceOf(rec: HandRecording): EvalSource | 'replay' {
  const note = rec.note.toLowerCase();
  // Notes the Hand Lab writes: "Hand Lab[ guided], <source name>" (a replay's name starts with "replay").
  const lab = /^hand lab( guided)?, (.*)$/.exec(note.split(' [trimmed')[0]);
  if (lab) {
    if (lab[2].startsWith('replay')) return 'replay';
    if (lab[2] === 'webcam') return 'webcam';
    return 'synthetic';
  }
  if (note.includes('via webcam.html')) return 'webcam';
  const ua = rec.userAgent;
  if (/pico/i.test(ua)) return 'pico';
  // The emulator (IWER) copies Quest Browser's user agent but with a placeholder version, "OculusBrowser/33.0.0.x.x.x".
  if (/oculusbrowser\/[\d.]*\.x/i.test(ua)) return 'emulator';
  if (/quest|oculusbrowser/i.test(ua)) return 'quest';
  return 'emulator';
}

/** Replays one recording through a fresh classifier and scores it. */
export function evaluateRecording(
  rec: HandRecording,
  config: Partial<ClassifierConfig> = {},
  options: EvalOptions = {},
): RecordingEval {
  const result: RecordingEval = {
    source: 'skipped',
    skipped: null,
    labels: [],
    confusion: LABEL_ROWS.map(() => RECOGNISED_COLS.map(() => 0)),
    falseCommits: [],
    labelledMinutes: 0,
    noneMinutes: 0,
    calibration: null,
  };
  const source = sourceOf(rec);
  if (source === 'replay') return { ...result, skipped: 'a replay of another recording' };
  if (rec.labels.length === 0) return { ...result, skipped: 'no labels (record with a guided recording)' };
  result.source = source;

  const labels = [...rec.labels].sort((a, b) => a.start - b.start);
  const results: LabelResult[] = labels.map((label) => ({
    label,
    frames: 0,
    correct: 0,
    paused: 0,
    hit: label.shape === 'none' ? null : false,
    timeToCommit: null,
    flicker: 0,
  }));
  for (const r of results) {
    const minutes = (r.label.end - r.label.start) / 60;
    result.labelledMinutes += minutes;
    if (r.label.shape === 'none') result.noneMinutes += minutes;
  }

  const recognizer = new ShapeRecognizer(config);
  const hands = { left: createHandFrame('left'), right: createHandFrame('right') };
  if (options.calibrate) {
    result.calibration = { left: calibrateFrom(rec, 'left'), right: calibrateFrom(rec, 'right') };
    for (const h of ['left', 'right'] as const) recognizer.setCalibration(h, result.calibration[h]);
  }
  /** Commits per hand, in order, and the committed shape after each frame (for "already committed at the prompt"). */
  const commits: { t: number; hand: Handedness; shape: Shape }[] = [];
  const committedAtPrompt = new Map<LabelResult, boolean>();

  for (const frame of rec.frames) {
    replayInto(frame, 'left', hands.left);
    replayInto(frame, 'right', hands.right);
    // Before this update, record what's committed for labels whose prompt has just been reached.
    for (const r of results) {
      if (r.label.shape === 'none' || committedAtPrompt.has(r)) continue;
      if (frame.t >= r.label.start - SETTLE_S)
        committedAtPrompt.set(r, recognizer[r.label.hand].state.committed === r.label.shape);
    }
    recognizer.update(hands, frame.t);
    for (let i = 0; i < recognizer.events.count; i++) {
      const e = recognizer.events.at(i);
      if (e.type === 'commit') commits.push({ t: e.t, hand: e.hand, shape: e.shape });
    }
    for (const r of results) {
      if (frame.t < r.label.start || frame.t >= r.label.end) continue;
      const said = recognised(recognizer[r.label.hand].state);
      r.frames++;
      if (said === 'paused') r.paused++;
      if (said === r.label.shape) r.correct++;
      result.confusion[LABEL_ROWS.indexOf(r.label.shape)][RECOGNISED_COLS.indexOf(said)]++;
    }
  }

  for (const r of results) {
    const { start, end, hand, shape } = r.label;
    const prompt = start - SETTLE_S;
    const mine = commits.filter((c) => c.hand === hand);
    if (shape !== 'none') {
      const already = committedAtPrompt.get(r) ?? false;
      const inWindow = mine.filter((c) => c.shape === shape && c.t >= prompt && c.t < end);
      if (already) r.hit = true;
      else if (inWindow.length) {
        r.hit = true;
        r.timeToCommit = inWindow[0].t - prompt;
      }
      r.flicker = Math.max(0, inWindow.length + (already ? 1 : 0) - 1);
    }
    for (const c of mine)
      if (c.t >= start && c.t < end && c.shape !== shape) result.falseCommits.push({ ...c, label: shape });
  }
  result.labels = results;
  return result;
}

/** A hand's calibration from its first flat label: the median raw curl per finger, or null. */
function calibrateFrom(rec: HandRecording, hand: Handedness): number[] | null {
  const label = rec.labels.filter((l) => l.hand === hand && l.shape === 'flat').sort((a, b) => a.start - b.start)[0];
  if (!label) return null;
  const frame = createHandFrame(hand);
  const f = createHandFeatures();
  const samples: number[][] = [];
  for (const fr of rec.frames) {
    if (fr.t < label.start || fr.t >= label.end) continue;
    replayInto(fr, hand, frame);
    if (computeHandFeatures(frame, f)) samples.push(FINGER_NAMES.map((n) => f.curl[n]));
  }
  if (!samples.length) return null;
  const bias = Array.from(biasFromSamples(samples));
  // Like the Hand Lab's calibration: a bent "flat" isn't a baseline.
  return bias.slice(1).reduce((a, b) => a + b, 0) / 4 >= MAX_CURL_BIAS * 0.9 ? null : bias;
}

function recognised(s: { phase: string; committed: Shape | null; candidate: Shape | null }): Recognised {
  if (s.phase === 'paused') return 'paused';
  return s.committed ?? s.candidate ?? 'none';
}

export interface ShapeSummary {
  frames: number;
  /** Recognised correctly, of frames that weren't paused. */
  accuracy: number;
  labels: number;
  hits: number;
  timeToCommit: { median: number | null; p95: number | null };
}

export interface SourceSummary {
  recordings: number;
  frames: number;
  /** Over all labelled frames that weren't paused. */
  accuracy: number;
  pausedShare: number;
  hitRate: number;
  falseCommits: number;
  falsePerMinute: number;
  falsePerNoneMinute: number;
  labelledMinutes: number;
  noneMinutes: number;
  flicker: number;
  timeToCommit: {
    verbs: { median: number | null; p95: number | null };
    companions: { median: number | null; p95: number | null };
  };
  byLabel: Record<LabelShape, ShapeSummary>;
  confusion: number[][];
}

export interface EvalSummary {
  bySource: Partial<Record<EvalSource, SourceSummary>>;
  overall: SourceSummary | null;
}

export function summarise(evals: readonly RecordingEval[]): EvalSummary {
  const scored = evals.filter((e) => e.source !== 'skipped');
  const bySource: Partial<Record<EvalSource, SourceSummary>> = {};
  for (const source of EVAL_SOURCES) {
    const mine = scored.filter((e) => e.source === source);
    if (mine.length) bySource[source] = summariseGroup(mine);
  }
  return { bySource, overall: scored.length ? summariseGroup(scored) : null };
}

function summariseGroup(evals: readonly RecordingEval[]): SourceSummary {
  const all = evals.flatMap((e) => e.labels);
  const frames = sum(all.map((r) => r.frames));
  const paused = sum(all.map((r) => r.paused));
  const correct = sum(all.map((r) => r.correct));
  const shapeLabels = all.filter((r) => r.label.shape !== 'none');
  const hits = shapeLabels.filter((r) => r.hit);
  const timed = hits.filter((r) => r.timeToCommit !== null);
  const ttc = (pick: (s: Shape) => boolean) =>
    stats(timed.filter((r) => pick(r.label.shape as Shape)).map((r) => r.timeToCommit!));
  const falseCommits = sum(evals.map((e) => e.falseCommits.length));
  const labelledMinutes = sum(evals.map((e) => e.labelledMinutes));
  const noneMinutes = sum(evals.map((e) => e.noneMinutes));
  const noneFalse = sum(evals.map((e) => e.falseCommits.filter((c) => c.label === 'none').length));
  const byLabel = Object.fromEntries(
    LABEL_ROWS.map((shape) => {
      const mine = all.filter((r) => r.label.shape === shape);
      const f = sum(mine.map((r) => r.frames)),
        p = sum(mine.map((r) => r.paused));
      const h = mine.filter((r) => r.hit);
      return [
        shape,
        {
          frames: f,
          accuracy: ratio(sum(mine.map((r) => r.correct)), f - p),
          labels: mine.length,
          hits: h.length,
          timeToCommit: stats(h.filter((r) => r.timeToCommit !== null).map((r) => r.timeToCommit!)),
        },
      ];
    }),
  ) as Record<LabelShape, ShapeSummary>;
  const confusion = LABEL_ROWS.map((_, i) => RECOGNISED_COLS.map((_, j) => sum(evals.map((e) => e.confusion[i][j]))));
  return {
    recordings: evals.length,
    frames,
    accuracy: ratio(correct, frames - paused),
    pausedShare: ratio(paused, frames),
    hitRate: ratio(hits.length, shapeLabels.length),
    falseCommits,
    falsePerMinute: ratio(falseCommits, labelledMinutes),
    falsePerNoneMinute: ratio(noneFalse, noneMinutes),
    labelledMinutes,
    noneMinutes,
    flicker: sum(all.map((r) => r.flicker)),
    timeToCommit: {
      verbs: ttc((s) => !COMPANION_SHAPES.includes(s)),
      companions: ttc((s) => COMPANION_SHAPES.includes(s)),
    },
    byLabel,
    confusion,
  };
}

/** Nearest-rank percentile (p in 0..100) of `xs`; null for no values. */
export function percentile(xs: readonly number[], p: number): number | null {
  if (xs.length === 0) return null;
  const sorted = [...xs].sort((a, b) => a - b);
  const rank = Math.max(1, Math.ceil((p / 100) * sorted.length));
  return sorted[rank - 1];
}

function stats(xs: readonly number[]) {
  return { median: percentile(xs, 50), p95: percentile(xs, 95) };
}

function sum(xs: readonly number[]): number {
  return xs.reduce((a, b) => a + b, 0);
}

function ratio(a: number, b: number): number {
  return b > 0 ? a / b : 0;
}

/** The summary as terminal text: a table per source, then each source's confusion matrix. */
export function formatReport(summary: EvalSummary): string {
  const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
  const sec = (x: number | null) => (x === null ? '-' : `${x.toFixed(2)}s`);
  const groups = Object.entries(summary.bySource);
  if (summary.overall && groups.length > 1) groups.push(['all', summary.overall]);
  const rows = groups.map(([source, s]) => [
    source,
    String(s.recordings),
    String(s.frames),
    pct(s.accuracy),
    pct(s.pausedShare),
    pct(s.hitRate),
    `${s.falsePerMinute.toFixed(2)} (${s.falseCommits} in ${s.labelledMinutes.toFixed(1)} min)`,
    `${s.falsePerNoneMinute.toFixed(2)} (${s.noneMinutes.toFixed(1)} min)`,
    String(s.flicker),
    `${sec(s.timeToCommit.verbs.median)} / ${sec(s.timeToCommit.verbs.p95)}`,
    `${sec(s.timeToCommit.companions.median)} / ${sec(s.timeToCommit.companions.p95)}`,
  ]);
  const head = [
    'source',
    'recs',
    'frames',
    'accuracy',
    'paused',
    'hits',
    'false/min',
    'false/none-min',
    'flicker',
    'verb commit med/p95',
    'companion med/p95',
  ];
  const out = [table([head, ...rows])];
  for (const [source, s] of Object.entries(summary.bySource)) {
    out.push(`\n${source}: accuracy and hits per label`);
    out.push(
      table([
        ['label', 'frames', 'accuracy', 'hits', 'commit med/p95'],
        ...LABEL_ROWS.map((l) => {
          const b = s.byLabel[l];
          return [
            l,
            String(b.frames),
            pct(b.accuracy),
            l === 'none' ? '-' : `${b.hits}/${b.labels}`,
            l === 'none' ? '-' : `${sec(b.timeToCommit.median)} / ${sec(b.timeToCommit.p95)}`,
          ];
        }),
      ]),
    );
    out.push(`\n${source}: confusion (rows: label, columns: recognised, frames)`);
    out.push(table([['', ...RECOGNISED_COLS], ...LABEL_ROWS.map((l, i) => [l, ...s.confusion[i].map(String)])]));
  }
  return out.join('\n');
}

function table(rows: string[][]): string {
  const widths = rows[0].map((_, c) => Math.max(...rows.map((r) => r[c].length)));
  return rows.map((r) => r.map((cell, c) => cell.padEnd(widths[c])).join('  ')).join('\n');
}
