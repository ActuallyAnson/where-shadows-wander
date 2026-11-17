import { describe, expect, it } from 'vitest';
import { createHandShadow, CAPSULES_PER_HAND, CAPSULE_STRIDE } from '../../hands/hand-shadow';
import {
  MAX_CAPSULES,
  LOST_FADE_S,
  packShadowUniforms,
  CAPSULES_PER_SLOT,
  type ShadowUniformArrays,
} from './shadow-uniforms';

function arrays(): ShadowUniformArrays {
  return {
    caps: new Float32Array(MAX_CAPSULES * 4),
    radBlur: new Float32Array(MAX_CAPSULES * 2),
    bounds: new Float32Array(8),
    active: new Int32Array(2),
    opacity: new Float32Array(2),
    held: new Float32Array(2),
    lastOpacity: new Float32Array(2),
  };
}

function shadows() {
  const s = { left: createHandShadow('left'), right: createHandShadow('right') };
  const r = s.right;
  r.active = r.onStage = true;
  for (let c = 0; c < CAPSULES_PER_HAND; c++) {
    const o = c * CAPSULE_STRIDE;
    r.capsules.set([0.01 * c, 0.02, 0.01 * c + 0.01, 0.03, 0.005], o);
    r.blur[c] = 0.01;
  }
  r.bounds.set([-0.01, 0, 0.3, 0.05]);
  return s;
}

describe('shadow uniforms', () => {
  it('scales only the blur: capsule ends and radius are copied untouched', () => {
    const s = shadows();
    const plain = arrays();
    const sharp = arrays();
    packShadowUniforms(s, null, 0.88, plain, 0);
    packShadowUniforms(
      s,
      { left: { blurScale: 1, opacityBoost: 0 }, right: { blurScale: 0.3, opacityBoost: 0 } },
      0.88,
      sharp,
      0,
    );
    const slot = CAPSULES_PER_SLOT; // the right hand uses the second slot
    expect(sharp.caps.slice(slot * 4, MAX_CAPSULES * 4)).toEqual(plain.caps.slice(slot * 4, MAX_CAPSULES * 4));
    for (let c = 0; c < CAPSULES_PER_HAND; c++) {
      expect(sharp.radBlur[(slot + c) * 2]).toBe(plain.radBlur[(slot + c) * 2]); // radius
      expect(sharp.radBlur[(slot + c) * 2 + 1]).toBeCloseTo(plain.radBlur[(slot + c) * 2 + 1] * 0.3, 6);
    }
  });

  it('pads the bounds by half the scaled blur', () => {
    const s = shadows();
    const out = arrays();
    packShadowUniforms(
      s,
      { left: { blurScale: 1, opacityBoost: 0 }, right: { blurScale: 0.5, opacityBoost: 0 } },
      0.88,
      out,
      0,
    );
    expect(out.bounds[4]).toBeCloseTo(-0.01 - 0.0025, 6);
    expect(out.bounds[6]).toBeCloseTo(0.3 + 0.0025, 6);
  });

  it('pads the bounds by at least a millimetre even when the blur is tiny', () => {
    const s = shadows();
    for (let c = 0; c < CAPSULES_PER_HAND; c++) s.right.blur[c] = 0.0002;
    const out = arrays();
    packShadowUniforms(s, null, 0.88, out, 0);
    expect(out.bounds[4]).toBeCloseTo(-0.01 - 0.001, 6);
  });

  it('adds the opacity boost to the base, capped at 1, per hand', () => {
    const s = shadows();
    s.left.active = s.left.onStage = true;
    const out = arrays();
    packShadowUniforms(
      s,
      { left: { blurScale: 1, opacityBoost: 0.5 }, right: { blurScale: 1, opacityBoost: 0.05 } },
      0.88,
      out,
      0,
    );
    expect(out.opacity[0]).toBe(1);
    expect(out.opacity[1]).toBeCloseTo(0.93, 6);
  });

  it('draws a shadow that has left the stage rectangle: the wall fades it, not a hard cut', () => {
    const s = shadows();
    s.right.onStage = false;
    const out = arrays();
    expect(packShadowUniforms(s, null, 0.88, out, 0)).toBe(true);
    expect([...out.active]).toEqual([0, 1]);
  });

  it("fades a lost hand's last shadow out where it was, then marks it inactive", () => {
    const s = shadows();
    const out = arrays();
    packShadowUniforms(s, null, 0.88, out, 1 / 72);
    const caps = out.caps.slice();
    s.right.active = false;
    s.right.capsules.fill(9); // stale data from the projector must not be drawn
    expect(packShadowUniforms(s, null, 0.88, out, LOST_FADE_S / 4)).toBe(true);
    expect(out.active[1]).toBe(1);
    expect(out.caps).toEqual(caps);
    const first = out.opacity[1];
    expect(first).toBeGreaterThan(0.5);
    expect(first).toBeLessThan(0.88);
    packShadowUniforms(s, null, 0.88, out, LOST_FADE_S / 2);
    expect(out.opacity[1]).toBeLessThan(first);
    expect(packShadowUniforms(s, null, 0.88, out, LOST_FADE_S / 2)).toBe(false);
    expect([...out.active]).toEqual([0, 0]);
  });

  it('a hand found again is drawn at once, and a hand never seen has nothing to fade', () => {
    const s = shadows();
    const out = arrays();
    packShadowUniforms(s, null, 0.88, out, 0);
    s.right.active = false;
    packShadowUniforms(s, null, 0.88, out, LOST_FADE_S / 2);
    s.right.active = true;
    packShadowUniforms(s, null, 0.88, out, 1 / 72);
    expect(out.opacity[1]).toBeCloseTo(0.88, 6);
    expect(out.active[0]).toBe(0);
  });
});
