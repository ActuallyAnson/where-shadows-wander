import { describe, expect, it } from 'vitest';
import { evaluateRecording } from './classifier-eval';
import { FIXTURES } from './fixtures/manifest';
import { parseRecording } from './hand-recording';

const files = import.meta.glob('./fixtures/*.handrec.json', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;
const byName = new Map(Object.entries(files).map(([path, text]) => [path.split('/').pop()!, text]));

describe('classifier regression fixtures', () => {
  it('lists every fixture file, and every listed file exists', () => {
    expect([...byName.keys()].sort()).toEqual(FIXTURES.map((f) => f.file).sort());
  });

  it('keeps fixtures small', () => {
    let total = 0;
    for (const [name, text] of byName) {
      expect(text.length, name).toBeLessThanOrEqual(256 * 1024);
      total += text.length;
    }
    expect(total).toBeLessThanOrEqual(2 * 1024 * 1024);
  });

  it.each(FIXTURES.map((f) => [f.file, f] as const))('%s still gives its expected result', (_, fixture) => {
    const e = evaluateRecording(parseRecording(JSON.parse(byName.get(fixture.file)!)));
    const x = fixture.expect;
    expect(e.skipped).toBeNull();
    expect(e.falseCommits.length).toBeLessThanOrEqual(x.maxFalseCommits);
    if (x.minAccuracy !== undefined) {
      const frames = e.labels.reduce((n, l) => n + l.frames - l.paused, 0);
      const correct = e.labels.reduce((n, l) => n + l.correct, 0);
      expect(correct / frames).toBeGreaterThanOrEqual(x.minAccuracy);
    }
    if (x.allHit) for (const l of e.labels) if (l.label.shape !== 'none') expect(l.hit, l.label.shape).toBe(true);
    if (x.maxFlicker !== undefined) for (const l of e.labels) expect(l.flicker).toBeLessThanOrEqual(x.maxFlicker);
  });
});
