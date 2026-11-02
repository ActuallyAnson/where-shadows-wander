// The air between the candle and the wall: a faint shaft of light from the flame toward the wall, and dust that drifts
// through it and catches the light. Two additive meshes, one draw call each, no post-processing: the shaft is a cone with
// a soft edge (its alpha follows how face-on it is), and the dust is points moved entirely in the vertex shader from a
// per-point seed and the clock, so nothing is computed per frame on the CPU except a handful of uniforms.
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  ConeGeometry,
  Group,
  Mesh,
  Points,
  Quaternion,
  ShaderMaterial,
  Vector3,
} from '@iwsdk/core';
import type { StagePlane } from './pure/stage-plane';
import { RenderOrder } from './pure/render-order';

const RENDER_ORDER = RenderOrder.air;
const DUST_COUNT = 72;
/** The shaft's base is this fraction of the wall's width across. */
const SHAFT_WIDTH = 0.7;
/** How bright the shaft and the dust are at most (additive, so small). */
const SHAFT_ALPHA = 0.12;
const DUST_ALPHA = 0.4;

const shaftVertex = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vView;
  varying float vAlong;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vView = normalize(-mv.xyz);
    vAlong = position.y + 0.5; // 1 at the apex (the flame), 0 at the base (the wall)
    gl_Position = projectionMatrix * mv;
  }
`;
const shaftFragment = /* glsl */ `
  uniform float uAlpha;
  varying vec3 vNormal;
  varying vec3 vView;
  varying float vAlong;
  void main() {
    float face = abs(dot(normalize(vNormal), normalize(vView)));
    float soft = pow(face, 1.6);
    float fall = pow(vAlong, 1.4);
    gl_FragColor = vec4(vec3(1.0, 0.82, 0.55), uAlpha * soft * fall);
  }
`;

const dustVertex = /* glsl */ `
  attribute vec4 aSeed;
  uniform vec3 uFlame;
  uniform vec3 uWall;
  uniform vec3 uSide;
  uniform vec3 uUpAxis;
  uniform float uRadius;
  uniform float uTime;
  uniform float uScale;
  varying float vA;
  void main() {
    float t = fract(aSeed.x + uTime * (0.012 + 0.02 * aSeed.y)); // 0 at the flame, 1 at the wall
    vec3 axis = mix(uFlame, uWall, t);
    float r = uRadius * t * (0.2 + 0.8 * aSeed.z);
    float a = aSeed.w * 6.2831 + uTime * (0.05 + 0.1 * aSeed.y);
    vec3 pos = axis + uSide * (cos(a) * r) + uUpAxis * (sin(a) * r * 0.7 + 0.02 * sin(uTime * 0.7 + aSeed.x * 40.0));
    vec4 mv = viewMatrix * vec4(pos, 1.0);
    gl_PointSize = clamp((0.012 + 0.014 * aSeed.y) * uScale / max(-mv.z, 0.1), 1.0, 5.0);
    vA = smoothstep(0.0, 0.12, t) * (1.0 - smoothstep(0.82, 1.0, t)) * (1.0 - 0.5 * (r / max(uRadius, 0.01)));
    gl_Position = projectionMatrix * mv;
  }
`;
const dustFragment = /* glsl */ `
  uniform float uAlpha;
  varying float vA;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    if (d > 1.0) discard;
    gl_FragColor = vec4(vec3(1.0, 0.86, 0.6), uAlpha * vA * (1.0 - d * d));
  }
`;

export class AirView {
  readonly group = new Group();
  private readonly shaft: Mesh;
  private readonly shaftMat: ShaderMaterial;
  private readonly dust: Points;
  private readonly dustMat: ShaderMaterial;
  private readonly flame = new Vector3();
  private readonly wall = new Vector3();
  private readonly axis = new Vector3();
  private readonly mid = new Vector3();
  private readonly quat = new Quaternion();
  private readonly yAxis = new Vector3(0, 1, 0);
  private time = 0;

  constructor() {
    // A unit cone with its apex at +y: scaled and turned each frame to run from the flame to the wall.
    const cone = new ConeGeometry(1, 1, 32, 1, true);
    this.shaftMat = new ShaderMaterial({
      uniforms: { uAlpha: { value: SHAFT_ALPHA } },
      vertexShader: shaftVertex,
      fragmentShader: shaftFragment,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    this.shaft = new Mesh(cone, this.shaftMat);
    this.shaft.renderOrder = RENDER_ORDER;
    this.shaft.frustumCulled = false;

    const seed = new Float32Array(DUST_COUNT * 4);
    let s = 7;
    const rand = () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
    for (let i = 0; i < seed.length; i++) seed[i] = rand();
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(new Float32Array(DUST_COUNT * 3), 3));
    geo.setAttribute('aSeed', new BufferAttribute(seed, 4));
    this.dustMat = new ShaderMaterial({
      uniforms: {
        uFlame: { value: new Vector3() },
        uWall: { value: new Vector3() },
        uSide: { value: new Vector3(1, 0, 0) },
        uUpAxis: { value: new Vector3(0, 1, 0) },
        uRadius: { value: 0.5 },
        uTime: { value: 0 },
        uScale: { value: 260 },
        uAlpha: { value: DUST_ALPHA },
      },
      vertexShader: dustVertex,
      fragmentShader: dustFragment,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    this.dust = new Points(geo, this.dustMat);
    this.dust.renderOrder = RENDER_ORDER;
    this.dust.frustumCulled = false;
    this.group.add(this.shaft, this.dust);
    this.group.visible = false;
  }

  /**
   * Once per frame. `flame` is the flame's scene position, `brightness` (0..1) the flame's brightness with flicker and
   * covering (0 hides the air). Hidden over passthrough, where there is a real room to see.
   */
  update(stage: StagePlane, flame: ArrayLike<number>, brightness: number, dt: number, show: boolean): void {
    this.group.visible = show && brightness > 0.02;
    if (!this.group.visible) return;
    this.time += dt > 0 ? Math.min(dt, 0.1) : 0;
    this.flame.set(flame[0], flame[1], flame[2]);
    this.wall.set(stage.origin[0], stage.origin[1], stage.origin[2]);
    const radius = stage.width * SHAFT_WIDTH * 0.5;
    this.axis.copy(this.flame).sub(this.wall); // wall to flame
    const length = this.axis.length();
    if (!(length > 0.05)) {
      this.group.visible = false;
      return;
    }
    this.axis.multiplyScalar(1 / length);
    this.mid.copy(this.flame).add(this.wall).multiplyScalar(0.5);
    this.quat.setFromUnitVectors(this.yAxis, this.axis);
    this.shaft.position.copy(this.mid);
    this.shaft.quaternion.copy(this.quat);
    this.shaft.scale.set(radius, length, radius);
    this.shaftMat.uniforms.uAlpha.value = SHAFT_ALPHA * brightness;

    const u = this.dustMat.uniforms;
    (u.uFlame.value as Vector3).copy(this.flame);
    (u.uWall.value as Vector3).copy(this.wall);
    (u.uSide.value as Vector3).set(stage.right[0], stage.right[1], stage.right[2]);
    (u.uUpAxis.value as Vector3).set(stage.up[0], stage.up[1], stage.up[2]);
    u.uRadius.value = radius;
    u.uTime.value = this.time;
    u.uAlpha.value = DUST_ALPHA * brightness;
  }

  dispose(): void {
    this.shaft.geometry.dispose();
    this.shaftMat.dispose();
    this.dust.geometry.dispose();
    this.dustMat.dispose();
  }
}
