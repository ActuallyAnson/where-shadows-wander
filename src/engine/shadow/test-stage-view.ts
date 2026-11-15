// What the stage looks like until Teammate B's room and lantern replace it: a sheet of paper on whatever stage
// it is placed on (the real wall in a headset, the stand-in theatre in the Hand Lab), with a thin border, and a
// small flame for the Hand Lab's lantern.
import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  DoubleSide,
  Group,
  LineBasicMaterial,
  LineLoop,
  Matrix4,
  Mesh,
  PlaneGeometry,
  RepeatWrapping,
  ShaderMaterial,
  SRGBColorSpace,
  Vector2,
  Vector3,
} from '@iwsdk/core';
import type { Quaternion } from '@iwsdk/core';
import { LanternGlow } from './lantern-glow';
import {
  BACKDROP_THEMES,
  paintBackdrop,
  paintBackdropTheme,
  type BackdropLayer,
  type BackdropTheme,
} from './stage-backdrop-art';
import type { LanternLight } from './pure/lantern-light';
import type { StagePlane } from './pure/stage-plane';
import { RenderOrder } from './pure/render-order';
import { LIGHT_POOL_RX_M, LIGHT_POOL_RY_M, stageEdgeGlsl } from './stage-edge-glsl';

const PAPER = new Color(0xf2e6c9);
/** On the room's wall: how far out (a share of the pool's radius) the candle's light stays solid before it starts to thin. */
const POOL_SOLID = 0.3;

const vertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// The paper, lit by the flame without any scene light: an inverse-square pool of light round the point of the wall nearest
// the flame (so a far wall still reads), a floor so the edges never go black, fine fibres and soft mottling that the light
// rakes across. On the room's wall the quad covers most of the wall and the paper is the middle of the candle's round pool of
// light, fading into the wallpaper; elsewhere it is a sheet whose rim darkens. One quad, one draw call, nothing per pixel but arithmetic.
/** The paper's tint for a mood, 0 (cold and bluish) to 1 (warm). */
function moodTint(mood: number, out: Vector3): Vector3 {
  return out.set(0.8 + 0.28 * mood, 0.9 + 0.05 * mood, 1.06 - 0.3 * mood);
}

const fragment = /* glsl */ `
  uniform vec3 uPaper;
  uniform vec3 uFlame;     // the flame on the wall: x, y metres from the centre, z metres in front of it
  uniform vec2 uSize;      // the wall's width and height, metres
  uniform float uBright;   // 0..1 flame brightness (flicker and cover-the-flame included)
  uniform float uOpacity;
  uniform float uMood;     // 0 cold and bluish .. 1 warm (the painted scenery's tint)
  uniform vec3 uTint;      // the candle's pool's tint (from the mood, or the candle's mood: setTint)
  uniform float uTime;
  uniform float uHigh;     // 1 for high contrast: plain white, no texture
  uniform sampler2D uSky;
  uniform sampler2D uFar;
  uniform sampler2D uMid;
  uniform sampler2D uNear;
  uniform sampler2D uClouds;
  uniform vec2 uHead;      // the head's place across and up from the stage's centre, metres (the scenery's layers shift with it)
  uniform float uBackdrop; // how much of the paper the painted scenery replaces, 0..1
  uniform float uMidShift; // how far the near scenery has slid sideways (a set change), in widths of the paper
  uniform vec2 uStage;     // the stage's (the puzzles') width and height, metres: the paper and its scenery
  uniform vec2 uAreaC;     // the middle of the drawn quad (uSize), metres from the stage's centre
  uniform vec2 uPoolR;     // the candle's pool of light's radii, metres
  uniform float uPoolOn;   // 1: the stage is the middle of a pool of light on the room's wall; 0: a sheet with a darkened rim
  varying vec2 vUv;
${stageEdgeGlsl}

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
    // p: metres from the stage's centre (the quad may be bigger than the stage, and centred elsewhere: the whole wall).
    vec2 p = (vUv - 0.5) * uSize + uAreaC;
    vec2 su = p / uStage + 0.5; // 0..1 across the stage
    if (uHigh > 0.5) {
      if (su.x < 0.0 || su.x > 1.0 || su.y < 0.0 || su.y > 1.0) discard; // the plain, hard sheet: only the stage
      gl_FragColor = vec4(1.0, 1.0, 1.0, uOpacity);
      #include <colorspace_fragment>
      return;
    }
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
    vec3 col = uPaper * uTint * light * tooth * (0.965 + 0.02 * fine + 0.015 * fibre) * (0.97 + 0.03 * blot);

    // The painted scenery behind the shadows: sky and moon, far hills, drifting clouds, near hills with a cottage, a fringe of
    // grass, and a few fireflies. Each layer is shifted a little by where the head is (the far ones with it, the near ones against
    // it), so the paper has depth. It is pale and low in contrast on purpose, so the black shadows still read.
    if (uBackdrop > 0.0) {
      vec2 head = clamp(uHead, vec2(-0.5), vec2(0.5));
      vec2 base = (su - 0.5) * 0.93 + 0.5;
      vec3 bg = texture2D(uSky, base - head * 0.012).rgb;
      vec4 far = texture2D(uFar, base - head * 0.03);
      bg = mix(bg, far.rgb, far.a);
      vec4 cl = texture2D(uClouds, vec2(base.x - head.x * 0.02 + uTime * 0.005, base.y - head.y * 0.02));
      bg = mix(bg, vec3(1.0), cl.a * 0.5);
      vec4 mid = texture2D(uMid, base + head * 0.004 + vec2(uMidShift, 0.0));
      bg = mix(bg, mid.rgb, mid.a * (1.0 - smoothstep(0.0, 0.9, abs(uMidShift))));
      vec4 nr = texture2D(uNear, base + head * 0.08);
      bg = mix(bg, nr.rgb, nr.a);
      for (int i = 0; i < 7; i++) {
        float fi = float(i);
        vec2 home = (vec2(hash(vec2(fi, 1.3)), 0.2 + 0.55 * hash(vec2(fi, 7.1))) - 0.5) * uStage;
        vec2 fp = home + vec2(0.035 * sin(uTime * 0.4 + fi * 2.1), 0.025 * cos(uTime * 0.5 + fi * 1.7));
        vec2 dd = p - fp;
        float flick = 0.5 + 0.5 * sin(uTime * (1.2 + fi * 0.3) + fi * 4.0);
        float r2 = dot(dd, dd);
        bg += vec3(1.0, 0.82, 0.42) * (exp(-r2 * 16000.0) * 0.9 + exp(-r2 * 420.0) * 0.2) * flick;
      }
      vec3 sceneTint = mix(vec3(0.84, 0.92, 1.08), vec3(1.1, 0.95, 0.8), uMood);
      vec3 scene = bg * sceneTint * light * tooth * (0.97 + 0.03 * blot);
      // The scenery belongs to the stage: on the wall it fades out in an oval inside the stage, into the plain candlelight, so no
      // edge of it shows.
      float sceneryMask = uPoolOn > 0.5 ? 1.0 - smoothstep(0.45, 1.0, length(p / (0.5 * uStage))) : 1.0;
      col = mix(col, scene, uBackdrop * sceneryMask);
    }

    // On the room's wall the stage is the middle of the candle's pool of light: one light, round, covering most of the wall, leaning
    // toward the flame. Everything about it falls off smoothly with the distance from its centre, with no step anywhere (the stage
    // has no edge of its own): it thins into the wallpaper, dims, and warms toward the rim, a little unevenly, like light through a
    // worn shade. The floor, ceiling and side walls cut it off. Otherwise (a sheet) the rim of the sheet darkens.
    float alpha = uOpacity;
    if (uPoolOn > 0.5) {
      float r = poolDist(p, uFlame.xy, uPoolR * (0.97 + 0.06 * blot));
      float core = 1.0 - smoothstep(0.0, 1.0, r);
      col *= (0.7 + 0.3 * core) * mix(vec3(1.0, 0.8, 0.58), vec3(1.0), 1.0 - smoothstep(0.15, 0.95, r));
      alpha = uOpacity * (1.0 - smoothstep(${POOL_SOLID.toFixed(3)}, 1.0, r)) * stageEdge(p - uAreaC, uSize, 0.03);
    } else {
      float edge = min(min(vUv.x, 1.0 - vUv.x) * uSize.x, min(vUv.y, 1.0 - vUv.y) * uSize.y);
      col *= mix(0.7, 1.0, smoothstep(0.0, 0.035 + 0.01 * blot, edge));
    }

    gl_FragColor = vec4(col, alpha);
    #include <colorspace_fragment>
  }
`;

/** How much of the paper the scenery replaces: enough to see it, little enough that the black shadows still read. */
export const BACKDROP = 0.72;
const PAPER_OPACITY = 0.95;
const BORDER = 0x8a6d3b;

/** The paper draws before the shadows (SHADOW_RENDER_ORDER = 2). */
const PAPER_RENDER_ORDER = RenderOrder.paper;

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
  private readonly textures: CanvasTexture[] = [];
  /** The near scenery for each puzzle, and the set change in progress: which one is up, which is wanted, and how far along. */
  private readonly themeTextures: (CanvasTexture | null)[] = [];
  private themeUp = -1;
  private themeWanted = -1;
  private slide = 1;
  private readonly headLocal = new Vector3();
  /** Where the candle's pool of light is drawn ([width, height, centre x, centre y], stage metres; lightArea), or null for a sheet. */
  private pool: Float64Array | null = null;

  constructor() {
    this.paperMaterial = new ShaderMaterial({
      uniforms: {
        uPaper: { value: PAPER.clone() },
        uFlame: { value: new Vector3(0, 0, 1) },
        uSize: { value: new Vector2(1.6, 1) },
        uBright: { value: 0.04 },
        uOpacity: { value: PAPER_OPACITY },
        uMood: { value: this._mood },
        uTint: { value: moodTint(this._mood, new Vector3()) },
        uTime: { value: 0 },
        uHigh: { value: 0 },
        uSky: { value: this.layerTexture('sky') },
        uFar: { value: this.layerTexture('far') },
        uMid: { value: this.layerTexture('mid') },
        uNear: { value: this.layerTexture('near') },
        uClouds: { value: this.layerTexture('clouds', true) },
        uHead: { value: new Vector2(0, 0) },
        uBackdrop: { value: BACKDROP },
        uMidShift: { value: 0 },
        uStage: { value: new Vector2(1.6, 1) },
        uAreaC: { value: new Vector2(0, 0) },
        uPoolR: { value: new Vector2(LIGHT_POOL_RX_M, LIGHT_POOL_RY_M) },
        uPoolOn: { value: 0 },
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

  /** A painted layer of the scenery as a texture (the clouds wrap across so they can drift). */
  private layerTexture(layer: BackdropLayer, wrap = false): CanvasTexture {
    let canvas: HTMLCanvasElement | undefined;
    if (typeof document !== 'undefined') canvas = document.createElement('canvas');
    if (!canvas) canvas = { width: 640, height: 360, getContext: () => null } as unknown as HTMLCanvasElement;
    // The scenery is soft and pale, so a modest size does it (a quarter the memory of 1024 by 576 for each of the five layers).
    canvas.width = 640;
    canvas.height = 360;
    const g = canvas.getContext ? canvas.getContext('2d') : null;
    if (g) paintBackdrop(g, 640, 360, layer);
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    if (wrap) texture.wrapS = RepeatWrapping;
    this.textures.push(texture);
    return texture;
  }

  /**
   * Where the head is, so the scenery's layers can shift against each other as it moves (call once a frame with the head's
   * world position). Allocates nothing.
   */
  setHead(head: Readonly<{ x: number; y: number; z: number }>): void {
    const st = this.stage;
    if (!st) return;
    const dx = head.x - st.origin[0],
      dy = head.y - st.origin[1],
      dz = head.z - st.origin[2];
    this.headLocal.set(
      dx * st.right[0] + dy * st.right[1] + dz * st.right[2],
      dx * st.up[0] + dy * st.up[1] + dz * st.up[2],
      0,
    );
    (this.paperMaterial.uniforms.uHead.value as Vector2).set(this.headLocal.x, this.headLocal.y);
  }

  /** How much of the paper the painted scenery replaces (0 is the plain paper). */
  set backdrop(v: number) {
    this.paperMaterial.uniforms.uBackdrop.value = v >= 1 ? 1 : v > 0 ? v : 0;
  }

  get backdrop(): number {
    return this.paperMaterial.uniforms.uBackdrop.value as number;
  }

  dispose(): void {
    for (const t of this.textures) t.dispose();
    this.paper.geometry.dispose();
    this.paperMaterial.dispose();
  }

  /**
   * Changes the near scenery to puzzle `index`'s: the old set slides off one side of the paper (half a second) and the new one slides
   * in from the other (another half). The first call just puts the scenery up.
   */
  setTheme(index: number): void {
    const wanted = Math.max(0, Math.min(BACKDROP_THEMES - 1, Math.floor(index) || 0));
    if (wanted === this.themeWanted) return;
    this.themeWanted = wanted;
    if (this.themeUp < 0) {
      this.themeUp = wanted;
      this.paperMaterial.uniforms.uMid.value = this.themeTexture(wanted);
      return;
    }
    this.slide = 0; // goes 0..0.5 out, 0.5..1 in
  }

  /** The painted near scenery for a puzzle (made the first time it is wanted, then kept). */
  private themeTexture(theme: number): CanvasTexture {
    let t = this.themeTextures[theme];
    if (!t) {
      let canvas: HTMLCanvasElement | undefined;
      if (typeof document !== 'undefined') canvas = document.createElement('canvas');
      if (!canvas) canvas = { width: 512, height: 288, getContext: () => null } as unknown as HTMLCanvasElement;
      canvas.width = 512;
      canvas.height = 288;
      const g = canvas.getContext ? canvas.getContext('2d') : null;
      if (g) paintBackdropTheme(g, 512, 288, theme as BackdropTheme);
      t = new CanvasTexture(canvas);
      t.colorSpace = SRGBColorSpace;
      this.textures.push(t);
      this.themeTextures[theme] = t;
    }
    return t;
  }

  /**
   * Draws the stage as the middle of the candle's pool of light over `area` ([width, height, centre x, centre y], metres from the
   * stage's centre: lightArea in stage-edge-glsl.ts), or as a plain sheet with `null`. Takes effect at the next `place`.
   */
  setPool(area: Readonly<ArrayLike<number>> | null): void {
    if (!area) this.pool = null;
    else {
      this.pool ??= new Float64Array(4);
      for (let i = 0; i < 4; i++) this.pool[i] = area[i];
    }
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
    this.border.matrix.copy(this.m);
    // The paper's quad: the stage, or the whole area the candle's pool of light is drawn on.
    const a = this.pool;
    const w = a ? a[0] : stage.width,
      h = a ? a[1] : stage.height,
      cx = a ? a[2] : 0,
      cy = a ? a[3] : 0;
    // prettier-ignore
    this.m.set(
      r[0] * w, u[0] * h, n[0], o[0] + r[0] * cx + u[0] * cy,
      r[1] * w, u[1] * h, n[1], o[1] + r[1] * cx + u[1] * cy,
      r[2] * w, u[2] * h, n[2], o[2] + r[2] * cx + u[2] * cy,
      0, 0, 0, 1,
    );
    this.paper.matrix.copy(this.m);
    this.paper.matrixWorldNeedsUpdate = this.border.matrixWorldNeedsUpdate = true;
    const uniforms = this.paperMaterial.uniforms;
    (uniforms.uSize.value as Vector2).set(w, h);
    (uniforms.uAreaC.value as Vector2).set(cx, cy);
    (uniforms.uStage.value as Vector2).set(stage.width, stage.height);
    uniforms.uPoolOn.value = a && !this._highContrast ? 1 : 0;
    this.border.visible = !a || this._highContrast; // a pool of light has no outline; a sheet (and high contrast) does
    // On the room's wall the candle lights the wallpaper itself (candle-light.ts) and the shadows fall on it: no paper is drawn,
    // except the plain, hard sheet of high contrast.
    this.paper.visible = !a || this._highContrast;
    this.flame.mesh.position.set(lantern[0], lantern[1], lantern[2]);
    this.setFlameOnWall(lantern);
    this.group.visible = true;
  }

  /** Where the flame is, across, up and out from the stage's centre, metres (as of the last place or applyLight). */
  get flameOnWall(): Readonly<Vector3> {
    return this.local;
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
    // High contrast keeps a hard, outlined sheet: the clearest edge there is.
    this.border.visible = on || !this.pool;
    this.paper.visible = on || !this.pool;
    this.paperMaterial.uniforms.uPoolOn.value = on || !this.pool ? 0 : 1;
  }

  get highContrast(): boolean {
    return this._highContrast;
  }

  /** The room's mood, 0 (cold, bluish: the night before anything is solved) to 1 (warm: the lantern's whole glow). */
  set mood(v: number) {
    this._mood = v >= 1 ? 1 : v > 0 ? v : 0;
    this.paperMaterial.uniforms.uMood.value = this._mood;
    moodTint(this._mood, this.paperMaterial.uniforms.uTint.value as Vector3);
  }

  /** Tints the candle's pool of light on the wall (about 1 each is neutral; the candle's mood, candle-mood.ts). */
  setTint(r: number, g: number, b: number): void {
    (this.paperMaterial.uniforms.uTint.value as Vector3).set(r, g, b);
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
    // A set change: the old scenery slides off, the new one is swapped in out of sight, and slides on.
    if (this.slide < 1) {
      this.slide = Math.min(1, this.slide + (dt > 0 ? Math.min(dt, 0.1) : 0) * 1);
      if (this.slide >= 0.5 && this.themeUp !== this.themeWanted) {
        this.themeUp = this.themeWanted;
        u.uMid.value = this.themeTexture(this.themeUp);
      }
      const k = this.slide < 0.5 ? this.slide * 2 : (this.slide - 0.5) * 2;
      const ease = k * k * (3 - 2 * k);
      u.uMidShift.value = this.slide < 0.5 ? ease * 1.0 : -(1 - ease) * 1.0;
    }
    u.uTime.value = this.time;
    u.uBright.value = light.lit ? Math.max(0.04, occlusion * (0.15 + 0.85 * light.intensity)) : 0.04;
    this.flame.update(light, cameraQuaternion);
  }
}
