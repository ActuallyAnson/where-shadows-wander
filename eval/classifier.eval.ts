// `npm run eval`: replays every labelled recording through the shape classifier
// and reports accuracy, hits, false triggers and time to commit per source
// (src/engine/hands/classifier-eval.ts has the metrics). Runs under Vitest so
// it needs no extra tooling (and isn't type-checked by `npm run typecheck`, which
// covers src/ only: Node's types aren't installed). Options are environment variables:
//   EVAL_DIR=recordings                folder searched for *.handrec.json (default recordings/)
//   EVAL_CALIBRATE=1                   calibrate each hand from its first flat prompt, as a player would
//   EVAL_BASELINE=eval-reports/x.json  print the change from an earlier report
//   EVAL_EXTRACT=<file>:<hand>:<start>-<end>:<name>
//                                      cut a regression fixture into src/engine/hands/fixtures/
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { it } from 'vitest';
import {
  evaluateRecording,
  formatReport,
  summarise,
  type RecordingEval,
  type SourceSummary,
} from '../src/engine/hands/classifier-eval';
import { parseRecording } from '../src/engine/hands/hand-recording';
import { trimRecording } from '../src/engine/hands/recording-trim';
import { DEFAULT_CLASSIFIER_CONFIG } from '../src/engine/hands/shape-classifier';
import { SETTLE_S } from '../src/engine/hands/shape-script';

const REPORT_VERSION = 1;
const MAX_FIXTURE_BYTES = 256 * 1024;

function findRecordings(dir: string): string[] {
  let out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out = out.concat(findRecordings(path));
    else if (name.endsWith('.handrec.json')) out.push(path);
  }
  return out;
}

function extractFixture(spec: string): void {
  const m = /^(.+):(left|right):(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?):([\w-]+)$/.exec(spec);
  if (!m) throw new Error('EVAL_EXTRACT must look like <file>:<hand>:<start>-<end>:<name>');
  const [, file, hand, startText, endText, name] = m;
  const [start, end] = [Number(startText), Number(endText)];
  if (!(end > start)) throw new Error('EVAL_EXTRACT: the end must be after the start');
  const source = parseRecording(JSON.parse(readFileSync(file, 'utf8')));
  // A label cut short at the front starts mid-hold and skews its time to commit: start before its prompt.
  for (const l of source.labels)
    if (l.hand === hand && l.end > start && l.start < end && start > l.start - SETTLE_S)
      throw new Error(`EVAL_EXTRACT: start at or before ${(l.start - SETTLE_S).toFixed(2)} s (the ${l.shape} prompt)`);
  const rec = trimRecording(source, start, end, hand as 'left' | 'right');
  if (JSON.stringify(rec).length > MAX_FIXTURE_BYTES) throw new Error('EVAL_EXTRACT: over 256 KB; cut a shorter range');
  const out = join('src/engine/hands/fixtures', `${name}.handrec.json`);
  writeFileSync(out, JSON.stringify(rec));
  const result = evaluateRecording(rec);
  console.info(`Wrote ${out} (${rec.frames.length} frames, ${rec.labels.length} labels).`);
  console.info('Add it to src/engine/hands/fixtures/manifest.ts with the result you expect, e.g.:');
  console.info(
    JSON.stringify(
      { file: `${name}.handrec.json`, why: '<what it shows>', expect: { maxFalseCommits: result.falseCommits.length } },
      null,
      2,
    ),
  );
}

function compare(now: Record<string, SourceSummary>, before: Record<string, SourceSummary>): string {
  const lines = ['Change from the baseline:'];
  for (const [source, s] of Object.entries(now)) {
    const b = before[source];
    if (!b) continue;
    const d = (x: number, y: number) => `${x - y >= 0 ? '+' : ''}${((x - y) * 100).toFixed(1)} pts`;
    const sec = (x: number | null, y: number | null) =>
      x === null || y === null ? '-' : `${x - y >= 0 ? '+' : ''}${(x - y).toFixed(2)} s`;
    lines.push(
      `  ${source}: accuracy ${d(s.accuracy, b.accuracy)}, hits ${d(s.hitRate, b.hitRate)}, ` +
        `false/min ${(s.falsePerMinute - b.falsePerMinute).toFixed(2)}, flicker ${s.flicker - b.flicker}, ` +
        `verb commit median ${sec(s.timeToCommit.verbs.median, b.timeToCommit.verbs.median)}`,
    );
  }
  return lines.join('\n');
}

it('classifier evaluation', () => {
  const env = process.env;
  if (env.EVAL_EXTRACT) return extractFixture(env.EVAL_EXTRACT);

  const dir = env.EVAL_DIR ?? 'recordings';
  let files: string[] = [];
  try {
    files = findRecordings(dir);
  } catch {
    // Missing folder: handled below.
  }
  if (files.length === 0)
    throw new Error(
      `No .handrec.json files in ${dir}/. Make labelled recordings with Guided recording in the Hand Lab ` +
        '(webcam source) or ?record&script=shapes on a headset, and put them there.',
    );

  const evals: (RecordingEval & { file: string })[] = [];
  for (const file of files) {
    try {
      const options = { calibrate: env.EVAL_CALIBRATE === '1' };
      evals.push({ ...evaluateRecording(parseRecording(JSON.parse(readFileSync(file, 'utf8'))), {}, options), file });
    } catch (e) {
      console.info(`skipped ${relative('.', file)}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  for (const e of evals) if (e.skipped) console.info(`skipped ${relative('.', e.file)}: ${e.skipped}`);
  const summary = summarise(evals);
  if (!summary.overall)
    throw new Error(
      evals.length ? 'None of the recordings have labels to score.' : 'None of the recordings could be read.',
    );
  if (env.EVAL_CALIBRATE === '1') console.info("Calibrated from each hand's first flat prompt.");
  console.info(`\n${formatReport(summary)}\n`);

  // The worst labels per recording, to find what to look at (and cut as fixtures).
  const worst = evals
    .filter((e) => !e.skipped)
    .flatMap((e) =>
      e.labels
        .filter((l) => l.frames > 0)
        .map((l) => ({
          file: relative('.', e.file),
          ...l.label,
          // Of frames that weren't paused, like the summary.
          accuracy: l.frames > l.paused ? l.correct / (l.frames - l.paused) : 0,
        })),
    )
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 10);
  console.info('Worst labels:');
  for (const w of worst)
    console.info(`  ${(w.accuracy * 100).toFixed(0)}%  ${w.shape} ${w.hand} ${w.start}-${w.end} s  ${w.file}`);
  const falseCommits = evals.flatMap((e) => e.falseCommits.map((c) => ({ file: relative('.', e.file), ...c })));
  if (falseCommits.length) {
    console.info('False commits (candidates for regression fixtures):');
    for (const c of falseCommits)
      console.info(`  ${c.t.toFixed(2)} s  ${c.hand} ${c.shape} during ${c.label}  ${c.file}`);
  }

  mkdirSync('eval-reports', { recursive: true });
  const createdAt = new Date().toISOString();
  const out = join('eval-reports', `classifier-${createdAt.replace(/[:.]/g, '-')}.json`);
  const report = {
    reportVersion: REPORT_VERSION,
    createdAt,
    config: DEFAULT_CLASSIFIER_CONFIG,
    calibrated: env.EVAL_CALIBRATE === '1',
    recordings: evals.map((e) => ({ file: relative('.', e.file), source: e.source, skipped: e.skipped })),
    ...summary,
    worst,
    falseCommits,
  };
  writeFileSync(out, JSON.stringify(report, null, 2));
  console.info(`\nReport: ${out}`);

  if (env.EVAL_BASELINE) {
    const before = JSON.parse(readFileSync(env.EVAL_BASELINE, 'utf8')) as {
      reportVersion: number;
      recordings: { file: string }[];
      bySource: Record<string, SourceSummary>;
      overall: SourceSummary | null;
    };
    if (before.reportVersion !== REPORT_VERSION) console.info('The baseline is from another report version.');
    const files = (rs: { file: string }[]) => JSON.stringify(rs.map((r) => r.file).sort());
    if (files(before.recordings) !== files(report.recordings))
      console.info('The baseline scored a different set of recordings, so the change is only rough.');
    const now: Record<string, SourceSummary> = { ...(summary.bySource as Record<string, SourceSummary>) };
    if (summary.overall) now.all = summary.overall;
    const was: Record<string, SourceSummary> = { ...before.bySource };
    if (before.overall) was.all = before.overall;
    console.info(compare(now, was));
  }
});
