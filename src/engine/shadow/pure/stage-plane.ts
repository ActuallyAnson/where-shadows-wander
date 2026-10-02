// The surface shadows land on, as the shadow projector needs it. Teammate A's
// StageFrame provides this shape (structurally; no import needed). Until it
// exists, test-rig.ts places one. Plain TypeScript.

type V3 = Readonly<ArrayLike<number>>;

export interface StagePlane {
  /** The stage's centre, scene space, metres. */
  readonly origin: V3;
  /** Unit vectors along the stage's width and height, in its plane. */
  readonly right: V3;
  readonly up: V3;
  /** Unit normal, pointing toward the player and the lantern. */
  readonly normal: V3;
  /** Size, metres. */
  readonly width: number;
  readonly height: number;
}

/** A StagePlane whose vectors can be updated in place. */
export interface MutableStagePlane extends StagePlane {
  readonly origin: Float64Array;
  readonly right: Float64Array;
  readonly up: Float64Array;
  readonly normal: Float64Array;
  width: number;
  height: number;
}

export function createStagePlane(): MutableStagePlane {
  return {
    origin: new Float64Array(3),
    right: new Float64Array([1, 0, 0]),
    up: new Float64Array([0, 1, 0]),
    normal: new Float64Array([0, 0, 1]),
    width: 0.4,
    height: 0.3,
  };
}

/** Signed distance of a point from the stage plane, along the normal. */
export function distanceToPlane(stage: StagePlane, x: number, y: number, z: number): number {
  const o = stage.origin,
    n = stage.normal;
  return (x - o[0]) * n[0] + (y - o[1]) * n[1] + (z - o[2]) * n[2];
}
