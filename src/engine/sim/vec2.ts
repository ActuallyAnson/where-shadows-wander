// Small 2D vector helpers for the stage simulation. They take plain numbers and write into a
// reused `Vec2` the caller owns, so nothing here allocates. Use Math.sqrt, never Math.hypot
// (hypot allocates). Plain TypeScript: no IWSDK, no three.js.

export interface Vec2 {
  x: number;
  y: number;
}

export function dot(ax: number, ay: number, bx: number, by: number): number {
  return ax * bx + ay * by;
}

/** z of the 3D cross product: positive when b is counter-clockwise from a. */
export function cross(ax: number, ay: number, bx: number, by: number): number {
  return ax * by - ay * bx;
}

export function lengthSq(x: number, y: number): number {
  return x * x + y * y;
}

export function length(x: number, y: number): number {
  return Math.sqrt(x * x + y * y);
}

export function distanceSq(ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  return dx * dx + dy * dy;
}

export function distance(ax: number, ay: number, bx: number, by: number): number {
  return Math.sqrt(distanceSq(ax, ay, bx, by));
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Writes the unit vector along (x, y) into `out`, or (0, 0) if the length is below `EPSILON`.
 * @returns the original length (0 for a degenerate vector).
 */
export function normalize(x: number, y: number, out: Vec2): number {
  const len = Math.sqrt(x * x + y * y);
  if (len < EPSILON) {
    out.x = 0;
    out.y = 0;
    return 0;
  }
  out.x = x / len;
  out.y = y / len;
  return len;
}

/** Vectors shorter than this (1 micrometre on the stage) count as zero. */
export const EPSILON = 1e-6;

/**
 * The point on segment A to B nearest to P, written to `out`.
 * @returns its position along the segment, 0 at A to 1 at B.
 */
export function closestPointOnSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  out: Vec2,
): number {
  const abx = bx - ax;
  const aby = by - ay;
  const len2 = abx * abx + aby * aby;
  const t = len2 < EPSILON * EPSILON ? 0 : clamp(((px - ax) * abx + (py - ay) * aby) / len2, 0, 1);
  out.x = ax + abx * t;
  out.y = ay + aby * t;
  return t;
}

/**
 * Circle against capsule (segment A to B swollen by `capsuleRadius`), the shape of the hand-shadow
 * capsules and a convenient solver primitive.
 * @returns the penetration depth (0 if they do not overlap). When they do, `normal` is the unit
 *   direction to move the circle to separate them, and moving it `depth` along it just touches.
 *   If the circle's centre lies exactly on the segment the normal is the segment's left-hand
 *   perpendicular (up for a zero-length segment), so the result is always defined and repeatable.
 */
export function circleVsCapsule(
  cx: number,
  cy: number,
  radius: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  capsuleRadius: number,
  normal: Vec2,
): number {
  closestPointOnSegment(cx, cy, ax, ay, bx, by, normal);
  const dx = cx - normal.x;
  const dy = cy - normal.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const depth = radius + capsuleRadius - dist;
  if (depth <= 0) return 0;
  if (dist < EPSILON) {
    const abx = bx - ax;
    const aby = by - ay;
    const len = Math.sqrt(abx * abx + aby * aby);
    if (len < EPSILON) {
      normal.x = 0;
      normal.y = 1;
    } else {
      normal.x = 0 - aby / len; // not -aby: that gives -0 for a horizontal segment
      normal.y = abx / len;
    }
  } else {
    normal.x = dx / dist;
    normal.y = dy / dist;
  }
  return depth;
}
