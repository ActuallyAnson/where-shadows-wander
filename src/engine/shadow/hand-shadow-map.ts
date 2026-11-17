// The hands' shadows, cast by a light. Each frame the hands (whatever glove is drawn: the same meshes the player sees) are drawn
// from the light into a cube shadow map: the distance from the light to the nearest bit of hand, in every direction. Every
// candle-lit surface (candle-light.ts: the walls, floor, ceiling, bed and tray) and the stage's paper (test-stage-view.ts) looks
// up whether a hand is nearer the light than it is, and the candle's light is taken away there. So the shadow has the hand's true
// outline, falls wherever the light throws it (any wall), is as big as the light makes it, and as soft: its edge widens with how
// far the surface is behind the hand (the light has a size), sharp near the hand. Where the light is cast from (behind the
// flame, so the shadows reach the front wall) is real-wall.ts's castPoint.
//
// The shadow takes away the candle's light, so it is as strong as that light is where it falls: full on the front wall the candle
// is aimed at, fainter on the side walls. How dark it is at most (`strength`, 0 none .. 1 all the candle's light) is the game's
// to set: the hand's shadow goes faint while a memory plays. Nothing is allocated per frame.
import {
  Color,
  CubeCamera,
  DoubleSide,
  NearestFilter,
  ShaderMaterial,
  Vector3,
  WebGLCubeRenderTarget,
} from '@iwsdk/core';
import type { Object3D, Scene, Texture, WebGLRenderer } from '@iwsdk/core';

/** The layer only the hands are on (as well as their own), so the shadow pass draws nothing else. CASTER_LAYER is 7. */
export const HAND_CASTER_LAYER = 8;
/** How dark the hand's shadow is at full strength: the share of the candle's light it takes (high contrast uses 1). */
export const DEFAULT_SHADOW_OPACITY = 0.88;
/** Each cube face's size, and the map's range from the light (m). About 3 mm a texel on a wall 1 m from the light. */
const MAP_SIZE = 512;
const MAP_NEAR = 0.02;
const MAP_FAR = 8;
/** One texel's angle seen from the light, near a face's middle (radians). */
const TEXEL_RAD = 2 / MAP_SIZE;
/**
 * The light's size for the shadow's softness (m): the edge's width is this times (surface's distance - hand's) / hand's, about
 * 1.2 cm on the front wall for a resting hand. Tune in the headset.
 */
export const LIGHT_SIZE_M = 0.01;
/** The nearest a hand comes to the light (m): how wide the shadow's edge can be, and so how far round a point to look for hands. */
const NEAREST_HAND_M = 0.5;

const packGlsl = /* glsl */ `
  vec4 handPack(float v) {
    vec4 enc = fract(vec4(1.0, 255.0, 65025.0, 16581375.0) * v);
    return enc - enc.yzww * vec4(1.0 / 255.0, 1.0 / 255.0, 1.0 / 255.0, 0.0);
  }
  float handUnpack(vec4 c) {
    return dot(c, vec4(1.0, 1.0 / 255.0, 1.0 / 65025.0, 1.0 / 16581375.0));
  }
`;

/** Draws a hand into the map: its distance from the light. Skinned (the glove) and instanced (the capsule gloves) both work. */
const casterVertex = /* glsl */ `
  #include <common>
  #include <skinning_pars_vertex>
  varying vec3 vWorld;
  void main() {
    #include <skinbase_vertex>
    #include <begin_vertex>
    #include <skinning_vertex>
    vec4 p = vec4(transformed, 1.0);
    #ifdef USE_INSTANCING
      p = instanceMatrix * p;
    #endif
    vec4 w = modelMatrix * p;
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;
const casterFragment = /* glsl */ `
  uniform vec3 uLight;
  varying vec3 vWorld;
  ${packGlsl}
  void main() {
    gl_FragColor = handPack(clamp(length(vWorld - uLight) / ${MAP_FAR.toFixed(1)}, 0.0, 0.999));
  }
`;

/**
 * GLSL for a receiver: `handShadowLit(world)` is how much of the candle's light reaches `world` past the hands (1 all of it, 1 -
 * strength in a full shadow). Needs `uniforms` (below) on its material.
 */
export const handShadowGlsl = /* glsl */ `
  uniform samplerCube uHandMap;
  uniform vec3 uHandLight;
  uniform float uHandStrength;  // 0: no shadow (and nothing is looked up)
  uniform float uHandSoft;      // the light's size, m (the sharpen effect shrinks it)
  ${packGlsl}
  float handDist(vec3 dir) {
    return handUnpack(textureCube(uHandMap, dir)) * ${MAP_FAR.toFixed(1)};
  }
  float handShadowLit(vec3 world) {
    if (uHandStrength <= 0.0) return 1.0;
    vec3 toP = world - uHandLight;
    float d = length(toP);
    if (d < 1e-4) return 1.0;
    vec3 dir = toP / d;
    // Two directions across the ray, for looking round it (offsets in radians, small enough to add to the unit ray).
    vec3 t1 = normalize(cross(dir, abs(dir.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
    vec3 t2 = cross(dir, t1);
    float bias = 0.006 + 0.004 * d;
    // Look for hands nearer the light round here, as wide as the softest edge could be (a hand as near the light as one comes).
    float search = uHandSoft * 0.5 / ${NEAREST_HAND_M.toFixed(2)} + ${(1.5 * TEXEL_RAD).toFixed(5)};
    float blockers = 0.0;
    float sum = 0.0;
    for (int i = 0; i < 9; i++) {
      float a = float(i) * 2.399963;
      float r = i == 0 ? 0.0 : sqrt(float(i) / 8.0) * search;
      float s = handDist(dir + (t1 * cos(a) + t2 * sin(a)) * r);
      if (s < d - bias) { blockers += 1.0; sum += s; }
    }
    if (blockers < 0.5) return 1.0;
    // Half the edge's width (seen from the light, in radians) from how far behind the hands this point is.
    float db = sum / blockers;
    float radius = max(0.5 * uHandSoft * (d - db) / (db * d), 0.0) + ${(1.5 * TEXEL_RAD).toFixed(5)};
    float lit = 0.0;
    for (int i = 0; i < 16; i++) {
      float a = float(i) * 2.399963 + 0.7;
      float r = sqrt((float(i) + 0.5) / 16.0) * radius;
      lit += handDist(dir + (t1 * cos(a) + t2 * sin(a)) * r) < d - bias ? 0.0 : 1.0;
    }
    return 1.0 - uHandStrength * (1.0 - lit / 16.0);
  }
`;

/** The receivers' uniforms with no shadow map: for a material that takes the hands' shadows when there are none. */
export function handShadowOff(): HandShadowMap['uniforms'] {
  return {
    uHandMap: { value: null },
    uHandLight: { value: new Vector3() },
    uHandStrength: { value: 0 },
    uHandSoft: { value: LIGHT_SIZE_M },
  };
}

export class HandShadowMap {
  /** For every receiver's material (shared: setting a value here sets it everywhere). */
  readonly uniforms = {
    uHandMap: { value: null as Texture | null },
    uHandLight: { value: new Vector3() },
    uHandStrength: { value: 0 },
    uHandSoft: { value: LIGHT_SIZE_M },
  };
  private readonly target: WebGLCubeRenderTarget;
  private readonly camera: CubeCamera;
  private readonly material: ShaderMaterial;
  private readonly lightUniform = { value: new Vector3() };
  private casters: Object3D | null = null;
  private readonly clear = new Color();

  constructor() {
    this.target = new WebGLCubeRenderTarget(MAP_SIZE, {
      generateMipmaps: false,
      minFilter: NearestFilter,
      magFilter: NearestFilter,
    });
    this.uniforms.uHandMap.value = this.target.texture;
    this.camera = new CubeCamera(MAP_NEAR, MAP_FAR, this.target);
    for (const c of this.camera.children) c.layers.set(HAND_CASTER_LAYER);
    this.material = new ShaderMaterial({
      uniforms: { uLight: this.lightUniform },
      vertexShader: casterVertex,
      fragmentShader: casterFragment,
      side: DoubleSide,
    });
  }

  /**
   * What casts: every mesh under `root` (the hand visual's object; call again when the glove changes). Its meshes are put on the
   * caster layer once, here.
   */
  setCasters(root: Object3D): void {
    this.casters = root;
    root.traverse((o) => o.layers.enable(HAND_CASTER_LAYER));
  }

  /**
   * Draws the hands' shadow map from the light at `from` (world, m: real-wall.ts's castPoint), and sets how dark the shadow is
   * (`strength`, 0..1) and how soft (`softness`, 1 the light's own size, less for a sharpened shadow). With no light or strength
   * 0 there is no shadow and nothing is drawn. Call once a frame, after the hands are posed and before the scene is drawn.
   */
  update(
    renderer: WebGLRenderer,
    scene: Scene,
    from: Readonly<ArrayLike<number>> | null,
    strength: number,
    softness = 1,
  ): void {
    const u = this.uniforms;
    const root = this.casters;
    u.uHandStrength.value = 0;
    if (!from || !root || !(strength > 0.001)) return;
    u.uHandLight.value.set(from[0], from[1], from[2]);
    this.lightUniform.value.set(from[0], from[1], from[2]);
    this.camera.position.set(from[0], from[1], from[2]);
    this.camera.updateMatrixWorld(true);

    // The hands are drawn into the map whether or not the player sees them (over passthrough, or faded near the eyes).
    // CubeCamera.update draws the six faces with XR off and puts the render target back.
    const visible = root.visible;
    root.visible = true;
    const override = scene.overrideMaterial;
    const background = scene.background;
    const fog = scene.fog;
    renderer.getClearColor(this.clear);
    const alpha = renderer.getClearAlpha();
    scene.overrideMaterial = this.material;
    scene.background = null;
    scene.fog = null;
    renderer.setClearColor(0xffffff, 1); // no hand in this direction: as far as can be
    try {
      this.camera.update(renderer, scene);
    } finally {
      renderer.setClearColor(this.clear, alpha);
      scene.overrideMaterial = override;
      scene.background = background;
      scene.fog = fog;
      root.visible = visible;
    }
    u.uHandStrength.value = strength > 1 ? 1 : strength;
    u.uHandSoft.value = LIGHT_SIZE_M * (softness > 0 ? softness : 0);
  }

  /** The current shadow strength (0: none drawn this frame). */
  get strength(): number {
    return this.uniforms.uHandStrength.value;
  }

  dispose(): void {
    this.target.dispose();
    this.material.dispose();
  }
}
