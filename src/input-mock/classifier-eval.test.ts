// The classifier against a guided run of the scripted (synthetic) hands, with
// tracking noise: the CI gate for #11's targets. Lives here because pure
// folders can't import the mock ScriptedSource.
import { describe, expect, it } from 'vitest';
import { evaluateRecording, summarise, type RecordingEval } from '../engine/hands/classifier-eval';
import { createHandFrame } from '../engine/hands/hand';
import { GuidedRecording } from '../engine/hands/guided-recording';
import { parseRecording } from '../engine/hands/hand-recording';
import { SHAPES_SCRIPT, ShapeScript } from '../engine/hands/shape-script';
import { COMPANION_SHAPES, SHAPES } from '../engine/hands/shapes';
import { jitterHand, seededRandom } from '../engine/hands/synthetic-hand';
import { ScriptedSource } from './scripted-source';
import { BLEND_S } from './synthetic-source';

function syntheticRun(seed: number, jitterM = 0.002, fps = 72): RecordingEval {
  const source = new ScriptedSource(SHAPES_SCRIPT, false);
  const guided = new GuidedRecording(
    new ShapeScript(SHAPES_SCRIPT),
    'Hand Lab guided, script',
    'ua',
    '2026-10-03T00:00:00Z',
  );
  const l = createHandFrame('left'),
    r = createHandFrame('right');
  const random = seededRandom(seed);
  for (let i = 0; ; i++) {
    const t = i / fps;
    source.update(t, l, r);
    jitterHand(l, jitterM, random);
    jitterHand(r, jitterM, random);
    if (!guided.frame(t, l, r, null)) break;
  }
  return evaluateRecording(parseRecording(JSON.parse(JSON.stringify(guided.finish()))));
}

describe('classifier on a synthetic guided run with 2 mm of noise', () => {
  const summary = summarise([1, 2, 3].map((seed) => syntheticRun(seed))).bySource.synthetic!;

  it('recognises every label at least 98 % of the time', () => {
    for (const label of [...SHAPES, 'none'] as const)
      expect(summary.byLabel[label].accuracy, label).toBeGreaterThanOrEqual(0.98);
  });

  it('commits every prompted shape, never the wrong one, without flicker', () => {
    expect(summary.hitRate).toBe(1);
    expect(summary.falseCommits).toBe(0);
    expect(summary.flicker).toBe(0);
  });

  it('commits within the hold time plus the pose blend', () => {
    expect(summary.timeToCommit.verbs.p95!).toBeLessThanOrEqual(0.4 + BLEND_S + 0.1);
    expect(summary.timeToCommit.companions.p95!).toBeLessThanOrEqual(1 + BLEND_S + 0.1);
    expect(COMPANION_SHAPES.length).toBe(2);
  });
});
