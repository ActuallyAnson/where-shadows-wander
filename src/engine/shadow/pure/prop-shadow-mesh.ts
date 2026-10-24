// Geometry for drawing a prop's shadow: the silhouette from projectProp as a filled polygon with a soft rim.
// The fill is a triangle fan; the rim is a second ring of vertices pushed outward by `blur`, with alpha fading from 1 on
// the polygon's edge to 0 on the outer ring, so the edge softens the way the hands' shadows do. Everything is written
// into fixed arrays that a three.js BufferGeometry wraps, so nothing here needs three. Plain TypeScript.
import { MAX_SILHOUETTE_VERTS, type Silhouette } from './prop-shadow';

/** How many prop shadows one mesh holds. */
export const MAX_PROP_SHADOWS = 16;
/** Vertices per shadow: the polygon's ring and the outer ring. */
export const VERTS_PER_SHADOW = MAX_SILHOUETTE_VERTS * 2;
/** Indices per shadow, at most: the fan (n - 2 triangles) plus the rim (two triangles per edge). */
export const INDICES_PER_SHADOW = (MAX_SILHOUETTE_VERTS - 2) * 3 + MAX_SILHOUETTE_VERTS * 6;

export interface PropShadowMesh {
  /** x, y, z per vertex, in stage metres (z is 0: the shadow lies on the stage). */
  readonly positions: Float32Array;
  /** r, g, b, a per vertex: black, with alpha 1 on the polygon and 0 on the outer ring. */
  readonly colors: Float32Array;
  readonly indices: Uint16Array;
  vertexCount: number;
  indexCount: number;
  /** How many shadows have been added. */
  shadows: number;
}

export function createPropShadowMesh(): PropShadowMesh {
  return {
    positions: new Float32Array(MAX_PROP_SHADOWS * VERTS_PER_SHADOW * 3),
    colors: new Float32Array(MAX_PROP_SHADOWS * VERTS_PER_SHADOW * 4),
    indices: new Uint16Array(MAX_PROP_SHADOWS * INDICES_PER_SHADOW),
    vertexCount: 0,
    indexCount: 0,
    shadows: 0,
  };
}

export function resetPropShadowMesh(mesh: PropShadowMesh): void {
  mesh.vertexCount = 0;
  mesh.indexCount = 0;
  mesh.shadows = 0;
}

/** The rim never pushes a corner out further than this many times `blur`, however sharp the corner. */
const MAX_MITER = 2;

/**
 * Adds one shadow (a convex counter-clockwise silhouette) with a rim of width `blur` metres. Returns false and adds
 * nothing for a silhouette under three points, or when the mesh is full.
 */
export function appendFeathered(mesh: PropShadowMesh, sil: Silhouette, blur: number): boolean {
  const n = sil.count;
  if (n < 3 || n > MAX_SILHOUETTE_VERTS || mesh.shadows >= MAX_PROP_SHADOWS) return false;
  const p = sil.points;
  const base = mesh.vertexCount;
  const pos = mesh.positions,
    col = mesh.colors,
    idx = mesh.indices;

  for (let i = 0; i < n; i++) {
    const a = i === 0 ? n - 1 : i - 1,
      c = i + 1 === n ? 0 : i + 1;
    const x = p[i * 2],
      y = p[i * 2 + 1];

    // Outward normals of the edges before and after this vertex (the polygon is counter-clockwise, so
    // outward is to the right of the edge's direction).
    let d1x = x - p[a * 2],
      d1y = y - p[a * 2 + 1];
    let d2x = p[c * 2] - x,
      d2y = p[c * 2 + 1] - y;
    const l1 = Math.sqrt(d1x * d1x + d1y * d1y),
      l2 = Math.sqrt(d2x * d2x + d2y * d2y);
    d1x = l1 > 1e-9 ? d1x / l1 : 0;
    d1y = l1 > 1e-9 ? d1y / l1 : 0;
    d2x = l2 > 1e-9 ? d2x / l2 : 0;
    d2y = l2 > 1e-9 ? d2y / l2 : 0;
    const n1x = d1y,
      n1y = -d1x,
      n2x = d2y,
      n2y = -d2x;
    // The miter: along the corner's bisector, long enough that the rim is `blur` from both edges.
    let ox = n1x + n2x,
      oy = n1y + n2y;
    const k = blur / Math.max(1 + n1x * n2x + n1y * n2y, 1e-3);
    ox *= k;
    oy *= k;
    const len = Math.sqrt(ox * ox + oy * oy);
    if (len > blur * MAX_MITER) {
      const s = (blur * MAX_MITER) / len;
      ox *= s;
      oy *= s;
    }

    const inner = (base + i) * 3,
      outer = (base + n + i) * 3;
    pos[inner] = x;
    pos[inner + 1] = y;
    pos[inner + 2] = 0;
    pos[outer] = x + ox;
    pos[outer + 1] = y + oy;
    pos[outer + 2] = 0;
    const ci = (base + i) * 4,
      co = (base + n + i) * 4;
    col[ci] = col[ci + 1] = col[ci + 2] = 0;
    col[ci + 3] = 1;
    col[co] = col[co + 1] = col[co + 2] = 0;
    col[co + 3] = 0;
  }

  let t = mesh.indexCount;
  for (let i = 1; i < n - 1; i++) {
    idx[t++] = base;
    idx[t++] = base + i;
    idx[t++] = base + i + 1;
  }
  for (let i = 0; i < n; i++) {
    const j = i + 1 === n ? 0 : i + 1;
    idx[t++] = base + i;
    idx[t++] = base + j;
    idx[t++] = base + n + j;
    idx[t++] = base + i;
    idx[t++] = base + n + j;
    idx[t++] = base + n + i;
  }
  mesh.vertexCount = base + n * 2;
  mesh.indexCount = t;
  mesh.shadows++;
  return true;
}
