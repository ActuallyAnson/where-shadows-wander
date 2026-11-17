// The hands' shadows, cast by a light. Each frame the hands (whatever glove is drawn: the same meshes the player sees) are drawn
// from the light into a shadow map: the distance from the light to the nearest bit of hand, in each direction toward the wall.
// Every candle-lit surface (candle-light.ts) and the stage's paper (test-stage-view.ts) looks up whether a hand is nearer the
// light than it is, and the candle's light is taken away there. So the shadow has the hand's true outline, is as big as the light
// makes it, and as soft: its edge widens with how far the surface is behind the hand (the light has a size), sharp near the hand.
// Where the light is cast from (behind the flame, so the shadows reach the wall) is real-wall.ts's castPoint.
//
// The map's camera sits on the light and looks square at the wall, its frustum cut to the wall's lit area, so the map's pixels
// are spread evenly over the wall. How dark the shadow is (`strength`, 0 none .. 1 all the candle's light) is the game's to set:
// the hand's shadow goes faint while a memory plays. Nothing is allocated per frame.
import {
  Color,
  DoubleSide,
  Matrix4,
  NearestFilter,
  PerspectiveCamera,
  ShaderMaterial,
  Vector2,
  Vector3,
  WebGLRenderTarget,
} from '@iwsdk/core';
import type { Object3D, Scene, Texture, WebGLRenderer } from '@iwsdk/core';
import type { StagePlane } from './pure/stage-plane';

/** The layer only the hands are on (as well as their own), so the shadow pass draws nothing else. CASTER_LAYER is 7. */
export const HAND_CASTER_LAYER = 8;
/** How dark the hand's shadow is at full strength: the share of the candle's light it takes (high contrast uses 1). */
export const DEFAULT_SHADOW_OPACITY = 0.88;
/** The map's size (square), and its range from the light (m). */
const MAP_SIZE = 1024;
const MAP_NEAR = 0.02;
const MAP_FAR = 6;
/** How much further than the wall's lit area the map reaches on each side (m): the shadow can fall a little past it. */
const MAP_MARGIN_M = 0.15;
/**
 * The light's size for the shadow's softness (m): the edge's width is this times (surface's distance - hand's) / hand's, about
 * 1.2 cm on the wall for a resting hand. Tune in the headset.
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
  uniform sampler2D uHandMap;
  uniform mat4 uHandMatrix;     // world to the map's clip space
  uniform vec3 uHandLight;
  uniform float uHandStrength;  // 0: no shadow (and nothing is looked up)
  uniform float uHandSoft;      // the light's size, m (the sharpen effect shrinks it)
  uniform vec2 uHandScale;      // the map's uv per radian seen from the light, across and up
  ${packGlsl}
  float handDist(vec2 uv) {
    return handUnpack(texture2D(uHandMap, uv)) * ${MAP_FAR.toFixed(1)};
  }
  float handShadowLit(vec3 world) {
    if (uHandStrength <= 0.0) return 1.0;
    vec4 c = uHandMatrix * vec4(world, 1.0);
    if (c.w <= 0.0) return 1.0;
    vec2 uv = c.xy / c.w * 0.5 + 0.5;
    if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return 1.0;
    float d = length(world - uHandLight);
    float bias = 0.006 + 0.004 * d;
    // Look for hands nearer the light round here, as wide as the softest edge could be (a hand as near the light as one comes).
    vec2 search = uHandScale * (uHandSoft * 0.5 / ${NEAREST_HAND_M.toFixed(2)} + 1.5 / ${MAP_SIZE.toFixed(1)});
    float blockers = 0.0;
    float sum = 0.0;
    for (int i = 0; i < 9; i++) {
      float a = float(i) * 2.399963;
      float r = i == 0 ? 0.0 : sqrt(float(i) / 8.0);
      float s = handDist(uv + vec2(cos(a), sin(a)) * r * search);
      if (s < d - bias) { blockers += 1.0; sum += s; }
    }
    if (blockers < 0.5) return 1.0;
    // Half the edge's width (seen from the light, in radians) from how far behind the hands this point is.
    float db = sum / blockers;
    vec2 radius = uHandScale * max(0.5 * uHandSoft * (d - db) / (db * d), 0.0) + vec2(1.5 / ${MAP_SIZE.toFixed(1)});
    float lit = 0.0;
    for (int i = 0; i < 16; i++) {
      float a = float(i) * 2.399963 + 0.7;
      float r = sqrt((float(i) + 0.5) / 16.0);
      lit += handDist(uv + vec2(cos(a), sin(a)) * r * radius) < d - bias ? 0.0 : 1.0;
    }
    return 1.0 - uHandStrength * (1.0 - lit / 16.0);
  }
`;

/** The receivers' uniforms with no shadow map: for a material that takes the hands' shadows when there are none. */
export function handShadowOff(): HandShadowMap['uniforms'] {
  return {
    uHandMap: { value: null },
    uHandMatrix: { value: new Matrix4() },
    uHandLight: { value: new Vector3() },
    uHandStrength: { value: 0 },
    uHandSoft: { value: LIGHT_SIZE_M },
    uHandScale: { value: new Vector2(1, 1) },
  };
}

export class HandShadowMap {
  /** For every receiver's material (shared: setting a value here sets it everywhere). */
  readonly uniforms = {
    uHandMap: { value: null as Texture | null },
    uHandMatrix: { value: new Matrix4() },
    uHandLight: { value: new Vector3() },
    uHandStrength: { value: 0 },
    uHandSoft: { value: LIGHT_SIZE_M },
    uHandScale: { value: new Vector2(1, 1) },
  };
  private readonly target: WebGLRenderTarget;
  private readonly camera = new PerspectiveCamera();
  private readonly material: ShaderMaterial;
  private readonly lightUniform = { value: new Vector3() };
  private stage: StagePlane | null = null;
  /** The wall's lit area: [width, height, centre x, centre y], metres from the stage's centre (lightArea). */
  private readonly area = new Float64Array(4);
  private casters: Object3D | null = null;
  private readonly clear = new Color();
  private readonly look = new Matrix4();

  constructor() {
    this.target = new WebGLRenderTarget(MAP_SIZE, MAP_SIZE, {
      generateMipmaps: false,
      minFilter: NearestFilter,
      magFilter: NearestFilter,
      depthBuffer: true,
    });
    this.uniforms.uHandMap.value = this.target.texture;
    this.camera.layers.set(HAND_CASTER_LAYER);
    this.camera.matrixAutoUpdate = false;
    this.material = new ShaderMaterial({
      uniforms: { uLight: this.lightUniform },
      vertexShader: casterVertex,
      fragmentShader: casterFragment,
      side: DoubleSide,
    });
  }

  /** The wall the shadows fall on, and its lit area ([width, height, centre x, centre y], stage metres). Call when either moves. */
  place(stage: StagePlane, area: Readonly<ArrayLike<number>>): void {
    this.stage = stage;
    for (let i = 0; i < 4; i++) this.area[i] = area[i];
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
   * (`strength`, 0..1) and how soft (`softness`, 1 the light's own size, less for a sharpened shadow). With no light, no stage,
   * or strength 0, there is no shadow and nothing is drawn. Call once a frame, after the hands are posed and before the scene
   * is drawn.
   */
  update(
    renderer: WebGLRenderer,
    scene: Scene,
    from: Readonly<ArrayLike<number>> | null,
    strength: number,
    softness = 1,
  ): void {
    const u = this.uniforms;
    const st = this.stage;
    const root = this.casters;
    u.uHandStrength.value = 0;
    if (!from || !st || !root || !(strength > 0.001)) return;
    // The light's place relative to the wall: across, up, and out in front of it.
    const fx = from[0] - st.origin[0],
      fy = from[1] - st.origin[1],
      fz = from[2] - st.origin[2];
    const lx = fx * st.right[0] + fy * st.right[1] + fz * st.right[2];
    const ly = fx * st.up[0] + fy * st.up[1] + fz * st.up[2];
    const dist = fx * st.normal[0] + fy * st.normal[1] + fz * st.normal[2];
    if (dist < 0.1) return; // the light at (or behind) the wall: nothing between them to cast

    // The camera on the light, looking square at the wall (along -normal, up the stage's up), its frustum cut to the lit area.
    const r = st.right,
      up = st.up,
      n = st.normal;
    // prettier-ignore
    this.look.set(
      r[0], up[0], n[0], from[0],
      r[1], up[1], n[1], from[1],
      r[2], up[2], n[2], from[2],
      0, 0, 0, 1,
    );
    const cam = this.camera;
    cam.matrixWorld.copy(this.look);
    cam.matrixWorldInverse.copy(this.look).invert();
    const a = this.area;
    const left = (a[2] - a[0] / 2 - MAP_MARGIN_M - lx) / dist,
      right = (a[2] + a[0] / 2 + MAP_MARGIN_M - lx) / dist,
      bottom = (a[3] - a[1] / 2 - MAP_MARGIN_M - ly) / dist,
      top = (a[3] + a[1] / 2 + MAP_MARGIN_M - ly) / dist;
    cam.projectionMatrix.makePerspective(
      left * MAP_NEAR,
      right * MAP_NEAR,
      top * MAP_NEAR,
      bottom * MAP_NEAR,
      MAP_NEAR,
      MAP_FAR,
    );
    cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
    u.uHandMatrix.value.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    u.uHandScale.value.set(1 / (right - left), 1 / (top - bottom));
    u.uHandLight.value.set(from[0], from[1], from[2]);
    this.lightUniform.value.set(from[0], from[1], from[2]);

    // The hands are drawn into the map whether or not the player sees them (over passthrough, or faded near the eyes).
    const visible = root.visible;
    root.visible = true;
    const override = scene.overrideMaterial;
    const background = scene.background;
    const fog = scene.fog;
    const xr = renderer.xr.enabled;
    const previous = renderer.getRenderTarget();
    renderer.getClearColor(this.clear);
    const alpha = renderer.getClearAlpha();
    scene.overrideMaterial = this.material;
    scene.background = null;
    scene.fog = null;
    renderer.xr.enabled = false; // or the headset's cameras would be used instead of this one
    try {
      renderer.setRenderTarget(this.target);
      renderer.setClearColor(0xffffff, 1); // no hand in this direction: as far as can be
      renderer.clear(true, true, false);
      renderer.render(scene, cam);
    } finally {
      renderer.setRenderTarget(previous);
      renderer.setClearColor(this.clear, alpha);
      renderer.xr.enabled = xr;
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
