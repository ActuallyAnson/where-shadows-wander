import { describe, expect, it } from 'vitest';
import { createHandFrame, JOINT_COUNT } from './hand';
import { addLabels, createRecording, parseRecording, recordFrame, replayInto, type ShapeLabel } from './hand-recording';

describe('hand recording', () => {
  it('round-trips positions to the millimetre and keeps tracking state', () => {
    const left = createHandFrame('left');
    const right = createHandFrame('right');
    for (let i = 0; i < JOINT_COUNT * 3; i++) right.positions[i] = 0.1234 + i * 0.001;
    right.tracked = true;
    right.validJoints = 25;
    left.validJoints = 7; // partial: recorded as null, but the count is kept

    const rec = createRecording('test', 'ua', '2026-10-02T00:00:00Z');
    recordFrame(rec, 0.0166, left, right, [0, 1.6, 0]);
    const json = JSON.parse(JSON.stringify(rec));

    const outR = replayInto(json.frames[0], 'right', createHandFrame('right'));
    const outL = replayInto(json.frames[0], 'left', createHandFrame('left'));
    expect(outR.tracked).toBe(true);
    expect(outR.positions[0]).toBeCloseTo(0.123, 3);
    expect(outL.tracked).toBe(false);
    expect(outL.validJoints).toBe(7);
    expect(json.frames[0].head).toEqual([0, 1600, 0]);
  });

  it('accepts its own format and rejects anything else', () => {
    const rec = createRecording('test', 'ua', '2026-10-02T00:00:00Z');
    expect(() => parseRecording(rec)).toThrow('no frames');
    recordFrame(rec, 0, createHandFrame('left'), createHandFrame('right'), null);
    expect(parseRecording(JSON.parse(JSON.stringify(rec))).frames).toHaveLength(1);
    expect(() => parseRecording({ hello: 1 })).toThrow('Not a hand recording');
    expect(() => parseRecording(null)).toThrow('Not a hand recording');
    expect(() => parseRecording({ ...rec, version: 99 })).toThrow('version 99');
  });

  it('writes version 2 with an empty label list', () => {
    const rec = createRecording('test', 'ua', '2026-10-03T00:00:00Z');
    expect(rec.version).toBe(2);
    expect(rec.labels).toEqual([]);
  });

  it('round-trips labels through JSON, with times rounded to the millisecond', () => {
    const rec = recordingWithFrames(5);
    addLabels(rec, [
      { start: 0.50004, end: 2.4999, hand: 'right', shape: 'fist' },
      { start: 3, end: 4, hand: 'left', shape: 'none' },
    ]);
    const back = parseRecording(JSON.parse(JSON.stringify(rec)));
    expect(back.labels).toEqual([
      { start: 0.5, end: 2.5, hand: 'right', shape: 'fist' },
      { start: 3, end: 4, hand: 'left', shape: 'none' },
    ]);
  });

  it('leaves out labels that end after the last frame', () => {
    const rec = recordingWithFrames(2);
    addLabels(rec, [
      { start: 0.5, end: 1.5, hand: 'right', shape: 'cup' },
      { start: 1.5, end: 2.5, hand: 'right', shape: 'fox' },
    ]);
    expect(rec.labels.map((l) => l.shape)).toEqual(['cup']);
  });

  it('reads version 1 recordings as unlabelled', () => {
    const v2 = recordingWithFrames(1);
    const { labels: _labels, ...rest } = v2;
    const v1 = JSON.parse(JSON.stringify({ ...rest, version: 1 }));
    const back = parseRecording(v1);
    expect(back.version).toBe(2);
    expect(back.labels).toEqual([]);
    expect(back.frames).toHaveLength(v2.frames.length);
  });

  it('rejects malformed labels', () => {
    const bad: unknown[] = [
      { start: 2, end: 1, hand: 'right', shape: 'fist' },
      { start: 0, end: 1, hand: 'both', shape: 'fist' },
      { start: 0, end: 1, hand: 'left', shape: 'pinch' },
      { start: NaN, end: 1, hand: 'left', shape: 'fist' },
    ];
    for (const label of bad) {
      const rec = { ...recordingWithFrames(1), labels: [label as ShapeLabel] };
      expect(() => parseRecording(rec)).toThrow('Bad label 0');
    }
    expect(() => parseRecording({ ...recordingWithFrames(1), labels: 'fist' })).toThrow('labels are missing');
  });
});

/** A recording with a frame every 0.1 s for `seconds`. */
function recordingWithFrames(seconds: number) {
  const rec = createRecording('test', 'ua', '2026-10-03T00:00:00Z');
  const l = createHandFrame('left'),
    r = createHandFrame('right');
  for (let i = 0; i <= seconds * 10; i++) recordFrame(rec, i / 10, l, r, null);
  return rec;
}
