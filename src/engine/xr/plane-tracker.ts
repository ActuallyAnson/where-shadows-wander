// Keeps a fixed pool of DetectedPlane records in step with WebXR plane
// detection (frame.detectedPlanes), in scene space, with each normal turned
// toward the viewer. Raw WebXR rather than IWSDK's XRPlane entities, like
// xr-hands.ts, so it works the same under the plain three.js fallback (ADR 0002).
// Only WebXR types are imported, so it runs in Node tests with fake frames.
//
// Cost control: the emulator (IWER) sets every plane's lastChangedTime to the
// frame time on every frame, and a headset may too, so a changed time only
// triggers a re-read at most every MIN_REREAD_MS, and versions only bump when
// the content actually differs.
import { createDetectedPlane, type DetectedPlane, type PlaneOrientation } from './detected-plane';

export const MAX_PLANES = 32;
export const MIN_REREAD_MS = 250;
/** Matrix and polygon values closer than this count as unchanged. */
const EPS = 1e-5;

interface Slot {
  readonly plane: DetectedPlane;
  source: XRPlane | null;
  /** Update stamp when last seen in the plane set. */
  seen: number;
  lastChangedTime: number;
  readAt: number;
  /** Re-read the pose on the next update (new plane, pose not ready, origin or reference space changed). */
  needsPose: boolean;
}

export class PlaneTracker {
  /**
   * The tracked planes. The array is reused and changes (length and order) only
   * when the plane set changes. Records are reused for new planes with a new
   * `id`, so key on `id`, not on the object.
   */
  readonly active: DetectedPlane[] = [];
  /** Planes beyond the pool's size, not tracked. */
  overflow = 0;
  /** Bumps when the set of planes or any plane's geometry or label changes. */
  version = 0;

  private readonly slots: Slot[] = [];
  private readonly activeSlots: Slot[] = [];
  private readonly free: Slot[] = [];
  private readonly bySource = new Map<XRPlane, Slot>();
  // Float64 like three.js's Matrix4.elements, so an unchanged origin compares equal.
  private readonly origin = new Float64Array(16);
  private readonly scratch = new Float64Array(16);
  private readonly viewer = new Float64Array(3);
  private refSpace: XRReferenceSpace | null = null;
  private stamp = 0;
  private nextId = 1;
  // State for the current update, shared with the visitor so forEach needs no closure per frame.
  private frame: XRFrame | null = null;
  private now = 0;
  private changed = false;
  private seenCount = 0;
  private overflowCount = 0;
  /** 0 = viewer not looked up this update, 1 = known, -1 = unavailable. */
  private viewerState = 0;

  constructor(readonly max = MAX_PLANES) {
    for (let i = 0; i < max; i++) {
      const slot: Slot = {
        plane: createDetectedPlane(),
        source: null,
        seen: 0,
        lastChangedTime: NaN,
        readAt: -Infinity,
        needsPose: true,
      };
      this.slots.push(slot);
      this.free.push(slot);
    }
    this.origin[0] = this.origin[5] = this.origin[10] = this.origin[15] = 1;
  }

  /**
   * Call once per XR frame with frame.detectedPlanes.
   * @param origin matrixWorld of the XR origin (world.player), column-major: reference space to scene.
   * @returns true if `version` bumped.
   */
  update(
    planes: XRPlaneSet,
    frame: XRFrame,
    refSpace: XRReferenceSpace,
    origin: ArrayLike<number>,
    now: number,
  ): boolean {
    this.stamp++;
    this.frame = frame;
    this.now = now;
    this.changed = false;
    this.seenCount = 0;
    this.overflowCount = 0;
    this.viewerState = 0;

    let originMoved = false;
    for (let i = 0; i < 16; i++) {
      if (this.origin[i] !== origin[i]) {
        this.origin[i] = origin[i];
        originMoved = true;
      }
    }
    if (refSpace !== this.refSpace) {
      this.refSpace?.removeEventListener?.('reset', this.markAllForPose);
      this.refSpace = refSpace;
      refSpace.addEventListener?.('reset', this.markAllForPose);
      originMoved = true;
    }
    if (originMoved) this.markAllForPose();

    planes.forEach(this.visit);
    this.sweep();
    if (this.overflowCount !== this.overflow) {
      this.overflow = this.overflowCount;
      this.changed = true;
    }
    this.frame = null;
    if (this.changed) this.version++;
    return this.changed;
  }

  /** Forgets every plane, e.g. when the session ends (plane spaces belong to the old session). */
  clear(): void {
    const had = this.active.length > 0 || this.overflow > 0;
    for (const slot of this.activeSlots) this.release(slot);
    this.activeSlots.length = 0;
    this.active.length = 0;
    this.bySource.clear();
    this.overflow = 0;
    this.refSpace?.removeEventListener?.('reset', this.markAllForPose);
    this.refSpace = null;
    if (had) this.version++;
  }

  private readonly markAllForPose = (): void => {
    for (let i = 0; i < this.activeSlots.length; i++) this.activeSlots[i].needsPose = true;
  };

  private readonly visit = (plane: XRPlane): void => {
    let slot = this.bySource.get(plane);
    if (!slot) {
      const fresh = this.free.pop();
      if (!fresh) {
        this.overflowCount++;
        return;
      }
      slot = fresh;
      slot.source = plane;
      slot.lastChangedTime = NaN;
      slot.readAt = -Infinity;
      slot.needsPose = true;
      slot.plane.id = this.nextId++;
      slot.plane.vertexCount = 0;
      slot.plane.version = 0;
      this.bySource.set(plane, slot);
      this.activeSlots.push(slot);
      this.active.push(slot.plane);
      this.changed = true;
    }
    slot.seen = this.stamp;
    this.seenCount++;
    const timeChanged = plane.lastChangedTime !== slot.lastChangedTime;
    if (slot.needsPose || (timeChanged && this.now - slot.readAt >= MIN_REREAD_MS)) this.read(slot, plane);
  };

  private read(slot: Slot, plane: XRPlane): void {
    const frame = this.frame!;
    const pose = frame.getPose(plane.planeSpace, this.refSpace!);
    if (!pose) {
      slot.needsPose = true;
      return;
    }
    const m = this.scratch;
    mulMat4(this.origin, pose.transform.matrix, m);

    // Turn the normal (local +Y) toward the viewer: the sign of plane space +Y isn't guaranteed.
    const v = this.viewerPosition(frame);
    const flip = v !== null && m[4] * (v[0] - m[12]) + m[5] * (v[1] - m[13]) + m[6] * (v[2] - m[14]) < 0;
    if (flip) flipAboutX(m);

    const rec = slot.plane;
    const poly = plane.polygon;
    const n = poly.length;
    const orientation: PlaneOrientation = plane.orientation ?? 'unknown';
    const label = plane.semanticLabel ?? null;

    let differs = rec.vertexCount !== n || rec.orientation !== orientation || rec.label !== label;
    for (let i = 0; i < 16 && !differs; i++) differs = Math.abs(m[i] - rec.matrix[i]) > EPS;
    // Flipping mirrors local z, which would reverse the winding, so a flipped polygon is also
    // read backwards: it keeps the browser's winding as seen from the (new) +Y side.
    for (let i = 0; i < n && !differs; i++) {
      const v = poly[flip ? n - 1 - i : i];
      const z = flip ? -v.z : v.z;
      differs = Math.abs(v.x - rec.polygon[i * 2]) > EPS || Math.abs(z - rec.polygon[i * 2 + 1]) > EPS;
    }

    if (differs) {
      rec.matrix.set(m);
      rec.centre[0] = m[12];
      rec.centre[1] = m[13];
      rec.centre[2] = m[14];
      const len = Math.hypot(m[4], m[5], m[6]) || 1;
      rec.normal[0] = m[4] / len;
      rec.normal[1] = m[5] / len;
      rec.normal[2] = m[6] / len;
      if (rec.polygon.length < n * 2) rec.polygon = new Float32Array(n * 2);
      let minX = Infinity,
        maxX = -Infinity,
        minZ = Infinity,
        maxZ = -Infinity;
      for (let i = 0; i < n; i++) {
        const v = poly[flip ? n - 1 - i : i];
        const x = v.x;
        const z = flip ? -v.z : v.z;
        rec.polygon[i * 2] = x;
        rec.polygon[i * 2 + 1] = z;
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minZ = Math.min(minZ, z);
        maxZ = Math.max(maxZ, z);
      }
      rec.vertexCount = n;
      rec.extent[0] = n ? minX : 0;
      rec.extent[1] = n ? maxX : 0;
      rec.extent[2] = n ? minZ : 0;
      rec.extent[3] = n ? maxZ : 0;
      rec.orientation = orientation;
      rec.label = label;
      rec.version++;
      this.changed = true;
    }
    slot.lastChangedTime = plane.lastChangedTime;
    slot.readAt = this.now;
    slot.needsPose = false;
  }

  /** The viewer's position in scene space, looked up at most once per update. */
  private viewerPosition(frame: XRFrame): Float64Array | null {
    if (this.viewerState === 0) {
      const p = frame.getViewerPose(this.refSpace!)?.transform.position;
      this.viewerState = p ? 1 : -1;
      if (p) {
        const o = this.origin;
        this.viewer[0] = o[0] * p.x + o[4] * p.y + o[8] * p.z + o[12];
        this.viewer[1] = o[1] * p.x + o[5] * p.y + o[9] * p.z + o[13];
        this.viewer[2] = o[2] * p.x + o[6] * p.y + o[10] * p.z + o[14];
      }
    }
    return this.viewerState === 1 ? this.viewer : null;
  }

  /** Drops planes that weren't in this frame's set. */
  private sweep(): void {
    if (this.seenCount === this.activeSlots.length) return;
    for (let i = this.activeSlots.length - 1; i >= 0; i--) {
      const slot = this.activeSlots[i];
      if (slot.seen === this.stamp) continue;
      const last = this.activeSlots.length - 1;
      this.activeSlots[i] = this.activeSlots[last];
      this.active[i] = this.active[last];
      this.activeSlots.length = last;
      this.active.length = last;
      this.bySource.delete(slot.source!);
      this.release(slot);
      this.changed = true;
    }
  }

  private release(slot: Slot): void {
    slot.source = null;
    this.free.push(slot);
  }
}

/** out = a · b for column-major 4x4 matrices. `out` must not be `a` or `b`. */
export function mulMat4(a: ArrayLike<number>, b: ArrayLike<number>, out: Float32Array | Float64Array): void {
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      out[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
  }
}

/** Turns a pose 180° about its local X axis: local Y and Z flip, so the normal points the other way. */
export function flipAboutX(m: Float32Array | Float64Array): void {
  for (let i = 4; i < 7; i++) m[i] = -m[i];
  for (let i = 8; i < 11; i++) m[i] = -m[i];
}
