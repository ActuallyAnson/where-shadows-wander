// 2D stage frame on a detected plane (GDD "Plane-space game").
import { Matrix4, Quaternion, Vector3 } from '@iwsdk/core';

export interface PlaneInfo {
  orientation: string | undefined;
  semanticLabel: string | undefined;
  position: [number, number, number];
  normal: [number, number, number];
  extentX: number;
  extentZ: number;
  vertices: number;
}

export class PlaneFrame {
  readonly origin = new Vector3(0, 1.3, -1.2);
  readonly normal = new Vector3(0, 0, 1); // faces the player
  readonly right = new Vector3(1, 0, 0);
  readonly up = new Vector3(0, 1, 0);
  source = 'fallback-virtual-wall';

  /** Plane as (n, d) with n·x + d = 0. */
  get d(): number {
    return -this.normal.dot(this.origin);
  }

  setFrom(origin: Vector3, normal: Vector3, viewer: Vector3, source: string): void {
    this.origin.copy(origin);
    this.normal.copy(normal).normalize();
    if (this.normal.dot(viewer.clone().sub(origin)) < 0) this.normal.negate();
    // up = world up projected on plane (vertical wall); for a table use away-from-viewer.
    const worldUp = new Vector3(0, 1, 0);
    if (Math.abs(this.normal.dot(worldUp)) > 0.9) {
      this.up.copy(origin).sub(viewer).projectOnPlane(this.normal).normalize();
    } else {
      this.up.copy(worldUp).projectOnPlane(this.normal).normalize();
    }
    this.right.crossVectors(this.up, this.normal).normalize();
    this.source = source;
  }

  toWorld(x: number, y: number, out: Vector3, lift = 0): Vector3 {
    return out
      .copy(this.origin)
      .addScaledVector(this.right, x)
      .addScaledVector(this.up, y)
      .addScaledVector(this.normal, lift);
  }

  toPlane(p: Vector3): [number, number] {
    const v = p.clone().sub(this.origin);
    return [v.dot(this.right), v.dot(this.up)];
  }

  basis(out: Matrix4): Matrix4 {
    return out.makeBasis(this.right, this.up, this.normal).setPosition(this.origin);
  }
}

const m = new Matrix4();
const pos = new Vector3();
const quat = new Quaternion();
const scl = new Vector3();

export function describePlane(plane: XRPlane, pose: XRPose | undefined, origin: Matrix4): PlaneInfo {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const p of plane.polygon) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
  }
  const normal = new Vector3(0, 1, 0);
  if (pose) {
    m.fromArray(pose.transform.matrix).premultiply(origin).decompose(pos, quat, scl);
    normal.applyQuaternion(quat); // WebXR plane space: +Y is the plane normal
  } else {
    pos.set(NaN, NaN, NaN);
  }
  const r = (n: number) => Math.round(n * 1000) / 1000;
  return {
    orientation: plane.orientation,
    semanticLabel: (plane as XRPlane & { semanticLabel?: string }).semanticLabel,
    position: [r(pos.x), r(pos.y), r(pos.z)],
    normal: [r(normal.x), r(normal.y), r(normal.z)],
    extentX: r(maxX - minX),
    extentZ: r(maxZ - minZ),
    vertices: plane.polygon.length,
  };
}
