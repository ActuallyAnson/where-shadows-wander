import { describe, expect, it } from 'vitest';
import { createHandShadow, CAPSULES_PER_HAND, CAPSULE_STRIDE } from '../../hands/hand-shadow';
import { MAX_CAPSULES, packShadowUniforms, CAPSULES_PER_SLOT, type ShadowUniformArrays } from './shadow-uniforms';

function arrays(): ShadowUniformArrays {
  return {
    caps: new Float32Array(MAX_CAPSULES * 4),
    radBlur: new Float32Array(MAX_CAPSULES * 2),
    bounds: new Float32Array(8),
    active: new Int32Array(2),
    opacity: new Float32Array(2),
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
    packShadowUniforms(s, null, 0.88, plain);
    packShadowUniforms(
      s,
      { left: { blurScale: 1, opacityBoost: 0 }, right: { blurScale: 0.3, opacityBoost: 0 } },
      0.88,
      sharp,
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
    );
    expect(out.bounds[4]).toBeCloseTo(-0.01 - 0.0025, 6);
    expect(out.bounds[6]).toBeCloseTo(0.3 + 0.0025, 6);
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
    );
    expect(out.opacity[0]).toBe(1);
    expect(out.opacity[1]).toBeCloseTo(0.93, 6);
  });

  it('inactive or off-stage hands are marked inactive, and no hand means nothing to draw', () => {
    const s = shadows();
    const out = arrays();
    expect(packShadowUniforms(s, null, 0.88, out)).toBe(true);
    expect([...out.active]).toEqual([0, 1]);
    s.right.onStage = false;
    expect(packShadowUniforms(s, null, 0.88, out)).toBe(false);
    expect([...out.active]).toEqual([0, 0]);
  });
});
