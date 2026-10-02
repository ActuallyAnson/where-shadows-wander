// Recorded hands through the gesture detector. The clips are in
// src/engine/hands/fixtures/gestures/ (cut with EVAL_EXTRACT, see getting-started section 9).
import { describe, expect, it } from 'vitest';
import { createHandFrame } from './hand';
import { parseRecording, replayInto } from './hand-recording';
import { GestureDetector } from './gesture-detector';

const files = import.meta.glob('./fixtures/gestures/*.handrec.json', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;
const clip = (name: string) => parseRecording(JSON.parse(files[`./fixtures/gestures/${name}.handrec.json`]));

function replay(name: string, lantern: [number, number, number] | null = null) {
  const rec = clip(name);
  const d = new GestureDetector();
  d.setLantern(lantern);
  const hands = { left: createHandFrame('left'), right: createHandFrame('right') };
  const events: { type: string; t: number }[] = [];
  for (const f of rec.frames) {
    replayInto(f, 'left', hands.left);
    replayInto(f, 'right', hands.right);
    d.update(hands, f.t);
    for (let i = 0; i < d.events.count; i++) events.push({ type: d.events.at(i).type, t: d.events.at(i).t });
  }
  return events;
}

describe('gestures on recorded hands', () => {
  it('the emulator pinch fires one pinch-release when the fingers open', () => {
    // The right hand pinches from about 0.7 s and lets go at about 1.7 s into the clip. (The hand never
    // closes, so this clip says nothing about cover-flame; that needs a recorded session of shapes.)
    const events = replay('emulator-pinch', [0, 1.15, -0.2]);
    expect(events.map((e) => e.type)).toEqual(['pinch-release']);
    expect(events[0].t).toBeGreaterThan(1.3);
    expect(events[0].t).toBeLessThan(1.9);
  });
});
