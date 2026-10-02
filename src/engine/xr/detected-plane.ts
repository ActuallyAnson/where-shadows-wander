// A real surface from WebXR plane detection, as StageFrame (Teammate A,
// src/engine/stage) will read it. Plain data with no imports, so it can move to
// src/engine/stage/detected-plane.ts once A agrees: StageFrame is pure and
// can't import src/engine/xr. Until then it lives here; nothing pure reads it yet.

export type PlaneOrientation = 'horizontal' | 'vertical' | 'unknown';

/** A detected plane in scene space (the same space as HandFrame), metres. */
export interface DetectedPlane {
  /** Stable for the plane's lifetime, never reused within a session. */
  id: number;
  orientation: PlaneOrientation;
  /** The browser's semantic label (e.g. "table", "wall"). A hint only: it differs between Pico and Quest (ADR 0003). */
  label: string | null;
  /**
   * Plane pose, column-major 4x4. Local +Y is the normal, already turned toward
   * the viewer; local X and Z span the polygon. Right-handed.
   */
  readonly matrix: Float32Array;
  /** The pose's translation. */
  readonly centre: Float32Array;
  /** Unit normal (the matrix's Y axis). */
  readonly normal: Float32Array;
  /**
   * Polygon in plane-local X/Z, packed x0, z0, x1, z1, ..., in the browser's
   * winding as seen from +Y (the side facing the viewer); only the first
   * `vertexCount` pairs are valid. The array is replaced when a larger polygon
   * arrives, so read it again after `planesVersion` changes.
   */
  polygon: Float32Array;
  vertexCount: number;
  /** Polygon bounds in plane-local X/Z: minX, maxX, minZ, maxZ. */
  readonly extent: Float32Array;
  /** Bumps when this plane's geometry or label changes. */
  version: number;
}

export function createDetectedPlane(): DetectedPlane {
  return {
    id: 0,
    orientation: 'unknown',
    label: null,
    matrix: new Float32Array(16),
    centre: new Float32Array(3),
    normal: new Float32Array(3),
    polygon: new Float32Array(16),
    vertexCount: 0,
    extent: new Float32Array(4),
    version: 0,
  };
}
