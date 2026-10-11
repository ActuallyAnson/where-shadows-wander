// Scripted hand shadows: fills a HandShadow's capsules with a simple stand-in for each shape, in
// stage space, so the solver and gameplay can be driven without a tracked hand (tests, the headless
// runner, replays of a design). The real shadows come from the projector; these only need to be
// the right size and outline (a flat hand is a plank, a cup is a U, a spread hand is a fan).
// Plain TypeScript. Writes in place; builds nothing.

import { CAPSULE_STRIDE, CAPSULES_PER_HAND, type HandShadow } from '../hands/hand-shadow';
import type { Shape } from '../hands/shapes';

/** A hand's shadow is roughly this long on the stage (palm plus fingers, magnified), metres. */
export const HAND_SHADOW_LENGTH_M = 0.3;

function set(sh: HandShadow, i: number, ax: number, ay: number, bx: number, by: number, r: number): void {
  const o = i * CAPSULE_STRIDE;
  sh.capsules[o] = ax;
  sh.capsules[o + 1] = ay;
  sh.capsules[o + 2] = bx;
  sh.capsules[o + 3] = by;
  sh.capsules[o + 4] = r;
}

/** Capsules first..first+n-1 laid end to end along A→B. */
function line(
  sh: HandShadow,
  first: number,
  n: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  r: number,
): void {
  for (let i = 0; i < n; i++) {
    const t0 = i / n,
      t1 = (i + 1) / n;
    set(sh, first + i, ax + (bx - ax) * t0, ay + (by - ay) * t0, ax + (bx - ax) * t1, ay + (by - ay) * t1, r);
  }
}

/** Recomputes `bounds` from the capsules and marks the shadow active and on the stage. */
export function finishShadow(sh: HandShadow): void {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (let i = 0; i < CAPSULES_PER_HAND; i++) {
    const o = i * CAPSULE_STRIDE;
    const r = sh.capsules[o + 4];
    for (let e = 0; e < 4; e += 2) {
      const x = sh.capsules[o + e],
        y = sh.capsules[o + e + 1];
      if (x - r < minX) minX = x - r;
      if (y - r < minY) minY = y - r;
      if (x + r > maxX) maxX = x + r;
      if (y + r > maxY) maxY = y + r;
    }
  }
  sh.bounds[0] = minX;
  sh.bounds[1] = minY;
  sh.bounds[2] = maxX;
  sh.bounds[3] = maxY;
  sh.active = true;
  sh.onStage = true;
}

/** A level plank centred on (cx, cy): the bridge. */
export function flatShadow(sh: HandShadow, cx: number, cy: number, length = HAND_SHADOW_LENGTH_M, r = 0.02): void {
  const h = length / 2 - r;
  line(sh, 0, CAPSULES_PER_HAND, cx - h, cy, cx + h, cy, r);
  finishShadow(sh);
}

/** A round blob of about `size` radius: the rock (and the stand-in for the animal shapes). */
export function fistShadow(sh: HandShadow, cx: number, cy: number, size = 0.07): void {
  const ring = CAPSULES_PER_HAND / 2;
  const rr = size * 0.55,
    cr = size * 0.45;
  for (let i = 0; i < ring; i++) {
    const a0 = (i / ring) * Math.PI * 2,
      a1 = ((i + 1) / ring) * Math.PI * 2;
    set(sh, i, cx + Math.cos(a0) * rr, cy + Math.sin(a0) * rr, cx + Math.cos(a1) * rr, cy + Math.sin(a1) * rr, cr);
  }
  for (let i = ring; i < CAPSULES_PER_HAND; i++) set(sh, i, cx, cy, cx, cy, size * 0.6);
  finishShadow(sh);
}

/** A U open upward, `width` wide and `height` tall, centred on (cx, cy): the cup. */
export function cupShadow(sh: HandShadow, cx: number, cy: number, width = 0.22, height = 0.12, r = 0.015): void {
  const l = cx - width / 2 + r,
    rt = cx + width / 2 - r,
    b = cy - height / 2 + r,
    t = cy + height / 2 - r;
  line(sh, 0, 10, l, b, rt, b, r);
  line(sh, 10, 9, l, b, l, t, r);
  line(sh, 19, 9, rt, b, rt, t, r);
  finishShadow(sh);
}

/** A palm with five fingers fanned upward, `height` tall, centred on (cx, cy): the spread wall. */
export function spreadShadow(sh: HandShadow, cx: number, cy: number, height = HAND_SHADOW_LENGTH_M, r = 0.02): void {
  const palmY = cy - height / 2 + 0.06;
  // Palm: 8 capsules filling a block at the bottom.
  for (let i = 0; i < 8; i++) {
    const y = cy - height / 2 + r + (i % 4) * 0.02;
    const x0 = cx - 0.05 + (i < 4 ? 0 : 0.05);
    set(sh, i, x0, y, x0 + 0.05, y, r);
  }
  // Fingers: 5 × 4 capsules, fanned ±25°.
  const len = height - 0.08;
  for (let f = 0; f < 5; f++) {
    const a = ((f - 2) / 2) * 0.44;
    const tx = cx + Math.sin(a) * len,
      ty = palmY + Math.cos(a) * len;
    line(sh, 8 + f * 4, 4, cx + (f - 2) * 0.015, palmY, tx, ty, r);
  }
  finishShadow(sh);
}

/** The scripted outline for a shape (rabbit and fox use the fist's blob). */
export function shapeShadow(sh: HandShadow, shape: Shape, cx: number, cy: number): void {
  switch (shape) {
    case 'flat':
      return flatShadow(sh, cx, cy);
    case 'cup':
      return cupShadow(sh, cx, cy);
    case 'spread':
      return spreadShadow(sh, cx, cy);
    default:
      return fistShadow(sh, cx, cy);
  }
}

/** Takes the hand away (tracking lost or the hand left the light). */
export function hideShadow(sh: HandShadow): void {
  sh.active = false;
  sh.onStage = false;
}
