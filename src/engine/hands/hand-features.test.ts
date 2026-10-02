import { describe, expect, it } from 'vitest';
import { createHandFrame, JOINT, JOINT_COUNT } from './hand';
import { handFeatures, roughShape } from './hand-features';

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
    expect(roughShape(f)).toBe('flat (fingers together)');
  });

  it('reads curled fingers as a fist', () => {
    const f = handFeatures(hand(70))!;
    expect(f.meanCurl).toBeGreaterThan(0.9);
    expect(roughShape(f)).toBe('fist');
  });

  it('reads spread fingers as open', () => {
    const f = handFeatures(hand(0, 40))!;
    expect(f.spreadDeg).toBeGreaterThan(30);
    expect(roughShape(f)).toBe('open (fingers spread)');
  });

  it('returns null for an untracked hand', () => {
    expect(handFeatures(createHandFrame('left'))).toBeNull();
  });
});
