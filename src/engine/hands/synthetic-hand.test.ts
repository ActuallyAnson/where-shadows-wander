import { describe, expect, it } from 'vitest';
import { createHandFrame, derivePalm, JOINT, JOINT_PARENT, type Handedness, type Vec3 } from './hand';
import { handFeatures } from './hand-features';
import { bestShape } from './shape-ranges';
import {
  clonePose,
  jitterHand,
  lerpPose,
  PRESETS,
  seededRandom,
  writeHandPose,
  type PresetName,
} from './synthetic-hand';

const WRIST: Vec3 = [0.1, 1, -0.4];

function make(preset: PresetName, side: Handedness = 'right') {
  const hand = writeHandPose(PRESETS[preset], WRIST, createHandFrame(side));
  return { hand, f: handFeatures(hand)!, palm: derivePalm(hand)! };
}

function tipGapMm(hand: ReturnType<typeof createHandFrame>, a: keyof typeof JOINT, b: keyof typeof JOINT): number {
  const p = hand.positions,
    i = JOINT[a] * 3,
    j = JOINT[b] * 3;
  return Math.hypot(p[i] - p[j], p[i + 1] - p[j + 1], p[i + 2] - p[j + 2]) * 1000;
}

describe('synthetic hand presets', () => {
  it.each(['left', 'right'] as const)('flat (%s): straight, together, palm down', (side) => {
    const { f, palm } = make('flat', side);
    expect(f.meanCurl).toBeLessThan(0.1);
    expect(f.spreadDeg).toBeLessThan(10);
    expect(f.pinchGapMm).toBeGreaterThan(30);
    expect(palm.normal[1]).toBeLessThan(-0.9);
    expect(bestShape(f)).toBe('flat');
  });

  it.each(['left', 'right'] as const)('fist (%s): all fingers curled', (side) => {
    const { f } = make('fist', side);
    expect(f.meanCurl).toBeGreaterThan(0.8);
    expect(bestShape(f)).toBe('fist');
  });

  it.each(['left', 'right'] as const)('cup (%s): half curled, palm up', (side) => {
    const { f, palm } = make('cup', side);
    expect(f.meanCurl).toBeGreaterThan(0.25);
    expect(f.meanCurl).toBeLessThan(0.6);
    expect(palm.normal[1]).toBeGreaterThan(0.9);
  });

  it.each(['left', 'right'] as const)('spread (%s): straight and wide', (side) => {
    const { f } = make('spread', side);
    expect(f.meanCurl).toBeLessThan(0.15);
    expect(f.spreadDeg).toBeGreaterThan(30);
    expect(bestShape(f)).toBe('spread');
  });

  it.each(['left', 'right'] as const)('rabbit (%s): index and middle up, ring pinched to the thumb', (side) => {
    const { hand, f } = make('rabbit', side);
    expect(f.curl.index).toBeLessThan(0.15);
    expect(f.curl.middle).toBeLessThan(0.15);
    expect(f.curl.ring).toBeGreaterThan(0.5);
    expect(f.curl.pinky).toBeGreaterThan(0.5);
    expect(tipGapMm(hand, 'thumb-tip', 'ring-finger-tip')).toBeLessThan(15);
    expect(f.pinchGapMm).toBeGreaterThan(30);
  });

  it.each(['left', 'right'] as const)('fox (%s): fingers together, thumb up', (side) => {
    const { hand, f } = make('fox', side);
    expect(f.meanCurl).toBeLessThan(0.1);
    expect(f.spreadDeg).toBeLessThan(10);
    const p = hand.positions;
    const rise = p[JOINT['thumb-tip'] * 3 + 1] - p[JOINT['thumb-metacarpal'] * 3 + 1];
    expect(rise).toBeGreaterThan(0.05);
  });

  it('gives mirror-image features for the left and right hands', () => {
    for (const preset of Object.keys(PRESETS) as PresetName[]) {
      const r = make(preset, 'right'),
        l = make(preset, 'left');
      expect(l.f.meanCurl).toBeCloseTo(r.f.meanCurl, 6);
      expect(l.f.spreadDeg).toBeCloseTo(r.f.spreadDeg, 3); // positions are Float32
      expect(l.f.pinchGapMm).toBeCloseTo(r.f.pinchGapMm, 3);
      expect(l.palm.normal[1]).toBeCloseTo(r.palm.normal[1], 6);
    }
  });

  it('keeps bone lengths the same whatever the pose', () => {
    const boneLengths = (preset: PresetName) => {
      const p = make(preset).hand.positions;
      return JOINT_PARENT.slice(1).map((parent, k) => {
        const j = k + 1;
        return Math.hypot(p[j * 3] - p[parent * 3], p[j * 3 + 1] - p[parent * 3 + 1], p[j * 3 + 2] - p[parent * 3 + 2]);
      });
    };
    // Finger bones only: the pinched thumb follows a curve, so its bones may stretch a little.
    const fingerBones = (xs: number[]) => xs.filter((_, k) => k + 1 >= JOINT['index-finger-metacarpal']);
    const flat = fingerBones(boneLengths('flat'));
    for (const preset of ['fist', 'cup', 'spread', 'fox'] as const) {
      fingerBones(boneLengths(preset)).forEach((len, i) => expect(len).toBeCloseTo(flat[i], 6));
    }
  });

  it('places the wrist where asked and scales the hand', () => {
    const big = writeHandPose(PRESETS.flat, WRIST, createHandFrame('right'), 1.2);
    expect([...big.positions.slice(0, 3)].map((x) => +x.toFixed(5))).toEqual(WRIST);
    const small = make('flat').hand;
    expect(tipGapMm(big, 'wrist', 'middle-finger-tip') / tipGapMm(small, 'wrist', 'middle-finger-tip')).toBeCloseTo(
      1.2,
      4,
    );
  });
});

describe('pose blending and jitter', () => {
  it('blends between two poses', () => {
    const out = clonePose(PRESETS.flat);
    lerpPose(PRESETS.flat, PRESETS.fist, 0.5, out);
    const mid = handFeatures(writeHandPose(out, WRIST, createHandFrame('right')))!;
    expect(mid.meanCurl).toBeGreaterThan(0.35);
    expect(mid.meanCurl).toBeLessThan(0.65);
  });

  it('repeats exactly with the same seed', () => {
    const a = make('cup').hand,
      b = make('cup').hand;
    jitterHand(a, 0.003, seededRandom(7));
    jitterHand(b, 0.003, seededRandom(7));
    expect([...a.positions]).toEqual([...b.positions]);
    expect([...a.positions]).not.toEqual([...make('cup').hand.positions]);
  });
});
