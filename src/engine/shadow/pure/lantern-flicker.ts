// The lantern's flicker: a smooth, slow, repeatable signal in [-1, 1], built from
// two sine waves and a little value noise. Everything stays under 4 Hz, which
// reads as a calm candle and is far below the rates that cause discomfort, and
// the largest change in one frame at 72 Hz is about 0.11, so it never strobes.
// Deterministic from (t, seed): the same time gives the same value.
// Plain TypeScript, no allocation.

const TAU = 2 * Math.PI;

/** A repeatable value in [-1, 1] for an integer cell. */
function hash(cell: number, seed: number): number {
  let n = (Math.imul(cell, 374761393) + Math.imul(seed | 0, 668265263)) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  n ^= n >>> 16;
  return ((n >>> 0) / 4294967295) * 2 - 1;
}

/** Smooth value noise in [-1, 1]: random values at whole numbers, joined with a cubic ease. */
function valueNoise(x: number, seed: number): number {
  const cell = Math.floor(x);
  const f = x - cell;
  const k = f * f * (3 - 2 * f);
  const a = hash(cell, seed);
  return a + (hash(cell + 1, seed) - a) * k;
}

/** The flicker at `t` seconds, in [-1, 1]. Different seeds give lanterns that don't flicker in step. */
export function flicker(t: number, seed = 0): number {
  const phase = hash(0, seed) * Math.PI;
  return (
    0.45 * Math.sin(TAU * 0.7 * t + phase) +
    0.25 * Math.sin(TAU * 1.9 * t + 1.3 + phase) +
    0.3 * valueNoise(3.1 * t, seed)
  );
}
