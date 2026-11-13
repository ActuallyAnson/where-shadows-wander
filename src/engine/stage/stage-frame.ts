// The stage frame: the 2D coordinate system the game lives in, laid on the paper wall of the
// virtual room (ADR 0005). Plain TypeScript: no IWSDK, no three.js.
//
// Scene space is IWSDK's 3D metres. Stage space is 2D metres on the wall: the origin is the wall's
// centre, +x runs along `right` and +y along `up` (so +y is up the wall, gravity is -y). The
// normal points out of the wall toward the player and the lantern.
//
// StageFrame has the same fields as `StagePlane` in src/engine/shadow/pure/stage-plane.ts, so it can
// be passed straight to the shadow projector. That type isn't imported here (pure code may not
// import shadow/); the match is structural, and main.ts's typecheck is what enforces it.
//
// In v1 the wall is a constant placed once when the room is built. A real wall or table, in a
// possible later mode, would only call setWall() with a different plane.

type V3 = Readonly<ArrayLike<number>>;

/** How far the paper wall is in front of the player's eyes, metres (GDD; tune in the headset). */
export const WALL_DISTANCE_M = 2.0;
/** Width of the paper wall, metres (GDD: about 1.6 m). */
export const WALL_WIDTH_M = 1.6;
/** Height of the paper wall, metres. */
export const WALL_HEIGHT_M = 1.0;
/** How far the wall's centre sits below the player's eyes, metres, so the stage is in a relaxed gaze. */
export const WALL_CENTRE_BELOW_EYES_M = 0.2;
/**
 * How far the room's wall is behind the stage, metres. The stage is a patch of the bedroom's own wall (the shadows
 * fall on the wallpaper), so the wall sits just behind it: far enough not to fight it in depth, too near to see a gap.
 */
export const ROOM_WALL_BEHIND_STAGE_M = 0.02;
/**
 * How much bigger the story is drawn than the stage: the memories, the friend's hand and the story's words are written for the
 * 1.6 by 1 m stage and drawn 2.375 times that (3.8 by 2.375 m), 95% of the room's 4 by 2.5 m wall each way. The hands' shadows keep the stage.
 */
export const STORY_SCALE = 2.375;

export class StageFrame {
  /** The wall's centre, scene space, metres. */
  readonly origin = new Float64Array(3);
  /** Unit vector along the wall's width (stage +x), scene space. */
  readonly right = new Float64Array([1, 0, 0]);
  /** Unit vector up the wall (stage +y), scene space. */
  readonly up = new Float64Array([0, 1, 0]);
  /** Unit normal out of the wall, toward the player and the lantern. */
  readonly normal = new Float64Array([0, 0, 1]);
  /** Size, metres. */
  width = WALL_WIDTH_M;
  height = WALL_HEIGHT_M;
  /** Bumped on every change, so a consumer can tell when to re-read. */
  version = 0;

  /**
   * Sets the wall from its centre, its normal (toward the player) and a hint for "up". The basis is
   * made orthonormal: `up` is the hint with its normal component removed, `right = up × normal`.
   * Throws if the normal is zero or the up hint is parallel to it.
   */
  setWall(centre: V3, normal: V3, upHint: V3, width: number, height: number): void {
    if (!(width > 0 && height > 0)) throw new RangeError(`wall size must be positive, got ${width} × ${height}`);
    let nx = normal[0],
      ny = normal[1],
      nz = normal[2];
    const nl = Math.hypot(nx, ny, nz);
    if (!(nl > 1e-9)) throw new RangeError('wall normal must not be zero');
    nx /= nl;
    ny /= nl;
    nz /= nl;
    const d = upHint[0] * nx + upHint[1] * ny + upHint[2] * nz;
    let ux = upHint[0] - d * nx,
      uy = upHint[1] - d * ny,
      uz = upHint[2] - d * nz;
    const ul = Math.hypot(ux, uy, uz);
    if (!(ul > 1e-9)) throw new RangeError('wall up hint must not be parallel to its normal');
    ux /= ul;
    uy /= ul;
    uz /= ul;
    this.origin[0] = centre[0];
    this.origin[1] = centre[1];
    this.origin[2] = centre[2];
    this.normal[0] = nx;
    this.normal[1] = ny;
    this.normal[2] = nz;
    this.up[0] = ux;
    this.up[1] = uy;
    this.up[2] = uz;
    // right = up × normal: with up = +Y and normal = +Z, right = +X.
    this.right[0] = uy * nz - uz * ny;
    this.right[1] = uz * nx - ux * nz;
    this.right[2] = ux * ny - uy * nx;
    this.width = width;
    this.height = height;
    this.version++;
  }

  /**
   * Places the virtual room's paper wall in front of a player whose eyes are at `head`, facing
   * `yawRad` (0 = looking down -Z, as IWSDK's default camera): upright, WALL_DISTANCE_M ahead,
   * WALL_CENTRE_BELOW_EYES_M below the eyes, facing the player.
   */
  placeInFront(
    head: V3,
    yawRad: number,
    distance = WALL_DISTANCE_M,
    width = WALL_WIDTH_M,
    height = WALL_HEIGHT_M,
  ): void {
    const fx = -Math.sin(yawRad),
      fz = -Math.cos(yawRad);
    const c = SCRATCH_CENTRE,
      n = SCRATCH_NORMAL;
    c[0] = head[0] + fx * distance;
    c[1] = head[1] - WALL_CENTRE_BELOW_EYES_M;
    c[2] = head[2] + fz * distance;
    n[0] = -fx;
    n[1] = 0;
    n[2] = -fz;
    this.setWall(c, n, WORLD_UP, width, height);
  }

  /**
   * Makes this frame the story's area on the same wall as `stage`: `scale` times its size, its centre moved `lift` metres up the
   * wall (to the wall's middle, which is higher than the stage's).
   */
  setStoryArea(stage: StageFrame, scale: number, lift: number): void {
    const o = stage.origin,
      u = stage.up,
      c = SCRATCH_CENTRE;
    c[0] = o[0] + u[0] * lift;
    c[1] = o[1] + u[1] * lift;
    c[2] = o[2] + u[2] * lift;
    this.setWall(c, stage.normal, u, stage.width * scale, stage.height * scale);
  }

  /**
   * Scene point → stage coordinates (the point projected straight onto the wall).
   * Writes stage x, y into `out[0..1]` and returns the signed distance in front of the wall, metres.
   */
  toStage(x: number, y: number, z: number, out: Float64Array | number[]): number {
    const dx = x - this.origin[0],
      dy = y - this.origin[1],
      dz = z - this.origin[2];
    const r = this.right,
      u = this.up,
      n = this.normal;
    out[0] = dx * r[0] + dy * r[1] + dz * r[2];
    out[1] = dx * u[0] + dy * u[1] + dz * u[2];
    return dx * n[0] + dy * n[1] + dz * n[2];
  }

  /**
   * Stage coordinates → scene point, `offset` metres in front of the wall (0 = on the paper).
   * Writes x, y, z into `out[0..2]`.
   */
  toScene(sx: number, sy: number, out: Float64Array | number[], offset = 0): void {
    const o = this.origin,
      r = this.right,
      u = this.up,
      n = this.normal;
    out[0] = o[0] + sx * r[0] + sy * u[0] + offset * n[0];
    out[1] = o[1] + sx * r[1] + sy * u[1] + offset * n[1];
    out[2] = o[2] + sx * r[2] + sy * u[2] + offset * n[2];
  }

  /** Whether a stage point lies on the wall, shrunk by `margin` metres on every side (negative grows it). */
  contains(sx: number, sy: number, margin = 0): boolean {
    return Math.abs(sx) <= this.width / 2 - margin && Math.abs(sy) <= this.height / 2 - margin;
  }
}

const WORLD_UP: V3 = [0, 1, 0];
// Module scratch for placeInFront (single-threaded; never escapes the call).
const SCRATCH_CENTRE = new Float64Array(3);
const SCRATCH_NORMAL = new Float64Array(3);
