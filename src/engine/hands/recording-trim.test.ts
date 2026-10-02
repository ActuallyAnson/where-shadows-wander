import { describe, expect, it } from 'vitest';
import { createHandFrame } from './hand';
import { createRecording, recordFrame } from './hand-recording';
import { trimRecording } from './recording-trim';
import { PRESETS, writeHandPose } from './synthetic-hand';

describe('trim recording', () => {
  it('keeps one hand and the time range, re-timed, with labels clipped', () => {
    const rec = createRecording('webcam', 'ua', 'x');
    const l = writeHandPose(PRESETS.fist, [-0.1, 1, -0.4], createHandFrame('left'));
    const r = writeHandPose(PRESETS.cup, [0.1, 1, -0.4], createHandFrame('right'));
    for (let i = 0; i <= 50; i++) recordFrame(rec, i / 10, l, r, null);
    rec.labels = [
      { start: 0.5, end: 2.5, hand: 'right', shape: 'cup' },
      { start: 3, end: 4.5, hand: 'right', shape: 'none' },
      { start: 1, end: 2, hand: 'left', shape: 'fist' },
    ];
    const t = trimRecording(rec, 2, 4, 'right');
    expect(t.frames[0].t).toBe(0);
    expect(t.frames.at(-1)!.t).toBe(2);
    expect(t.frames.every((f) => f.left === null && f.right !== null && f.valid[0] === 0)).toBe(true);
    expect(t.labels).toEqual([
      { start: 0, end: 0.5, hand: 'right', shape: 'cup' },
      { start: 1, end: 2, hand: 'right', shape: 'none' },
    ]);
    expect(t.note).toContain('trimmed');
  });
});
