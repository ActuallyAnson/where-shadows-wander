import { describe, expect, it } from 'vitest';
import { createHandFrame } from './hand';
import { GuidedRecording } from './guided-recording';
import { ShapeScript } from './shape-script';

const script = new ShapeScript([
  { hand: 'right', shape: 'fist', seconds: 2 },
  { hand: 'right', shape: 'cup', seconds: 2 },
]);
const l = createHandFrame('left'),
  r = createHandFrame('right');

describe('guided recording', () => {
  it('records until the script ends, then stops', () => {
    const g = new GuidedRecording(script, 'test', 'ua', '2026-10-03T00:00:00Z');
    let recorded = 0;
    for (let i = 0; i < 50; i++) if (g.frame(i / 10, l, r, null)) recorded++;
    expect(recorded).toBe(40);
    expect(g.done).toBe(true);
    expect(g.prompt.text).toBe(script.doneText);
    const rec = g.finish();
    expect(rec.labels.map((x) => x.shape)).toEqual(['fist', 'cup']);
    expect(g.finish().labels).toHaveLength(2); // finishing twice doesn't add labels twice
  });

  it('drops labels that end after the last frame', () => {
    const g = new GuidedRecording(script, 'test', 'ua', '2026-10-03T00:00:00Z');
    for (let i = 0; i < 25; i++) g.frame(i / 10, l, r, null); // stopped at 2.4 s
    expect(g.finish().labels.map((x) => x.shape)).toEqual(['fist']);
  });
});
