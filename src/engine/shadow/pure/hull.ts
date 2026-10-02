// Convex hull (Andrew's monotone chain) of a few 2D points, without
// allocating: the caller passes the scratch. Plain TypeScript.

/**
 * Writes the convex hull of the first `n` points of `xy` (x, y pairs) into
 * `out` as x, y pairs, counter-clockwise, and returns how many points it has.
 * `order` is scratch for `n` indices; `out` must hold 2·(n + 1) numbers (the chain
 * briefly holds one point more than the hull).
 */
export function convexHull(xy: ArrayLike<number>, n: number, out: Float32Array, order: Uint8Array): number {
  for (let i = 0; i < n; i++) order[i] = i;
  // Insertion sort by x then y: n is at most 25.
  for (let i = 1; i < n; i++) {
    const v = order[i];
    let j = i - 1;
    while (
      j >= 0 &&
      (xy[order[j] * 2] > xy[v * 2] || (xy[order[j] * 2] === xy[v * 2] && xy[order[j] * 2 + 1] > xy[v * 2 + 1]))
    ) {
      order[j + 1] = order[j];
      j--;
    }
    order[j + 1] = v;
  }
  if (n < 3) {
    for (let i = 0; i < n; i++) {
      out[i * 2] = xy[order[i] * 2];
      out[i * 2 + 1] = xy[order[i] * 2 + 1];
    }
    return n;
  }
  let k = 0;
  // Lower hull, then upper hull; drop points that don't turn left (collinear and duplicates too).
  for (let i = 0; i < n; i++) {
    while (k >= 2 && turn(out, k - 2, k - 1, xy, order[i]) <= 0) k--;
    k = push(out, k, xy, order[i]);
  }
  const lower = k + 1;
  for (let i = n - 2; i >= 0; i--) {
    while (k >= lower && turn(out, k - 2, k - 1, xy, order[i]) <= 0) k--;
    k = push(out, k, xy, order[i]);
  }
  return k - 1; // the last point repeats the first
}

/** Cross product of (out[b] - out[a]) and (xy[c] - out[a]): > 0 is a left turn. */
function turn(out: Float32Array, a: number, b: number, xy: ArrayLike<number>, c: number): number {
  return (
    (out[b * 2] - out[a * 2]) * (xy[c * 2 + 1] - out[a * 2 + 1]) -
    (out[b * 2 + 1] - out[a * 2 + 1]) * (xy[c * 2] - out[a * 2])
  );
}

function push(out: Float32Array, k: number, xy: ArrayLike<number>, p: number): number {
  out[k * 2] = xy[p * 2];
  out[k * 2 + 1] = xy[p * 2 + 1];
  return k + 1;
}
