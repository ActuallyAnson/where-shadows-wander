// The wall's plaster as a normal map: broad, soft lumps from the trowel and a fine grain on top, so the candle's light catches the
// wall unevenly and the shadows read as falling on a real wall, not a screen. It is a tileable height field (value noise in a few
// octaves, wrapped at the edges) turned into normals. Seeded, so it is the same every run. Pure: no three, no canvas.

/** The octaves of the height field: lattice cells across the tile, and how much each counts (the broad lumps most). */
const OCTAVES: readonly { readonly cells: number; readonly weight: number }[] = [
  { cells: 4, weight: 1 },
  { cells: 8, weight: 0.55 },
  { cells: 16, weight: 0.3 },
  { cells: 64, weight: 0.22 },
];

/** A height field `size` by `size` in 0..1 that tiles: its right edge runs on into its left, its top into its bottom. */
export function plasterHeight(size: number, seed = 1): Float32Array {
  const h = new Float32Array(size * size);
  let s = seed >>> 0 || 1;
  const random = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
  let total = 0;
  for (const { cells, weight } of OCTAVES) {
    const lattice = new Float32Array(cells * cells);
    for (let i = 0; i < lattice.length; i++) lattice[i] = random();
    total += weight;
    for (let y = 0; y < size; y++) {
      const fy = (y / size) * cells;
      const y0 = Math.floor(fy);
      const ty = smooth(fy - y0);
      const r0 = (y0 % cells) * cells;
      const r1 = ((y0 + 1) % cells) * cells;
      for (let x = 0; x < size; x++) {
        const fx = (x / size) * cells;
        const x0 = Math.floor(fx);
        const tx = smooth(fx - x0);
        const c0 = x0 % cells;
        const c1 = (x0 + 1) % cells;
        const top = lattice[r0 + c0] + (lattice[r0 + c1] - lattice[r0 + c0]) * tx;
        const bottom = lattice[r1 + c0] + (lattice[r1 + c1] - lattice[r1 + c0]) * tx;
        h[y * size + x] += (top + (bottom - top) * ty) * weight;
      }
    }
  }
  for (let i = 0; i < h.length; i++) h[i] /= total;
  return h;
}

/**
 * The plaster's normals, `size` by `size`, as RGBA bytes (x, y, z mapped from -1..1 to 0..255; row 0 is the texture's bottom, so
 * +x is along the wall and +y up it). `relief` is how steep the lumps are, whatever the size: about 1 to 4 is plaster, more is
 * stucco. How much of it the light shows is set where it is drawn (CandleLight's bump strength).
 */
export function plasterNormals(size: number, seed = 1, relief = 2): Uint8Array {
  const h = plasterHeight(size, seed);
  const out = new Uint8Array(size * size * 4);
  const k = (relief * size) / 64;
  for (let y = 0; y < size; y++) {
    const up = ((y + 1) % size) * size;
    const down = ((y + size - 1) % size) * size;
    for (let x = 0; x < size; x++) {
      const right = (x + 1) % size;
      const left = (x + size - 1) % size;
      const row = y * size;
      const nx = -(h[row + right] - h[row + left]) * k;
      const ny = -(h[up + x] - h[down + x]) * k;
      const len = Math.sqrt(nx * nx + ny * ny + 1);
      const o = (row + x) * 4;
      out[o] = Math.round(((nx / len) * 0.5 + 0.5) * 255);
      out[o + 1] = Math.round(((ny / len) * 0.5 + 0.5) * 255);
      out[o + 2] = Math.round(((1 / len) * 0.5 + 0.5) * 255);
      out[o + 3] = 255;
    }
  }
  return out;
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}
