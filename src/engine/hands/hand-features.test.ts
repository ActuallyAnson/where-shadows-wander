import { describe, expect, it } from 'vitest';
import { createHandFrame, JOINT, JOINT_COUNT, type Vec3 } from './hand';
import { computeHandFeatures, createHandFeatures, handFeatures } from './hand-features';
import { bestShape } from './shape-ranges';
import { clonePose, PRESETS, writeHandPose, type PresetName } from './synthetic-hand';

/** Right hand, palm down, fingers along -Z. `curl` bends each finger joint down by that many degrees. */
function hand(curlDeg: number, spreadDeg = 0) {
  const h = createHandFrame('right');
  const set = (name: keyof typeof JOINT, v: number[]) => h.positions.set(v, JOINT[name] * 3);
  set('wrist', [0, 1, 0]);
  const fingers = ['index', 'middle', 'ring', 'pinky'] as const;
  fingers.forEach((f, i) => {
    const yaw = ((i - 1.5) / 1.5) * (spreadDeg / 2) * (Math.PI / 180);
    let pos = [(i - 1.5) * 0.02, 1, -0.03];
    set(`${f}-finger-metacarpal` as never, pos);
    pos = [pos[0], 1, -0.09];
    set(`${f}-finger-phalanx-proximal` as never, pos);
    let pitch = 0;
    const lens = [0.04, 0.025, 0.02];
    const names = ['phalanx-intermediate', 'phalanx-distal', 'tip'];
    names.forEach((n, k) => {
      pitch += (curlDeg * Math.PI) / 180;
      const d = [Math.sin(yaw) * Math.cos(pitch), -Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)];
      pos = pos.map((c, a) => c + d[a] * lens[k]);
      set(`${f}-finger-${n}` as never, pos);
    });
  });
  // Thumb off to the side, away from the index tip.
  set('thumb-metacarpal', [-0.03, 1, -0.02]);
  set('thumb-phalanx-proximal', [-0.05, 1, -0.04]);
  set('thumb-phalanx-distal', [-0.06, 1, -0.06]);
  set('thumb-tip', [-0.07, 1, -0.08]);
  h.tracked = true;
  h.validJoints = JOINT_COUNT;
  return h;
}

describe('hand features', () => {
  it('reads a flat hand as straight, together and not pinching', () => {
    const f = handFeatures(hand(0))!;
    expect(f.meanCurl).toBeLessThan(0.05);
    expect(f.spreadDeg).toBeLessThan(2);
    expect(f.pinchGapMm).toBeGreaterThan(40);
    expect(bestShape(f)).toBe('flat');
  });

  it('reads curled fingers as a fist', () => {
    const f = handFeatures(hand(70))!;
    expect(f.meanCurl).toBeGreaterThan(0.9);
    expect(bestShape(f)).toBe('fist');
  });

  it('reads spread fingers as open', () => {
    const f = handFeatures(hand(0, 40))!;
    expect(f.spreadDeg).toBeGreaterThan(30);
    expect(bestShape(f)).toBe('spread');
  });

  it('returns null for an untracked hand', () => {
    expect(handFeatures(createHandFrame('left'))).toBeNull();
  });
});

describe('hand features (classifier inputs)', () => {
  const W: Vec3 = [0, 1, -0.4];
  const pose = (p: PresetName, scale = 1) => writeHandPose(PRESETS[p], W, createHandFrame('right'), scale);

  it('computeHandFeatures writes into and returns the struct it was given', () => {
    const out = createHandFeatures();
    expect(computeHandFeatures(pose('flat'), out)).toBe(out);
    expect(computeHandFeatures(pose('fist'), out)).toBe(out);
    expect(out.meanCurl).toBeGreaterThan(0.8);
  });

  it('returns null with any joint missing, even when the positions are set', () => {
    const h = pose('flat');
    h.validJoints = 24;
    expect(computeHandFeatures(h, createHandFeatures())).toBeNull();
  });

  it('tip gaps are independent of hand size', () => {
    const small = handFeatures(pose('rabbit', 0.8))!,
      big = handFeatures(pose('rabbit', 1.2))!;
    for (let i = 0; i < 4; i++) expect(small.tipGap[i]).toBeCloseTo(big.tipGap[i], 3);
    expect(big.handSizeM / small.handSizeM).toBeCloseTo(1.5, 3);
  });

  it('palmStage follows the stage normal', () => {
    expect(handFeatures(pose('flat'))!.palmStage).toBeCloseTo(-1, 3);
    expect(handFeatures(pose('flat'), [0, -1, 0])!.palmStage).toBeCloseTo(1, 3);
    expect(handFeatures(pose('cup'))!.palmUp).toBeGreaterThan(0.9);
  });

  it('pair spreads add up to about the index-pinky spread for the spread preset', () => {
    const f = handFeatures(pose('spread'))!;
    const total = f.pairSpreadDeg[0] + f.pairSpreadDeg[1] + f.pairSpreadDeg[2];
    expect(total).toBeCloseTo(f.spreadDeg, 0);
    expect(f.spreadDeg).toBeGreaterThan(30);
  });

  it("curling fingers doesn't read as spreading them", () => {
    expect(handFeatures(pose('fist'))!.spreadDeg).toBeLessThan(10);
  });

  it('thumb angle separates flat from fox, with the thumb out to the side or lifted', () => {
    expect(handFeatures(pose('flat'))!.thumbFwdDeg).toBeLessThan(30);
    expect(handFeatures(pose('fox'))!.thumbFwdDeg).toBeGreaterThan(55);
    expect(Math.abs(handFeatures(pose('fox'))!.thumbElev)).toBeLessThan(0.3); // out to the side, in the palm plane
    const lifted = clonePose(PRESETS.fox);
    lifted.thumb.abductDeg = 10;
    lifted.thumb.liftDeg = 75;
    const f = handFeatures(writeHandPose(lifted, W, createHandFrame('right')))!;
    expect(f.thumbFwdDeg).toBeGreaterThan(55);
    expect(f.thumbElev).toBeGreaterThan(0.7);
    expect(handFeatures(pose('relaxed'))!.thumbFwdDeg).toBeLessThan(45);
  });
});
