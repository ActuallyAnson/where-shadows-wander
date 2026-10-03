import { describe, expect, it } from 'vitest';
import { createHandFrame, type Handedness, type Vec3 } from './hand';
import { createHandFeatures, computeHandFeatures, handFeatures } from './hand-features';
import { bestShape, clearWinner, FEATURE_COUNT, packFeatures, SHAPE_RANGES, shapeMargin } from './shape-ranges';
import { SHAPES, type Shape } from './shapes';
import { clonePose, jitterHand, PRESETS, seededRandom, writeHandPose, type PresetName } from './synthetic-hand';

const W: Vec3 = [0, 1, -0.4];
const features = createHandFeatures();
const packed = new Float32Array(FEATURE_COUNT);

function classify(
  preset: PresetName,
  side: Handedness = 'right',
  turn = { roll: 0, pitch: 0, yaw: 0 },
  jitter = 0,
  seed = 1,
) {
  const pose = clonePose(PRESETS[preset]);
  pose.rollDeg += turn.roll;
  pose.pitchDeg += turn.pitch;
  pose.yawDeg += turn.yaw;
  const hand = writeHandPose(pose, W, createHandFrame(side));
  if (jitter) jitterHand(hand, jitter, seededRandom(seed));
  return bestShape(computeHandFeatures(hand, features)!);
}

function margin(preset: PresetName, shape: Shape, side: Handedness = 'right') {
  const f = handFeatures(writeHandPose(PRESETS[preset], W, createHandFrame(side)))!;
  return shapeMargin(packFeatures(f, packed), SHAPE_RANGES[shape]);
}

describe('shape ranges', () => {
  it.each(SHAPES.flatMap((s) => [[s, 'left'] as const, [s, 'right'] as const]))(
    '%s (%s hand) is its own shape, comfortably',
    (shape, side) => {
      expect(classify(shape, side)).toBe(shape);
      expect(margin(shape, shape, side)).toBeGreaterThan(0.3);
    },
  );

  it('each preset matches no other shape', () => {
    for (const preset of SHAPES)
      for (const other of SHAPES) if (other !== preset) expect(margin(preset, other)).toBeLessThan(0);
  });

  it('a relaxed hand matches nothing, even with tracking noise', () => {
    for (let seed = 1; seed <= 200; seed++) expect(classify('relaxed', 'right', undefined, 0.003, seed)).toBeNull();
  });

  it('classifies at least 98 % of presets correctly with 3 mm of tracking noise', () => {
    for (const shape of SHAPES) {
      let ok = 0;
      for (let seed = 1; seed <= 200; seed++) if (classify(shape, 'right', undefined, 0.003, seed) === shape) ok++;
      expect(ok / 200, shape).toBeGreaterThanOrEqual(0.98);
    }
  });

  it('copes with the hand turned within plausible ranges', () => {
    const turns: { roll: number; pitch: number; yaw: number }[] = [];
    for (const yaw of [-45, 0, 45])
      for (const pitch of [-20, 0, 20]) for (const roll of [-30, 0, 30]) turns.push({ roll, pitch, yaw });
    for (const shape of SHAPES) {
      const ok = turns.filter((t) => classify(shape, 'right', t) === shape).length;
      expect(ok / turns.length, shape).toBeGreaterThanOrEqual(0.95);
    }
    // Shadow puppets are often made sideways: rabbit and fist don't depend on the palm.
    for (const shape of ['rabbit', 'fist'] as const)
      for (const roll of [-90, 90])
        expect(classify(shape, 'right', { roll, pitch: 0, yaw: 0 }), `${shape} ${roll}`).toBe(shape);
    // The fox is turned so its palm faces sideways; with the palm down it is a flat hand with the thumb out.
    expect(classify('fox', 'right', { roll: 0, pitch: 0, yaw: 0 })).toBe('fox');
    for (const roll of [-90, 90])
      expect(classify('fox', 'right', { roll, pitch: 0, yaw: 0 }), `fox rolled ${roll}`).not.toBe('fox');
  });

  it('a flat hand turned palm-sideways is not flat', () => {
    expect(classify('flat', 'right', { roll: 90, pitch: 0, yaw: 0 })).not.toBe('flat');
  });

  it('tolerance widens by whole units, and every preset stays its own shape up to tolerance 3', () => {
    for (const shape of SHAPES) {
      const f = handFeatures(writeHandPose(PRESETS[shape], W, createHandFrame('right')))!;
      const v = packFeatures(f, packed);
      expect(shapeMargin(v, SHAPE_RANGES[shape], 1)).toBeCloseTo(shapeMargin(v, SHAPE_RANGES[shape], 0) + 1, 5);
      for (const tolerance of [1, 2, 3]) expect(bestShape(f, tolerance), `${shape} at ${tolerance}`).toBe(shape);
    }
  });

  it('picks no winner when two shapes match about equally', () => {
    expect(clearWinner(new Float32Array([0.5, 0.4, -1, -1, -1, -1]), 0.25)).toBe(-1);
    expect(clearWinner(new Float32Array([0.8, 0.4, -1, -1, -1, -1]), 0.25)).toBe(0);
    expect(clearWinner(new Float32Array([-1, 0.1, -1, -1, -1, -1]), 0.25)).toBe(1);
    expect(clearWinner(new Float32Array([-1, -1, -1, -1, -1, -1]), 0.25)).toBe(-1);
  });
});
