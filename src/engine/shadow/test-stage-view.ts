// What the stage looks like until Teammate B's room and lantern replace it: a sheet of paper on whatever stage
// it is placed on (the real wall in a headset, the stand-in theatre in the Hand Lab), with a thin border, and a
// small flame for the Hand Lab's lantern.
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Group,
  LineBasicMaterial,
  LineLoop,
  Matrix4,
  Mesh,
  PlaneGeometry,
  ShaderMaterial,
  Vector2,
  Vector3,
} from '@iwsdk/core';
import type { Quaternion } from '@iwsdk/core';
import { LanternGlow } from './lantern-glow';
import type { LanternLight } from './pure/lantern-light';
import type { StagePlane } from './pure/stage-plane';

const PAPER = new Color(0xf2e6c9);

const vertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// The paper, lit by the flame without any scene light: an inverse-square pool of light round the point of the wall nearest
// the flame (so a far wall still reads), a floor so the edges never go black, fine fibres and soft mottling that the light
// rakes across, and edges that darken like the rim of a sheet. One quad, one draw call, nothing per pixel but arithmetic.
const fragment = /* glsl */ `
  uniform vec3 uPaper;
  uniform vec3 uFlame;     // the flame on the wall: x, y metres from the centre, z metres in front of it
  uniform vec2 uSize;      // the wall's width and height, metres
  uniform float uBright;   // 0..1 flame brightness (flicker and cover-the-flame included)
  uniform float uOpacity;
  uniform float uMood;     // 0 cold and bluish .. 1 warm
  uniform float uTime;
  uniform float uHigh;     // 1 for high contrast: plain white, no texture
  varying vec2 vUv;

  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }

  void main() {
    if (uHigh > 0.5) {
      gl_FragColor = vec4(1.0, 1.0, 1.0, uOpacity);
      #include <colorspace_fragment>
      return;
    }
    vec2 p = (vUv - 0.5) * uSize;
    vec2 d = p - uFlame.xy;
    float h = max(uFlame.z, 0.05);
    float pool = pow(h * h / (h * h + dot(d, d)), 1.5);

    // Fibres and mottling; the fibres drift a hair with the flame's heat.
    vec2 q = p + vec2(0.0006 * sin(uTime * 1.3 + p.y * 40.0), 0.0004 * cos(uTime * 1.1 + p.x * 40.0));
    float fine = vnoise(q * 220.0);
    float fibre = vnoise(q * vec2(40.0, 520.0)) * 0.5 + vnoise(q * vec2(520.0, 40.0)) * 0.5;
    float blot = vnoise(p * 7.0) * 0.6 + vnoise(p * 23.0) * 0.4;
    // A bump from the fibres, lit from the flame: the paper's tooth shows more where the light comes in low.
    float e = 0.004;
    float gx = vnoise((q + vec2(e, 0.0)) * 220.0) - vnoise((q - vec2(e, 0.0)) * 220.0);
    float gy = vnoise((q + vec2(0.0, e)) * 220.0) - vnoise((q - vec2(0.0, e)) * 220.0);
    vec3 n = normalize(vec3(-vec2(gx, gy) * 0.45, 1.0));
    vec3 l = normalize(vec3(-d, h));
    float tooth = clamp(dot(n, l) / l.z, 0.94, 1.05);

    float light = uBright * (0.42 + 0.58 * pool) * 1.12;
    vec3 tint = mix(vec3(0.8, 0.9, 1.06), vec3(1.08, 0.95, 0.76), uMood);
    vec3 col = uPaper * tint * light * tooth * (0.965 + 0.02 * fine + 0.015 * fibre) * (0.97 + 0.03 * blot);

    // The rim of the sheet darkens a little, unevenly.
    float edge = min(min(vUv.x, 1.0 - vUv.x) * uSize.x, min(vUv.y, 1.0 - vUv.y) * uSize.y);
    float rim = smoothstep(0.0, 0.035 + 0.01 * blot, edge);
    col *= mix(0.7, 1.0, rim);

    gl_FragColor = vec4(col, uOpacity);
    #include <colorspace_fragment>
  }
`;

const PAPER_OPACITY = 0.95;
const BORDER = 0x8a6d3b;

/** The paper draws before the shadows (SHADOW_RENDER_ORDER = 2). */
const PAPER_RENDER_ORDER = 1;

export class TestStageView {
  readonly group = new Group();
  private readonly paper: Mesh;
  private readonly border: LineLoop;
  private readonly paperMaterial: ShaderMaterial;
  private readonly flame = new LanternGlow();
  private readonly m = new Matrix4();
  private readonly local = new Vector3();
  private stage: StagePlane | null = null;
  private time = 0;
  private _highContrast = false;
  private _mood = 0.75;

  constructor() {
    this.paperMaterial = new ShaderMaterial({
      uniforms: {
        uPaper: { value: PAPER.clone() },
        uFlame: { value: new Vector3(0, 0, 1) },
        uSize: { value: new Vector2(1.6, 1) },
        uBright: { value: 0.04 },
        uOpacity: { value: PAPER_OPACITY },
        uMood: { value: this._mood },
        uTime: { value: 0 },
        uHigh: { value: 0 },
      },
      vertexShader: vertex,
      fragmentShader: fragment,
      transparent: true,
      premultipliedAlpha: false,
      toneMapped: false,
      depthWrite: false,
      side: DoubleSide,
    });
    this.paper = new Mesh(new PlaneGeometry(1, 1), this.paperMaterial);
    this.paper.renderOrder = PAPER_RENDER_ORDER;
    const corners = new Float32Array([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0]);
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(corners, 3));
    this.border = new LineLoop(g, new LineBasicMaterial({ color: BORDER }));
    for (const o of [this.paper, this.border]) {
      o.matrixAutoUpdate = false;
      o.frustumCulled = false;
    }
    this.group.add(this.paper, this.border, this.flame.mesh);
    this.group.visible = false;
  }

  /** Places the paper on the stage and the flame at the lantern. Call when either moves. */
  place(stage: StagePlane, lantern: Readonly<ArrayLike<number>>): void {
    this.stage = stage;
    const r = stage.right,
      u = stage.up,
      n = stage.normal,
      o = stage.origin;
    // prettier-ignore
    this.m.set(
      r[0] * stage.width, u[0] * stage.height, n[0], o[0],
      r[1] * stage.width, u[1] * stage.height, n[1], o[1],
      r[2] * stage.width, u[2] * stage.height, n[2], o[2],
      0, 0, 0, 1,
    );
    this.paper.matrix.copy(this.m);
    this.border.matrix.copy(this.m);
    this.paper.matrixWorldNeedsUpdate = this.border.matrixWorldNeedsUpdate = true;
    (this.paperMaterial.uniforms.uSize.value as Vector2).set(stage.width, stage.height);
    this.flame.mesh.position.set(lantern[0], lantern[1], lantern[2]);
    this.setFlameOnWall(lantern);
    this.group.visible = true;
  }

  /** The flame's place relative to the wall: across, up and out from the centre, metres. */
  private setFlameOnWall(flame: Readonly<ArrayLike<number>>): void {
    const st = this.stage;
    if (!st) return;
    const dx = flame[0] - st.origin[0],
      dy = flame[1] - st.origin[1],
      dz = flame[2] - st.origin[2];
    this.local.set(
      dx * st.right[0] + dy * st.right[1] + dz * st.right[2],
      dx * st.up[0] + dy * st.up[1] + dz * st.up[2],
      dx * st.normal[0] + dy * st.normal[1] + dz * st.normal[2],
    );
    (this.paperMaterial.uniforms.uFlame.value as Vector3).copy(this.local);
  }

  /**
   * High contrast (an accessibility setting): the paper is pure bright white and fully opaque whatever the flame does,
   * with no texture and a black border, so black shadows read as strongly as they can.
   */
  set highContrast(on: boolean) {
    this._highContrast = on;
    this.paperMaterial.uniforms.uOpacity.value = on ? 1 : PAPER_OPACITY;
    this.paperMaterial.uniforms.uHigh.value = on ? 1 : 0;
    (this.border.material as LineBasicMaterial).color.setHex(on ? 0x000000 : BORDER);
  }

  get highContrast(): boolean {
    return this._highContrast;
  }

  /** The room's mood, 0 (cold, bluish: the night before anything is solved) to 1 (warm: the lantern's whole glow). */
  set mood(v: number) {
    this._mood = v >= 1 ? 1 : v > 0 ? v : 0;
    this.paperMaterial.uniforms.uMood.value = this._mood;
  }

  get mood(): number {
    return this._mood;
  }

  /** The stand-in flame (hidden where another lantern view is shown, e.g. the Hand Lab's). */
  set flameVisible(v: boolean) {
    this.flame.mesh.visible = v;
  }

  /**
   * The flame lights the paper (brightness and tint from the light, so it flickers with it). `occlusion` (0..1) dims it
   * down to the floor when hands cup or smother the flame. `flame` is the flame's scene position, if it has moved.
   */
  applyLight(
    light: Readonly<LanternLight>,
    cameraQuaternion: Readonly<Quaternion>,
    occlusion = 1.0,
    flame?: Readonly<ArrayLike<number>>,
    dt = 0,
  ): void {
    if (flame) this.setFlameOnWall(flame);
    this.time += dt > 0 ? Math.min(dt, 0.1) : 0;
    const u = this.paperMaterial.uniforms;
    u.uTime.value = this.time;
    u.uBright.value = light.lit ? Math.max(0.04, occlusion * (0.15 + 0.85 * light.intensity)) : 0.04;
    this.flame.update(light, cameraQuaternion);
  }
}
