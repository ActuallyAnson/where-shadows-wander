// Packs both hands' shadows into the arrays the shadow shader reads: capsules,
// their radius and blur, and each hand's bounds. Pure, so the renderer's maths
// is testable in Node. A hand's `look` (shadow-sharpen.ts) scales only the blur;
// the capsules themselves (their ends and radius, which the collision solver
// uses) are copied untouched, so the 50 % edge never moves.
import type { Handedness } from '../../hands/hand';
import { CAPSULES_PER_HAND, CAPSULE_STRIDE, type HandShadow } from '../../hands/hand-shadow';
import type { ShadowLook } from './shadow-sharpen';

export const CAPSULES_PER_SLOT = 28;
export const MAX_CAPSULES = 2 * CAPSULES_PER_SLOT; // one slot per hand

export interface ShadowUniformArrays {
  caps: Float32Array; // MAX_CAPSULES x 4: ax, ay, bx, by
  radBlur: Float32Array; // MAX_CAPSULES x 2: radius, blur width
  bounds: Float32Array; // 2 x 4: minX, minY, maxX, maxY
  active: Int32Array; // 2
  /** Base opacity plus the hand's sharpen boost, per hand, capped at 1. */
  opacity: Float32Array; // 2
}

const HANDS: readonly Handedness[] = ['left', 'right'];
const MIN_PAD_M = 0.001;

/** Fills `out` from the shadows; returns whether any hand has a shadow on the stage. */
export function packShadowUniforms(
  shadows: Readonly<Record<Handedness, HandShadow>>,
  looks: Readonly<Record<Handedness, ShadowLook>> | null,
  baseOpacity: number,
  out: ShadowUniformArrays,
): boolean {
  let any = false;
  for (let h = 0; h < HANDS.length; h++) {
    const s = shadows[HANDS[h]];
    const look = looks ? looks[HANDS[h]] : null;
    out.active[h] = s.active && s.onStage ? 1 : 0;
    if (!out.active[h]) continue;
    any = true;
    const blurScale = look ? look.blurScale : 1;
    out.opacity[h] = Math.min(1, baseOpacity + (look ? look.opacityBoost : 0));
    let maxBlur = 0;
    for (let c = 0; c < CAPSULES_PER_HAND; c++) {
      const o = c * CAPSULE_STRIDE,
        i = h * CAPSULES_PER_SLOT + c;
      out.caps[i * 4] = s.capsules[o];
      out.caps[i * 4 + 1] = s.capsules[o + 1];
      out.caps[i * 4 + 2] = s.capsules[o + 2];
      out.caps[i * 4 + 3] = s.capsules[o + 3];
      out.radBlur[i * 2] = s.capsules[o + 4];
      const blur = s.blur[c] * blurScale;
      out.radBlur[i * 2 + 1] = blur;
      maxBlur = Math.max(maxBlur, blur);
    }
    // The capsules' bounds already include the radius; the soft edge reaches half a blur further.
    // At least a millimetre: the shader never draws an edge narrower than a pixel (about 0.4 mm at arm's length).
    const pad = Math.max(maxBlur / 2, MIN_PAD_M);
    out.bounds[h * 4] = s.bounds[0] - pad;
    out.bounds[h * 4 + 1] = s.bounds[1] - pad;
    out.bounds[h * 4 + 2] = s.bounds[2] + pad;
    out.bounds[h * 4 + 3] = s.bounds[3] + pad;
  }
  return any;
}
