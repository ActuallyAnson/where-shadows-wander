// The candle as a real light for the bedroom: every room surface is lit by it per pixel (by how far it is from the flame and how
// squarely it faces it), and the room's static props cast shadows from it.
//
// The room's materials stay MeshBasicMaterial (its painted look is tuned unlit); `light(material)` patches one so its colour is
// multiplied by the candle's light. A real three.js light would light everything, the candle and tray inches from the flame too,
// and its shadow would be drawn again every frame. Here the shadows are baked: a small cube map of the distance from the flame to
// the nearest caster in every direction, rendered once, and again only when the flame moves. Every lit surface looks up whether
// a caster is nearer the flame than it is. Nothing is allocated per frame.
import {
  Color,
  CubeCamera,
  DoubleSide,
  Mesh,
  NearestFilter,
  ShaderMaterial,
  Vector3,
  WebGLCubeRenderTarget,
} from '@iwsdk/core';
import type { Material, MeshBasicMaterial, Scene, Texture, WebGLRenderer } from '@iwsdk/core';

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
export const MOON_LIGHT = new Color(0.06, 0.075, 0.13);
export const CANDLE_COLOUR = new Color(1.0, 0.82, 0.6);

const packGlsl = /* glsl */ `
  vec4 candlePack(float v) {
    vec4 enc = fract(vec4(1.0, 255.0, 65025.0, 16581375.0) * v);
    return enc - enc.yzww * vec4(1.0 / 255.0, 1.0 / 255.0, 1.0 / 255.0, 0.0);
  }
  float candleUnpack(vec4 c) {
    return dot(c, vec4(1.0, 1.0 / 255.0, 1.0 / 65025.0, 1.0 / 16581375.0));
  }
`;

/** Draws a caster into the shadow map: its distance from the flame, packed into the colour (cut out where its texture is clear). */
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
  varying vec3 vWorld;
  varying vec2 vUv;
  ${packGlsl}
  void main() {
    if (uHasMap > 0.5 && texture2D(uMap, vUv).a < 0.5) discard;
    gl_FragColor = candlePack(clamp(length(vWorld - uFlame) / uFar, 0.0, 0.999));
  }
`;

/** What a patched material adds to its fragment shader: the candle's light at this point, shadows included. */
const lightGlsl = /* glsl */ `
  uniform vec3 uCandlePos;
  uniform float uCandleIntensity;
  uniform vec3 uCandleColour;
  uniform float uCandleReach;
  uniform vec3 uMoonLight;
  uniform samplerCube uCandleShadow;
  uniform float uCandleShadowOn;
  uniform float uCandleFar;
  varying vec3 vCandleWorld;
  varying vec3 vCandleNormal;
  ${packGlsl}
  float candleShadowTap(vec3 dir, float dist) {
    float stored = candleUnpack(textureCube(uCandleShadow, dir)) * uCandleFar;
    return dist - (0.03 + 0.015 * dist) <= stored ? 1.0 : 0.0;
  }
  vec3 candleLight() {
    if (uCandleIntensity <= 0.0) return uMoonLight;
    vec3 toFlame = uCandlePos - vCandleWorld;
    float d2 = max(dot(toFlame, toFlame), 1e-6);
    float dist = sqrt(d2);
    vec3 l = toFlame / dist;
    // How squarely the surface faces the flame (either side: the room's quads are two-sided), softened so nothing goes flat black.
    // A mesh with no normals (the bunting's ribbons) is taken to face it.
    float nl = length(vCandleNormal);
    float facing = nl > 1e-4 ? 0.35 + 0.65 * abs(dot(vCandleNormal / nl, l)) : 1.0;
    float reach = 1.0 / (1.0 + d2 / (uCandleReach * uCandleReach));
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
    // One model, two lights: the moon's everywhere, and the candle's added where it reaches.
    return uMoonLight + uCandleColour * (uCandleIntensity * reach * facing * lit);
  }
`;

export class CandleLight {
  /** Shared by every patched material, so setting one value here sets it everywhere. */
  readonly uniforms = {
    uCandlePos: { value: new Vector3() },
    uCandleIntensity: { value: 0 },
    uCandleColour: { value: CANDLE_COLOUR.clone() },
    uCandleReach: { value: CANDLE_REACH_M },
    uMoonLight: { value: MOON_LIGHT.clone() },
    uCandleShadow: { value: null as Texture | null },
    uCandleShadowOn: { value: 0 },
    uCandleFar: { value: SHADOW_FAR },
  };
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
  }

  /**
   * Makes `material` lit by the room's light: its colour (the surface's own, its albedo) is multiplied by the moon's light plus
   * the candle's. This is the room's only lighting: nothing else should tint the material for the light.
   */
  light(material: MeshBasicMaterial): void {
    const u = this.uniforms;
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, u);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vCandleWorld;\nvarying vec3 vCandleNormal;')
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
          vCandleNormal = mat3(modelMatrix) * candleN;`,
        );
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>\n${lightGlsl}`)
        .replace('#include <opaque_fragment>', 'outgoingLight *= candleLight();\n#include <opaque_fragment>');
    };
    material.customProgramCacheKey = () => 'candle-light-2';
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
      },
      vertexShader: distanceVertex,
      fragmentShader: distanceFragment,
      side: DoubleSide,
    });
    this.casters.push(mesh);
    this.casterMaterials.push(material);
    this.dirty = true;
  }

  /** Marks the shadows to be baked again (the room or its props moved). */
  rebake(): void {
    this.dirty = true;
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
    if (u.uCandlePos.value.distanceToSquared(this.baked) > REBAKE_MOVE * REBAKE_MOVE) this.dirty = true;
  }

  /** Bakes the shadows if the flame or the room has moved since the last time. Call once a frame, before the scene is drawn. */
  bakeIfDirty(renderer: WebGLRenderer, scene: Scene): void {
    if (!this.dirty || this.casters.length === 0) return;
    this.dirty = false;
    const flame = this.uniforms.uCandlePos.value;
    this.baked.copy(flame);
    this.flameUniform.value.copy(flame);
    this.camera.position.copy(flame);
    this.camera.updateMatrixWorld(true);
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
      this.camera.update(renderer, scene);
    } finally {
      renderer.setClearColor(this.clear, alpha);
      scene.background = background;
      scene.fog = fog;
      scene.overrideMaterial = overrideMaterial;
      for (let i = 0; i < this.casters.length; i++) this.casters[i].material = this.saved[i];
    }
    this.uniforms.uCandleShadowOn.value = 1;
  }

  /** The baked shadow map (for checks and debugging). */
  get shadowMap(): WebGLCubeRenderTarget {
    return this.target;
  }

  dispose(): void {
    this.target.dispose();
    for (const m of this.casterMaterials) m.dispose();
  }
}
