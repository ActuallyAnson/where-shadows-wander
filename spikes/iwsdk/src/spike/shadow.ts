// Planar hand shadow: hand proxy (instanced spheres + bone cylinders) flattened
// onto the stage plane by a projection matrix, drawn solid black.
//
// The light is a homogeneous point Lh = ((1-k)·L + k·n, 1-k). k = 0 is a
// perspective projection from the lantern L; k = 1 is the point at infinity
// along the plane normal, i.e. an orthographic projection. In between, the
// light dollies back towards infinity, so it is still one 4x4 matrix:
//   M = (π·Lh)·I − Lh ⊗ π,   π = (n, d)
import {
  Color,
  CylinderGeometry,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  Quaternion,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
  Vector4,
} from '@iwsdk/core';
import { HandReader, JOINT_COUNT, JOINT_PARENT } from './hands.js';
import { PlaneFrame } from './plane-frame.js';

const HANDS = ['left', 'right'] as const;
const BONES_PER_HAND = JOINT_COUNT - 1;

export function shadowMatrix(plane: PlaneFrame, light: Vector3, k: number, out: Matrix4): Matrix4 {
  const n = plane.normal;
  const pi = new Vector4(n.x, n.y, n.z, plane.d);
  const w = 1 - k;
  const lh = new Vector4(
    w * light.x + k * n.x,
    w * light.y + k * n.y,
    w * light.z + k * n.z,
    w,
  );
  const dot = pi.dot(lh);
  const L = [lh.x, lh.y, lh.z, lh.w];
  const P = [pi.x, pi.y, pi.z, pi.w];
  const e: number[] = [];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) e.push((r === c ? dot : 0) - L[r] * P[c]);
  return out.set(...(e as Parameters<Matrix4['set']>));
}

const shadowVertex = /* glsl */ `
  uniform mat4 uShadow;
  uniform vec3 uNormal;
  uniform float uLift;
  void main() {
    vec4 world = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vec4 s = uShadow * world;
    vec3 p = s.xyz / s.w + uNormal * uLift;
    gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
  }
`;
const shadowFragment = /* glsl */ `
  uniform vec3 uColor;
  void main() { gl_FragColor = vec4(uColor, 1.0); }
`;

export class HandShadow {
  readonly joints: InstancedMesh;
  readonly bones: InstancedMesh;
  readonly jointShadow: InstancedMesh;
  readonly boneShadow: InstancedMesh;
  readonly material: ShaderMaterial;
  readonly matrix = new Matrix4();
  k = 0.6;

  private readonly m = new Matrix4();
  private readonly a = new Vector3();
  private readonly b = new Vector3();
  private readonly q = new Quaternion();
  private readonly s = new Vector3();
  private readonly yAxis = new Vector3(0, 1, 0);

  constructor(showProxy: boolean) {
    const sphere = new SphereGeometry(1, 10, 8);
    const cyl = new CylinderGeometry(1, 1, 1, 8, 1, true);
    const proxyMat = new MeshBasicMaterial({ color: new Color(0x8899aa), wireframe: true });
    this.material = new ShaderMaterial({
      uniforms: {
        uShadow: { value: this.matrix },
        uNormal: { value: new Vector3() },
        uLift: { value: 0.002 },
        uColor: { value: new Color(0x000000) },
      },
      vertexShader: shadowVertex,
      fragmentShader: shadowFragment,
    });
    const nJ = JOINT_COUNT * 2;
    const nB = BONES_PER_HAND * 2;
    this.joints = new InstancedMesh(sphere, proxyMat, nJ);
    this.bones = new InstancedMesh(cyl, proxyMat, nB);
    this.jointShadow = new InstancedMesh(sphere, this.material, nJ);
    this.boneShadow = new InstancedMesh(cyl, this.material, nB);
    for (const mesh of [this.joints, this.bones, this.jointShadow, this.boneShadow]) {
      mesh.frustumCulled = false;
      mesh.count = 0;
    }
    this.joints.visible = this.bones.visible = showProxy;
    this.jointShadow.renderOrder = this.boneShadow.renderOrder = 2;
  }

  update(hands: HandReader, plane: PlaneFrame, light: Vector3): void {
    shadowMatrix(plane, light, this.k, this.matrix);
    (this.material.uniforms.uNormal.value as Vector3).copy(plane.normal);

    let j = 0;
    let b = 0;
    for (const h of HANDS) {
      const state = hands.hands[h];
      if (!state.tracked) continue;
      const w = state.world;
      for (let i = 0; i < JOINT_COUNT; i++) {
        const r = Math.max(state.radii[i], 0.006);
        this.a.set(w[i * 16 + 12], w[i * 16 + 13], w[i * 16 + 14]);
        this.m.makeScale(r, r, r).setPosition(this.a);
        this.joints.setMatrixAt(j, this.m);
        this.jointShadow.setMatrixAt(j, this.m);
        j++;
        const p = JOINT_PARENT[i];
        if (p < 0) continue;
        this.b.set(w[p * 16 + 12], w[p * 16 + 13], w[p * 16 + 14]);
        const len = this.a.distanceTo(this.b);
        this.q.setFromUnitVectors(this.yAxis, this.s.subVectors(this.a, this.b).normalize());
        const rr = Math.max(Math.min(state.radii[i], state.radii[p]), 0.005);
        this.m.compose(this.s.addVectors(this.a, this.b).multiplyScalar(0.5), this.q, this.s.set(rr, len, rr));
        this.bones.setMatrixAt(b, this.m);
        this.boneShadow.setMatrixAt(b, this.m);
        b++;
      }
    }
    for (const [mesh, count] of [
      [this.joints, j], [this.jointShadow, j], [this.bones, b], [this.boneShadow, b],
    ] as const) {
      mesh.count = count;
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  /** CPU copy of the projection, for measuring shadow size in plane units. */
  shadowExtent(hands: HandReader, plane: PlaneFrame, light: Vector3, k: number): number | null {
    const M = shadowMatrix(plane, light, k, new Matrix4());
    let min = Infinity, max = -Infinity;
    const p = new Vector4();
    for (const h of HANDS) {
      const state = hands.hands[h];
      if (!state.tracked) continue;
      for (let i = 0; i < JOINT_COUNT; i++) {
        p.set(state.world[i * 16 + 12], state.world[i * 16 + 13], state.world[i * 16 + 14], 1).applyMatrix4(M);
        const [x] = plane.toPlane(new Vector3(p.x / p.w, p.y / p.w, p.z / p.w));
        min = Math.min(min, x); max = Math.max(max, x);
      }
      return max - min; // first tracked hand only
    }
    return null;
  }
}
