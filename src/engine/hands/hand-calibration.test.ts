import { describe, expect, it } from 'vitest';
import { createHandFrame, type Vec3 } from './hand';
import { CALIBRATION_HOLD_S, MAX_CURL_BIAS, biasFromSamples } from './hand-calibration';
import { computeHandFeatures, createHandFeatures, handFeatures } from './hand-features';
import { ShapeRecognizer } from './shape-recognizer';
import { clonePose, PRESETS, writeHandPose, type HandPose, type PresetName } from './synthetic-hand';

const W: Vec3 = [0.1, 1, -0.4];
const FPS = 60;

/** A preset as a tracker with an offset would read it: every finger bent `extra` more. */
function offset(preset: PresetName, extra: number): HandPose {
  const p = clonePose(PRESETS[preset]);
  for (const f of p.fingers) f.curl = Math.min(f.curl + extra, 1);
  return p;
}

function run(r: ShapeRecognizer, pose: HandPose, seconds: number, t0 = 0): number {
  const hands = { left: createHandFrame('left'), right: createHandFrame('right') };
  writeHandPose(pose, W, hands.right);
  let t = t0;
  for (let i = 0; i < seconds * FPS; i++) r.update(hands, (t = t0 + i / FPS));
  return t;
}

describe('hand calibration', () => {
  it('measures curl from the baseline, and a full curl still reads 1', () => {
    const bias = new Float32Array([0, 0.3, 0.3, 0.3, 0.3]);
    const flat = computeHandFeatures(
      writeHandPose(offset('flat', 0.3), W, createHandFrame('right')),
      createHandFeatures(),
      undefined,
      bias,
    )!;
    expect(flat.meanCurl).toBeLessThan(0.08);
    const fist = computeHandFeatures(
      writeHandPose(PRESETS.fist, W, createHandFrame('right')),
      createHandFeatures(),
      undefined,
      bias,
    )!;
    expect(fist.meanCurl).toBeGreaterThan(0.9);
  });

  it('takes each finger median and caps it', () => {
    const b = biasFromSamples([
      [0.1, 0.2, 0.9, 0.3, 0.3],
      [0.1, 0.3, 0.9, 0.3, 0.3],
      [0.1, 0.25, 0.9, 0.3, 0.3],
    ]);
    expect(b[1]).toBeCloseTo(0.25);
    expect(b[2]).toBe(MAX_CURL_BIAS);
  });

  it('turns an offset flat hand back into flat, and keeps relaxed and fist apart', () => {
    const r = new ShapeRecognizer();
    run(r, offset('flat', 0.3), 1);
    expect(r.right.state.committed).toBeNull(); // 0.3 curl is no flat hand
    const cal = r.startCalibration('right');
    let t = run(r, offset('flat', 0.3), CALIBRATION_HOLD_S + 0.2, 1);
    expect(cal.state).toBe('done');
    expect(cal.bias[1]).toBeGreaterThan(0.25);
    t = run(r, offset('flat', 0.3), 1, t);
    expect(r.right.state.committed).toBe('flat');
    t = run(r, offset('relaxed', 0.3), 1, t);
    expect(r.right.state.committed).toBeNull();
    run(r, offset('fist', 0.3), 1, t);
    expect(r.right.state.committed).toBe('fist');
  });

  it('refuses a fist as a baseline', () => {
    const r = new ShapeRecognizer();
    const cal = r.startCalibration('right');
    run(r, PRESETS.fist, CALIBRATION_HOLD_S + 0.2);
    expect(cal.state).toBe('failed');
    expect(Array.from(r.calibration.right)).toEqual([0, 0, 0, 0, 0]);
  });

  it('only calibrates the hand it was started for, and can be cleared', () => {
    const r = new ShapeRecognizer();
    r.startCalibration('left');
    run(r, offset('flat', 0.3), CALIBRATION_HOLD_S + 0.2);
    expect(Array.from(r.calibration.right)).toEqual([0, 0, 0, 0, 0]);
    r.setCalibration('right', [0, 0.2, 0.2, 0.2, 0.2]);
    r.setCalibration('right', null);
    expect(Array.from(r.calibration.right)).toEqual([0, 0, 0, 0, 0]);
    expect(handFeatures(writeHandPose(PRESETS.flat, W, createHandFrame('right')))).not.toBeNull();
  });
});
