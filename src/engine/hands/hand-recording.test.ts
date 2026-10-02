import { describe, expect, it } from 'vitest';
import { createHandFrame, JOINT_COUNT } from './hand';
import { createRecording, parseRecording, recordFrame, replayInto } from './hand-recording';

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
});
