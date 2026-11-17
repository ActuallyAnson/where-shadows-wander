// The candle as a real light for the bedroom: every room surface is lit by it per pixel (by how far it is from the flame and how
// squarely it faces it), the room's static props cast shadows from it, and so do the player's hands (`hands`, drawn every frame).
//
// The room's materials stay MeshBasicMaterial (its painted look is tuned unlit); `light(material)` patches one so its colour is
// multiplied by the candle's light. A real three.js light would light everything, the candle and tray inches from the flame too,
// and its shadow would be drawn again every frame. Here the shadows are baked: a small cube map of the distance from the flame to
// the nearest caster in every direction, rendered once, and again only when the flame moves. Every lit surface looks up whether
// a caster is nearer the flame than it is. Nothing is allocated per frame.
//
// The moon is the room's other light: faint and blue everywhere (the ambient), and a beam through the window (`setMoonWindow`).
// The beam lights only what the window's opening (less its cross bars) can see the moon from, so it falls on the desk under the
// window, the floor beyond it and the side of the bed; the same casters shadow it (a second map, from the moon's side, baked
// again only when the room moves). Its edges soften the further the light has come from the window, as a real window's do.
import {
  Color,
  CubeCamera,
  DoubleSide,
  Matrix4,
  Mesh,
  NearestFilter,
  OrthographicCamera,
  ShaderMaterial,
  Vector2,
  Vector3,
  Vector4,
  WebGLCubeRenderTarget,
  WebGLRenderTarget,
} from '@iwsdk/core';
import type { Material, MeshBasicMaterial, Object3D, Scene, Texture, WebGLRenderer } from '@iwsdk/core';
import { HandShadowMap, handShadowGlsl } from './hand-shadow-map';

/** The layer only the shadow casters are on (as well as the default one), so the bake draws nothing else. */
export const CASTER_LAYER = 7;
/** The shadow map's size (each face), its range from the flame (m), and how far a caster must be in front of a surface to shade it. */
const SHADOW_SIZE = 256;
const SHADOW_NEAR = 0.01;
const SHADOW_FAR = 8;
/** The flame has to move this far (m) before the shadows are baked again. */
const REBAKE_MOVE = 0.01;
/** The candle's light where it is half gone (m). */
export const CANDLE_REACH_M = 1.6;
/** The two lights in the room: the moon's, faint, blue and everywhere (the room's ambient), and the candle's, warm, from the flame. */
export const MOON_LIGHT = new Color(0.025, 0.03, 0.055);
export const CANDLE_COLOUR = new Color(1.0, 0.82, 0.6);
/** The moon's beam through the window, where it falls square on (a cool silver blue, several times the ambient). Tune in the headset. */
export const MOON_BEAM = new Color(0.2, 0.26, 0.46);
/**
 * Where the moon is, seen from the window: how high it stands (degrees above level), and how far it is round towards the stage
 * (degrees), so its light falls slanting down onto the desk and the floor beside the bed, a little towards the player.
 */
const MOON_ELEVATION_DEG = 36;
const MOON_AZIMUTH_DEG = 12;
/** How much a lightning flash adds to the beam, as a multiple of it. */
export const MOON_FLASH = 2.5;
/** The moon's shadow map: its size, and half the width it covers across the beam (m: the window's opening and some). */
const MOON_SHADOW_SIZE = 512;
const MOON_SHADOW_HALF = 0.8;
/** The window's cross bars (m wide), which the beam carries across the floor as shadows. */
const WINDOW_BAR_M = 0.03;
/**
 * The candle's light is thrown forward, at the wall the shadows play on (as if shaded behind): full within BEAM_INNER_DEG of
 * where it is aimed, fading to BEAM_SIDE by BEAM_OUTER_DEG and beyond, so the wall is bright and the room round it dark. Within
 * BEAM_NEAR_M of the flame (the tray, the blanket) it lights every way.
 */
const BEAM_INNER_DEG = 28;
const BEAM_OUTER_DEG = 70;
const BEAM_SIDE = 0.12;
const BEAM_NEAR_M = 0.35;
/** The candle's brightness on the axis of its beam, as a share of its brightness unaimed (the beam's light is gathered there). */
const BEAM_GAIN = 1.5;

const packGlsl = /* glsl */ `
  vec4 candlePack(float v) {
    vec4 enc = fract(vec4(1.0, 255.0, 65025.0, 16581375.0) * v);
    return enc - enc.yzww * vec4(1.0 / 255.0, 1.0 / 255.0, 1.0 / 255.0, 0.0);
  }
  float candleUnpack(vec4 c) {
    return dot(c, vec4(1.0, 1.0 / 255.0, 1.0 / 65025.0, 1.0 / 16581375.0));
  }
`;

/**
 * Draws a caster into a shadow map: its distance from the flame (or, for the moon's map, how far along the beam it is from the
 * map's camera: `uAlong.w` 1, `uAlong.xyz` the beam's way), packed into the colour (cut out where its texture is clear).
 */
const distanceVertex = /* glsl */ `
  varying vec3 vWorld;
  varying vec2 vUv;
  void main() {
    vec4 p = vec4(position, 1.0);
    #ifdef USE_INSTANCING
      p = instanceMatrix * p;
    #endif
    vec4 w = modelMatrix * p;
    vWorld = w.xyz;
    vUv = uv;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;
const distanceFragment = /* glsl */ `
  uniform vec3 uFlame;
  uniform float uFar;
  uniform sampler2D uMap;
  uniform float uHasMap;
  uniform vec4 uAlong;
  varying vec3 vWorld;
  varying vec2 vUv;
  ${packGlsl}
  void main() {
    if (uHasMap > 0.5 && texture2D(uMap, vUv).a < 0.5) discard;
    vec3 d = vWorld - uFlame;
    float dist = uAlong.w > 0.5 ? dot(d, uAlong.xyz) : length(d);
    gl_FragColor = candlePack(clamp(dist / uFar, 0.0, 0.999));
  }
`;

/** How far the wall's normal map leans a bumped surface's normal (0 flat, 1 as the map has it). Tune in the headset. */
export const BUMP_STRENGTH = 0.6;

/** A normal map for a flat quad (a PlaneGeometry: +x along it, +y up it), and how many times it repeats across the quad. */
export interface CandleBump {
  readonly map: Texture;
  readonly repeat: readonly [number, number];
}

/**
 * What a patched material adds to its fragment shader: the candle's light at this point, shadows included. With `bump`, the
 * normal is leaned by a normal map first, so the light catches the surface's lumps (most where it rakes, at the pool's edge).
 */
const lightGlsl = (bump: boolean, hands: boolean) => /* glsl */ `
  ${bump ? '#define CANDLE_BUMP' : ''}
  ${hands ? '#define CANDLE_HANDS' : ''}
  uniform vec3 uCandlePos;
  uniform float uFullBright;
  uniform float uCandleIntensity;
  uniform vec3 uCandleColour;
  uniform float uCandleReach;
  uniform vec3 uMoonLight;
  uniform samplerCube uCandleShadow;
  uniform float uCandleShadowOn;
  uniform float uCandleFar;
  uniform vec3 uCandleDir;
  uniform vec4 uCandleBeam;
  uniform vec3 uMoonBeam;
  uniform vec3 uMoonTo;
  uniform vec3 uMoonWin;
  uniform vec3 uMoonWinN;
  uniform vec3 uMoonWinU;
  uniform vec3 uMoonWinV;
  uniform vec2 uMoonWinHalf;
  uniform sampler2D uMoonShadow;
  uniform float uMoonShadowOn;
  uniform mat4 uMoonShadowMat;
  uniform vec3 uMoonOrigin;
  varying vec3 vCandleWorld;
  varying vec3 vCandleNormal;
  #ifdef CANDLE_BUMP
    uniform sampler2D uCandleBump;
    uniform vec2 uCandleBumpRepeat;
    uniform float uCandleBumpStrength;
    varying vec2 vCandleUv;
    varying vec3 vCandleTangent;
    varying vec3 vCandleBitangent;
  #endif
  ${packGlsl}
  ${handShadowGlsl}
  float candleShadowTap(vec3 dir, float dist) {
    float stored = candleUnpack(textureCube(uCandleShadow, dir)) * uCandleFar;
    return dist - (0.03 + 0.015 * dist) <= stored ? 1.0 : 0.0;
  }
  float moonShadowTap(vec2 uv, float along) {
    float stored = candleUnpack(texture2D(uMoonShadow, uv)) * uCandleFar;
    return along - 0.02 <= stored ? 1.0 : 0.0;
  }
  // The moon's beam through the window here: none unless the window's opening (less its cross bars) can see the moon from this
  // point, softer at the edges the further the light has come, and shadowed by the casters between here and the window.
  vec3 moonBeam(vec3 n, float nl) {
    if (uMoonBeam.b <= 0.0) return vec3(0.0);
    vec3 p = vCandleWorld;
    float inside = dot(p - uMoonWin, uMoonWinN);
    float toward = -dot(uMoonTo, uMoonWinN);
    if (inside <= 0.0 || toward <= 1e-4) return vec3(0.0);
    float back = inside / toward;
    vec3 hit = p + uMoonTo * back - uMoonWin;
    float u = abs(dot(hit, uMoonWinV));
    float v = abs(dot(hit, uMoonWinU));
    float soft = 0.006 + 0.025 * back;
    float open = smoothstep(-soft, soft, uMoonWinHalf.x - u) * smoothstep(-soft, soft, uMoonWinHalf.y - v);
    float bar = ${(WINDOW_BAR_M / 2).toFixed(4)};
    open *= smoothstep(bar - soft, bar + soft, u) * smoothstep(bar - soft, bar + soft, v);
    if (open <= 0.0) return vec3(0.0);
    float facing = nl > 1e-4 ? max(0.0, dot(n, uMoonTo)) : 1.0;
    if (facing <= 0.0) return vec3(0.0);
    float lit = 1.0;
    if (uMoonShadowOn > 0.5) {
      vec2 uv = (uMoonShadowMat * vec4(p, 1.0)).xy * 0.5 + 0.5;
      if (uv.x > 0.0 && uv.x < 1.0 && uv.y > 0.0 && uv.y < 1.0) {
        float along = -dot(p - uMoonOrigin, uMoonTo);
        float o = ${(1.5 / MOON_SHADOW_SIZE).toFixed(5)};
        lit = (moonShadowTap(uv, along) + moonShadowTap(uv + vec2(o, 0.0), along) + moonShadowTap(uv - vec2(o, 0.0), along) +
               moonShadowTap(uv + vec2(0.0, o), along) + moonShadowTap(uv - vec2(0.0, o), along)) / 5.0;
      }
    }
    return uMoonBeam * (open * facing * lit);
  }
  vec3 candleLight() {
    // Full bright (debug): a plain light from above, a little less on the sides and less again underneath, so shapes still read.
    if (uFullBright > 0.5) {
      float len = length(vCandleNormal);
      return vec3(0.8 + 0.2 * (len > 1e-4 ? vCandleNormal.y / len : 0.0));
    }
    // A mesh with no normals (the bunting's ribbons) is taken to face both lights.
    float nl = length(vCandleNormal);
    vec3 n = nl > 1e-4 ? vCandleNormal / nl : vec3(0.0);
    #ifdef CANDLE_BUMP
      vec2 b = texture2D(uCandleBump, vCandleUv * uCandleBumpRepeat).xy * 2.0 - 1.0;
      if (nl > 1e-4)
        n = normalize(n + (normalize(vCandleTangent) * b.x + normalize(vCandleBitangent) * b.y) * uCandleBumpStrength);
    #endif
    vec3 moon = uMoonLight + moonBeam(n, nl);
    if (uCandleIntensity <= 0.0) return moon;
    vec3 toFlame = uCandlePos - vCandleWorld;
    float d2 = max(dot(toFlame, toFlame), 1e-6);
    float dist = sqrt(d2);
    vec3 l = toFlame / dist;
    // How squarely the surface faces the flame (either side: the room's quads are two-sided), softened so nothing goes flat black.
    float facing = nl > 1e-4 ? 0.35 + 0.65 * abs(dot(n, l)) : 1.0;
    float reach = 1.0 / (1.0 + d2 / (uCandleReach * uCandleReach));
    // The beam: x, y the cosines of its inner and outer angles, z the light off to the side, w its brightness on the axis.
    float cone = smoothstep(uCandleBeam.y, uCandleBeam.x, dot(-l, uCandleDir));
    float beam = mix(uCandleBeam.z, uCandleBeam.w, cone);
    beam = mix(1.0, beam, smoothstep(${(BEAM_NEAR_M * 0.5).toFixed(3)}, ${BEAM_NEAR_M.toFixed(3)}, dist));
    float lit = 1.0;
    if (uCandleShadowOn > 0.5) {
      // Five taps round the direction, a little apart, so the shadows' edges are soft (wider the further they fall).
      vec3 dir = -l;
      vec3 t1 = normalize(cross(dir, abs(dir.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
      vec3 t2 = cross(dir, t1);
      float o = 0.012;
      lit = (candleShadowTap(dir, dist) + candleShadowTap(dir + t1 * o, dist) + candleShadowTap(dir - t1 * o, dist) +
             candleShadowTap(dir + t2 * o, dist) + candleShadowTap(dir - t2 * o, dist)) / 5.0;
    }
    // The hands' shadows, cast this frame (hand-shadow-map.ts).
    #ifdef CANDLE_HANDS
      lit *= handShadowLit(vCandleWorld);
    #endif
    // One model, two lights: the moon's (everywhere, and its beam through the window), and the candle's added where it reaches.
    return moon + uCandleColour * (uCandleIntensity * reach * facing * beam * lit);
  }
`;

export class CandleLight {
  /** The hands' shadows: cast by this light every frame, onto everything it lights (hand-shadow-map.ts). */
  readonly hands = new HandShadowMap();
  /** Shared by every patched material, so setting one value here sets it everywhere. */
  readonly uniforms = {
    uCandlePos: { value: new Vector3() },
    uCandleIntensity: { value: 0 },
    /** A debug switch: 1 lights everything evenly and lifts the dark tones (the room editor's "Full bright"). */
    uFullBright: { value: 0 },
    uCandleColour: { value: CANDLE_COLOUR.clone() },
    uCandleReach: { value: CANDLE_REACH_M },
    uMoonLight: { value: MOON_LIGHT.clone() },
    uCandleShadow: { value: null as Texture | null },
    uCandleShadowOn: { value: 0 },
    uCandleFar: { value: SHADOW_FAR },
    uCandleBumpStrength: { value: BUMP_STRENGTH },
    uCandleDir: { value: new Vector3(0, 0, -1) },
    uCandleBeam: {
      value: new Vector4(
        Math.cos((BEAM_INNER_DEG * Math.PI) / 180),
        Math.cos((BEAM_OUTER_DEG * Math.PI) / 180),
        BEAM_SIDE,
        BEAM_GAIN,
      ),
    },
    /** The moon's beam: its light now (black until there is a window), the way to the moon, and the window (world). */
    uMoonBeam: { value: new Color(0, 0, 0) },
    uMoonTo: { value: new Vector3(0, 1, 0) },
    uMoonWin: { value: new Vector3() },
    uMoonWinN: { value: new Vector3(1, 0, 0) },
    uMoonWinU: { value: new Vector3(0, 1, 0) },
    uMoonWinV: { value: new Vector3(0, 0, 1) },
    uMoonWinHalf: { value: new Vector2() },
    uMoonShadow: { value: null as Texture | null },
    uMoonShadowOn: { value: 0 },
    uMoonShadowMat: { value: new Matrix4() },
    uMoonOrigin: { value: new Vector3() },
  };
  /** The window the moon shines in at (setMoonWindow), how bright the moon is (setMoon) and the lightning (setMoonFlash). */
  private moonWindow: Object3D | null = null;
  private moonScale = 1;
  private moonLift = 1;
  private moonFlash = 0;
  /** The way to the moon in the window's own space (+x into the room, +y up, +z along the wall). */
  private readonly moonLocal = new Vector3();
  private readonly moonTarget: WebGLRenderTarget;
  private readonly moonCamera: OrthographicCamera;
  private moonDirty = true;
  /** Where the window was when the moon's shadows were last baked (its world matrix), to bake again when the room moves. */
  private readonly moonBaked = new Matrix4();
  private readonly moonAlong = { value: new Vector4(0, 0, 0, 0) };
  private readonly scratch = new Vector3();
  /** Where the beam is aimed (world, m), or null to aim it straight ahead (-z). */
  private readonly aim = new Vector3();
  private aimSet = false;
  private readonly target: WebGLCubeRenderTarget;
  private readonly camera: CubeCamera;
  private readonly casters: Mesh[] = [];
  private readonly casterMaterials: ShaderMaterial[] = [];
  private readonly saved: (Material | Material[])[] = [];
  private readonly flameUniform = { value: new Vector3() };
  private readonly baked = new Vector3(Infinity, Infinity, Infinity);
  private dirty = true;
  private readonly clear = new Color();

  constructor() {
    this.target = new WebGLCubeRenderTarget(SHADOW_SIZE, {
      generateMipmaps: false,
      minFilter: NearestFilter,
      magFilter: NearestFilter,
    });
    this.camera = new CubeCamera(SHADOW_NEAR, SHADOW_FAR, this.target);
    for (const c of this.camera.children) c.layers.set(CASTER_LAYER);
    this.uniforms.uCandleShadow.value = this.target.texture;
    this.moonTarget = new WebGLRenderTarget(MOON_SHADOW_SIZE, MOON_SHADOW_SIZE, {
      generateMipmaps: false,
      minFilter: NearestFilter,
      magFilter: NearestFilter,
    });
    const h = MOON_SHADOW_HALF;
    this.moonCamera = new OrthographicCamera(-h, h, h, -h, 0.01, SHADOW_FAR);
    this.moonCamera.layers.set(CASTER_LAYER);
    this.uniforms.uMoonShadow.value = this.moonTarget.texture;
    const e = (MOON_ELEVATION_DEG * Math.PI) / 180;
    const a = (MOON_AZIMUTH_DEG * Math.PI) / 180;
    // Out of the window (-x), up, and round towards the stage (-z), so the light comes down into the room and a little towards the player.
    this.moonLocal.set(-Math.cos(e) * Math.cos(a), Math.sin(e), -Math.cos(e) * Math.sin(a));
  }

  /**
   * The window the moon's beam comes in at: `window` sits in the middle of its opening, on the wall, its +x into the room, +y up
   * and +z along the wall (it may move with the room: the beam follows it); `width` and `height` are the opening's (m). Its cross
   * bars, one each way through the middle, cast their shadows with it.
   */
  setMoonWindow(window: Object3D, width: number, height: number): void {
    this.moonWindow = window;
    this.uniforms.uMoonWinHalf.value.set(width / 2, height / 2);
    this.moonDirty = true;
    this.updateMoonBeam();
  }

  /** Brightens (or dims) the moon's beam through the window alone, as a multiple of its night level (the story's scene 6). */
  setMoonBeamLift(lift: number): void {
    this.moonLift = lift > 0 ? lift : 0;
    this.updateMoonBeam();
  }

  /** How bright a lightning flash is now (0..1): the moon's beam through the window brightens with it. */
  setMoonFlash(flash: number): void {
    this.moonFlash = flash > 0 ? Math.min(1, flash) : 0;
    this.updateMoonBeam();
  }

  private updateMoonBeam(): void {
    const level = this.moonWindow ? this.moonScale * this.moonLift * (1 + MOON_FLASH * this.moonFlash) : 0;
    this.uniforms.uMoonBeam.value.copy(MOON_BEAM).multiplyScalar(level);
  }

  /** The moon's beam now (its colour times its brightness: for checks). */
  get moonBeam(): Readonly<Color> {
    return this.uniforms.uMoonBeam.value;
  }

  /** Puts the window's place and the way to the moon into the shaders (world), and marks the moon's shadows to bake if it moved. */
  private placeMoon(): void {
    const w = this.moonWindow;
    if (!w) return;
    w.updateWorldMatrix(true, false);
    const m = w.matrixWorld;
    if (!m.equals(this.moonBaked)) this.moonDirty = true;
    const u = this.uniforms;
    u.uMoonWin.value.setFromMatrixPosition(m);
    u.uMoonWinN.value.setFromMatrixColumn(m, 0).normalize();
    u.uMoonWinU.value.setFromMatrixColumn(m, 1).normalize();
    u.uMoonWinV.value.setFromMatrixColumn(m, 2).normalize();
    u.uMoonTo.value.copy(this.moonLocal).transformDirection(m);
  }

  /**
   * Makes `material` lit by the room's light: its colour (the surface's own, its albedo) is multiplied by the moon's light plus
   * the candle's. This is the room's only lighting: nothing else should tint the material for the light. `bump` (flat quads
   * only): a normal map whose lumps the light catches; how strongly is shared by all, `uniforms.uCandleBumpStrength`.
   * `hands` false: the hands' shadows do not fall on it (the gloves themselves: their shadow is not cast from the flame).
   */
  light(material: MeshBasicMaterial, bump?: CandleBump, hands = true): void {
    const u = this.uniforms;
    const own = bump
      ? { uCandleBump: { value: bump.map }, uCandleBumpRepeat: { value: new Vector2(bump.repeat[0], bump.repeat[1]) } }
      : {};
    const bumpVaryings = bump
      ? '\nvarying vec2 vCandleUv;\nvarying vec3 vCandleTangent;\nvarying vec3 vCandleBitangent;'
      : '';
    const bumpVertex = bump
      ? `
          vCandleUv = uv;
          vCandleTangent = mat3(modelMatrix) * vec3(1.0, 0.0, 0.0);
          vCandleBitangent = mat3(modelMatrix) * vec3(0.0, 1.0, 0.0);`
      : '';
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, u, this.hands.uniforms, own);
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>\nvarying vec3 vCandleWorld;\nvarying vec3 vCandleNormal;${bumpVaryings}`,
        )
        .replace(
          '#include <project_vertex>',
          `#include <project_vertex>
          vec4 candleP = vec4(transformed, 1.0);
          vec3 candleN = normal;
          #ifdef USE_INSTANCING
            candleP = instanceMatrix * candleP;
            candleN = mat3(instanceMatrix) * candleN;
          #endif
          vCandleWorld = (modelMatrix * candleP).xyz;
          vCandleNormal = mat3(modelMatrix) * candleN;${bumpVertex}`,
        );
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>\n${lightGlsl(!!bump, hands)}`)
        // Full bright (debug) also lifts the dark tones: the room's own colours are near black.
        .replace(
          '#include <opaque_fragment>',
          'outgoingLight *= candleLight();\nif (uFullBright > 0.5) outgoingLight = sqrt(outgoingLight);\n#include <opaque_fragment>',
        );
    };
    material.customProgramCacheKey = () => `candle-light-5${bump ? '-bump' : ''}${hands ? '-hands' : ''}`;
    material.needsUpdate = true;
  }

  /** Makes `mesh` cast the candle's shadow (it must stay still: the shadows are baked; call `rebake` if it moves). */
  cast(mesh: Mesh): void {
    mesh.layers.enable(CASTER_LAYER);
    const source = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as MeshBasicMaterial;
    const map = source.map ?? null;
    const material = new ShaderMaterial({
      uniforms: {
        uFlame: this.flameUniform,
        uFar: { value: SHADOW_FAR },
        uMap: { value: map },
        uHasMap: { value: map && source.transparent ? 1 : 0 },
        uAlong: this.moonAlong,
      },
      vertexShader: distanceVertex,
      fragmentShader: distanceFragment,
      side: DoubleSide,
    });
    this.casters.push(mesh);
    this.casterMaterials.push(material);
    this.dirty = true;
  }

  /** Aims the candle's beam at `target` (world, m): the middle of the wall the shadows play on. */
  aimAt(target: ArrayLike<number>): void {
    this.aim.set(target[0], target[1], target[2]);
    this.aimSet = true;
  }

  /** Marks the shadows to be baked again (the room or its props moved). */
  rebake(): void {
    this.dirty = true;
    this.moonDirty = true;
  }

  /**
   * The flame: how bright it is (0 out .. 1 full, flicker and covering included), where it is (world, m), and how far its light
   * reaches (m). Call once a frame.
   */
  set(intensity: number, flame: ArrayLike<number> | null, reach = CANDLE_REACH_M): void {
    const u = this.uniforms;
    u.uCandleIntensity.value = flame && intensity > 0 ? intensity : 0;
    u.uCandleReach.value = reach;
    if (!flame) return;
    u.uCandlePos.value.set(flame[0], flame[1], flame[2]);
    if (this.aimSet) {
      const dir = u.uCandleDir.value.subVectors(this.aim, u.uCandlePos.value);
      if (dir.lengthSq() > 1e-6) dir.normalize();
      else dir.set(0, 0, -1);
    }
    if (u.uCandlePos.value.distanceToSquared(this.baked) > REBAKE_MOVE * REBAKE_MOVE) this.dirty = true;
  }

  /**
   * Debug: lights every lit material evenly from above (no candle, moon or shadows) and lifts its dark tones, so the dark room
   * can be seen. Not how anything looks in the game.
   */
  get fullBright(): boolean {
    return this.uniforms.uFullBright.value > 0.5;
  }
  set fullBright(on: boolean) {
    this.uniforms.uFullBright.value = on ? 1 : 0;
  }

  /** Sets the colour of the candle's light (linear RGB; CANDLE_COLOUR is its own warm amber; the story's moods: candle-mood.ts). */
  setColour(r: number, g: number, b: number): void {
    this.uniforms.uCandleColour.value.setRGB(r, g, b);
  }

  /**
   * Sets the moon's light as a multiple of its night level (MOON_LIGHT): 1 is the night, more is a brighter moon. Its beam through
   * the window (MOON_BEAM) goes with it.
   */
  setMoon(scale: number): void {
    this.uniforms.uMoonLight.value.copy(MOON_LIGHT).multiplyScalar(scale);
    this.moonScale = scale;
    this.updateMoonBeam();
  }

  /**
   * Bakes the shadows if the flame or the room has moved since the last time: the candle's, and the moon's through the window.
   * Call once a frame, before the scene is drawn.
   */
  bakeIfDirty(renderer: WebGLRenderer, scene: Scene): void {
    this.placeMoon();
    const candle = this.dirty;
    const moon = this.moonDirty && this.moonWindow !== null;
    if ((!candle && !moon) || this.casters.length === 0) return;
    this.dirty = false;
    this.moonDirty = false;
    for (let i = 0; i < this.casters.length; i++) {
      this.saved[i] = this.casters[i].material;
      this.casters[i].material = this.casterMaterials[i];
    }
    const background = scene.background;
    const fog = scene.fog;
    const overrideMaterial = scene.overrideMaterial;
    scene.background = null;
    scene.fog = null;
    scene.overrideMaterial = null;
    renderer.getClearColor(this.clear);
    const alpha = renderer.getClearAlpha();
    renderer.setClearColor(0xffffff, 1); // nothing in this direction: as far as can be
    try {
      if (candle) {
        const flame = this.uniforms.uCandlePos.value;
        this.baked.copy(flame);
        this.flameUniform.value.copy(flame);
        this.moonAlong.value.w = 0;
        this.camera.position.copy(flame);
        this.camera.updateMatrixWorld(true);
        this.camera.update(renderer, scene);
        this.uniforms.uCandleShadowOn.value = 1;
      }
      if (moon) {
        this.bakeMoon(renderer, scene);
        this.uniforms.uMoonShadowOn.value = 1;
      }
    } finally {
      renderer.setClearColor(this.clear, alpha);
      scene.background = background;
      scene.fog = fog;
      scene.overrideMaterial = overrideMaterial;
      for (let i = 0; i < this.casters.length; i++) this.casters[i].material = this.saved[i];
    }
  }

  /**
   * Draws the moon's shadow map: the casters seen from just outside the window, looking along the beam, each as how far along
   * the beam it is. The casters already wear their distance materials.
   */
  private bakeMoon(renderer: WebGLRenderer, scene: Scene): void {
    const u = this.uniforms;
    const cam = this.moonCamera;
    this.moonBaked.copy(this.moonWindow!.matrixWorld);
    // From outside the window (the walls do not cast, so the camera sees through them), looking along the beam into the room.
    cam.position.copy(u.uMoonWin.value).addScaledVector(u.uMoonTo.value, 0.5);
    cam.lookAt(this.scratch.copy(u.uMoonWin.value));
    cam.updateMatrixWorld(true);
    u.uMoonOrigin.value.copy(cam.position);
    u.uMoonShadowMat.value.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    this.flameUniform.value.copy(cam.position);
    this.moonAlong.value.set(-u.uMoonTo.value.x, -u.uMoonTo.value.y, -u.uMoonTo.value.z, 1);
    const target = renderer.getRenderTarget();
    const xr = renderer.xr.enabled;
    renderer.xr.enabled = false;
    try {
      renderer.setRenderTarget(this.moonTarget);
      renderer.clear();
      renderer.render(scene, cam);
    } finally {
      renderer.setRenderTarget(target);
      renderer.xr.enabled = xr;
      this.moonAlong.value.w = 0;
    }
  }

  /** The baked shadow map (for checks and debugging). */
  get shadowMap(): WebGLCubeRenderTarget {
    return this.target;
  }

  dispose(): void {
    this.target.dispose();
    this.moonTarget.dispose();
    this.hands.dispose();
    for (const m of this.casterMaterials) m.dispose();
  }
}
