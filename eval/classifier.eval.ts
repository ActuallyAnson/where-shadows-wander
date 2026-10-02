// `npm run eval`: replays every labelled recording through the shape classifier
// and reports accuracy, hits, false triggers and time to commit per source
// (src/engine/hands/classifier-eval.ts has the metrics). Runs under Vitest so
// it needs no extra tooling. Options are environment variables:
//   EVAL_DIR=recordings                folder searched for *.handrec.json (default recordings/)
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

const REPORT_VERSION = 1;

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
  const m = /^(.+):(left|right):([\d.]+)-([\d.]+):([\w-]+)$/.exec(spec);
  if (!m) throw new Error('EVAL_EXTRACT must look like <file>:<hand>:<start>-<end>:<name>');
  const [, file, hand, start, end, name] = m;
  const rec = trimRecording(
    parseRecording(JSON.parse(readFileSync(file, 'utf8'))),
    Number(start),
    Number(end),
    hand as 'left' | 'right',
  );
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
    lines.push(
      `  ${source}: accuracy ${d(s.accuracy, b.accuracy)}, hits ${d(s.hitRate, b.hitRate)}, ` +
        `false/min ${(s.falsePerMinute - b.falsePerMinute).toFixed(2)}`,
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
      evals.push({ ...evaluateRecording(parseRecording(JSON.parse(readFileSync(file, 'utf8')))), file });
    } catch (e) {
      console.info(`skipped ${relative('.', file)}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  for (const e of evals) if (e.skipped) console.info(`skipped ${relative('.', e.file)}: ${e.skipped}`);
  const summary = summarise(evals);
  if (!summary.overall) throw new Error('None of the recordings have labels to score.');
  console.info(`\n${formatReport(summary)}\n`);

  // The worst labels per recording, to find what to look at (and cut as fixtures).
  const worst = evals
    .filter((e) => !e.skipped)
    .flatMap((e) =>
      e.labels
        .filter((l) => l.frames > 0)
        .map((l) => ({ file: relative('.', e.file), ...l.label, accuracy: l.correct / l.frames })),
    )
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 10);
  console.info('Worst labels:');
  for (const w of worst)
    console.info(`  ${(w.accuracy * 100).toFixed(0)}%  ${w.shape} ${w.hand} ${w.start}-${w.end} s  ${w.file}`);

  mkdirSync('eval-reports', { recursive: true });
  const createdAt = new Date().toISOString();
  const out = join('eval-reports', `classifier-${createdAt.replace(/[:.]/g, '-')}.json`);
  const report = {
    reportVersion: REPORT_VERSION,
    createdAt,
    recordings: evals.map((e) => ({ file: relative('.', e.file), source: e.source, skipped: e.skipped })),
    ...summary,
    worst,
  };
  writeFileSync(out, JSON.stringify(report, null, 2));
  console.info(`\nReport: ${out}`);

  if (env.EVAL_BASELINE) {
    const before = JSON.parse(readFileSync(env.EVAL_BASELINE, 'utf8')) as { bySource: Record<string, SourceSummary> };
    console.info(compare(summary.bySource as Record<string, SourceSummary>, before.bySource));
  }
});
