import { describe, expect, it } from 'vitest';
import {
  depthBlur,
  depthStrength,
  FAR_SHADOW_STRENGTH,
  partDepths,
  validateScene,
  type PuppetScene,
} from './puppet-scene';

const scene = (parts: PuppetScene['parts']): PuppetScene => ({ id: 't', length: 1, parts, tracks: [] });

describe('shadow depth', () => {
  it('is darkest and sharpest against the wall, palest and softest at the back', () => {
    expect(depthStrength(0)).toBe(1);
    expect(depthStrength(1)).toBeCloseTo(FAR_SHADOW_STRENGTH);
    expect(depthStrength(0.5)).toBeGreaterThan(depthStrength(0.8));
    expect(depthBlur(0)).toBe(0);
    expect(depthBlur(1)).toBeGreaterThan(depthBlur(0.3));
  });

  it('clamps depths outside 0..1', () => {
    expect(depthStrength(-1)).toBe(1);
    expect(depthStrength(3)).toBeCloseTo(FAR_SHADOW_STRENGTH);
  });

  it('passes a depth down to the parts hanging from it, unless they set their own', () => {
    const d = partDepths(
      scene([
        { id: 'root', art: '', w: 1, h: 1, depth: 0.6 },
        { id: 'child', art: 'a', parent: 'root', w: 1, h: 1 },
        { id: 'own', art: 'a', parent: 'root', w: 1, h: 1, depth: 0.1 },
        { id: 'grandchild', art: 'a', parent: 'own', w: 1, h: 1 },
        { id: 'loose', art: 'a', w: 1, h: 1 },
      ]),
    );
    expect(Array.from(d)).toEqual([0.6, 0.6, 0.1, 0.1, 0].map((v) => Math.fround(v)));
  });

  it('flags a depth outside 0..1', () => {
    expect(validateScene(scene([{ id: 'a', art: 'a', w: 1, h: 1, depth: 1.5 }]))).toEqual(["a's depth must be 0..1"]);
  });
});
