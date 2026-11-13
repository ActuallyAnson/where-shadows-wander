// Draws a puppet scene's parts on the stage, posed by a ScenePlayer: each part is a quad with its cut-out (puppet-art.ts, or an
// image) lying on the wall. Shadow parts darken the lit wall the way the hands' shadows do, but where two parts overlap (a leg
// over the cloak) they never darken twice: they blend by taking the darker of the wall and the shadow (a min blend), as one
// shadow would. A part's depth (PuppetPart.depth) makes its shadow paler and softer, so the scenery stands back from the near
// puppets; a pale shadow can't be a min blend (the candle-lit wall is darker than its floor, so it would vanish), so a part
// standing back darkens the wall in proportion instead, over black as the hands' shadows do (overlaps there do darken twice,
// which reads as one layer in front of another). Glow parts add their light. Everything can be cut off at the wall's edges
// (clipToWall), as a shadow theatre's screen cuts off a piece of scenery sliding into the wings. Built when a scene loads; a frame
// only sets matrices, a few uniforms and one opacity each.
import {
  AddEquation,
  AdditiveBlending,
  CanvasTexture,
  CustomBlending,
  DoubleSide,
  Group,
  MaxEquation,
  Mesh,
  MinEquation,
  OneFactor,
  OneMinusSrcAlphaFactor,
  PlaneGeometry,
  ShaderMaterial,
  SRGBColorSpace,
  Vector2,
  Vector3,
  ZeroFactor,
  type Material,
} from '@iwsdk/core';
import { depthBlur, depthStrength, partDepths, POSE_STRIDE, type PuppetScene } from '../stage/puppet/puppet-scene';
import type { ScenePlayer } from '../stage/puppet/scene-player';
import { isImageArt, PUPPET_ART } from './puppet-art';
import { RenderOrder } from './pure/render-order';
import type { StagePlane } from './pure/stage-plane';

/** Pixels painted per metre of cut-out as drawn on the wall (scene metres times `scale`), within these bounds. */
const PX_PER_M = 1100;
const PX_MIN = 32;
const PX_MAX = 2048;
/** Lifted off the wall toward the player, metres, and a little more for each later part so they keep their order. */
const LIFT_M = 0.003;
const LIFT_STEP_M = 0.0002;

// vWall: where the fragment is on the wall, metres from the story's centre (the quad's centre plus its two axes), for the clip.
const VERTEX = /* glsl */ `
uniform vec2 centre;
uniform vec2 axisA;
uniform vec2 axisB;
varying vec2 vUv;
varying vec2 vWall;
void main() {
  vUv = uv;
  vWall = centre + position.x * axisA + position.y * axisB;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

/** Discards what lies past the wall's edges. */
const CLIP = /* glsl */ `
uniform vec2 clip;
varying vec2 vWall;`;
const CLIP_TEST = /* glsl */ `if (abs(vWall.x) > clip.x || abs(vWall.y) > clip.y) discard;`;

// The shadow as a brightness the wall is clamped down to (min blend): 1 - alpha, so an opacity of 0.88 leaves 12 % of the light.
const SHADOW_FRAGMENT = /* glsl */ `
uniform sampler2D map;
uniform float opacity;
varying vec2 vUv;
${CLIP}
void main() {
  ${CLIP_TEST}
  float a = texture2D(map, vUv).a * opacity;
  if (a < 0.003) discard;
  gl_FragColor = vec4(vec3(1.0 - a), 1.0);
}`;

// A shadow standing back: black over the wall at its alpha, so it takes the same share of the light however dim the wall is.
const FAR_SHADOW_FRAGMENT = /* glsl */ `
uniform sampler2D map;
uniform float opacity;
varying vec2 vUv;
${CLIP}
void main() {
  ${CLIP_TEST}
  float a = texture2D(map, vUv).a * opacity;
  if (a < 0.003) discard;
  gl_FragColor = vec4(0.0, 0.0, 0.0, a);
}`;

// A glow: its tint added onto the wall at its alpha (additive), as the torch's light is.
const GLOW_FRAGMENT = /* glsl */ `
uniform sampler2D map;
uniform float opacity;
uniform vec3 tint;
varying vec2 vUv;
${CLIP}
void main() {
  ${CLIP_TEST}
  float a = texture2D(map, vUv).a * opacity;
  if (a < 0.003) discard;
  gl_FragColor = vec4(tint, a);
  #include <colorspace_fragment>
}`;

interface Piece {
  readonly mesh: Mesh;
  readonly part: number;
  readonly w: number;
  readonly h: number;
  readonly px: number;
  readonly py: number;
  readonly mirror: number;
  readonly glow: boolean;
  /** Its opacity is multiplied by this: 1 against the wall, less the further back it stands. */
  readonly strength: number;
  readonly material: ShaderMaterial;
  readonly texture: CanvasTexture;
  readonly centre: Vector2;
  readonly axisA: Vector2;
  readonly axisB: Vector2;
}

/** How far the wall reaches from the story's centre when nothing has been set: everywhere. */
const NO_CLIP = 1e6;

export class PuppetView {
  readonly group = new Group();
  private pieces: Piece[] = [];
  private scene: PuppetScene | null = null;
  private static readonly quad = new PlaneGeometry(1, 1);
  /** How many wall metres one scene metre is: scenes are written for the 1.6 by 1 m stage and drawn bigger (STORY_SCALE). */
  scale = 1;
  /** Half the wall's width and height, metres from the story's centre: nothing is drawn past them. Shared by every piece. */
  private readonly clip = new Vector2(NO_CLIP, NO_CLIP);

  /** Cuts the puppets off at the wall's edges: `halfWidth` and `halfHeight` metres from the story's centre. */
  clipToWall(halfWidth: number, halfHeight: number): void {
    this.clip.set(halfWidth, halfHeight);
  }

  constructor() {
    this.group.visible = false;
  }

  /** Builds the parts of `scene` (and drops a scene built before). */
  load(scene: PuppetScene): void {
    if (this.scene === scene) return;
    this.unload();
    this.scene = scene;
    const depths = partDepths(scene);
    scene.parts.forEach((part, i) => {
      if (!part.art) return;
      const glow = part.look === 'glow';
      const depth = glow ? 0 : depths[i];
      const canvas = document.createElement('canvas');
      canvas.width = Math.min(PX_MAX, Math.max(PX_MIN, Math.round(part.w * PX_PER_M * this.scale)));
      canvas.height = Math.min(PX_MAX, Math.max(PX_MIN, Math.round(part.h * PX_PER_M * this.scale)));
      const texture = new CanvasTexture(canvas);
      texture.colorSpace = SRGBColorSpace;
      const g = canvas.getContext('2d');
      // A far part's shadow is soft: its cut-out is blurred once, here, by its depth's blur in this canvas's pixels.
      const blurPx = (depthBlur(depth) * canvas.width) / part.w;
      if (isImageArt(part.art)) {
        const img = new Image();
        img.onload = () => {
          if (!g) return;
          g.clearRect(0, 0, canvas.width, canvas.height);
          drawSoft(g, img, canvas.width, canvas.height, blurPx);
          texture.needsUpdate = true;
        };
        img.onerror = () => console.warn(`puppet ${part.id}: could not load ${part.art}`);
        img.src = part.art;
      } else {
        const paint = PUPPET_ART[part.art];
        if (!paint) console.warn(`puppet ${part.id}: no art called ${part.art}`);
        else if (g && blurPx < 0.5) paint(g, canvas.width, canvas.height);
        else if (g) {
          const sharp = document.createElement('canvas');
          sharp.width = canvas.width;
          sharp.height = canvas.height;
          const sg = sharp.getContext('2d');
          if (sg) paint(sg, sharp.width, sharp.height);
          drawSoft(g, sharp, canvas.width, canvas.height, blurPx);
        }
      }
      const centre = new Vector2(),
        axisA = new Vector2(),
        axisB = new Vector2();
      const uniforms = {
        map: { value: texture },
        opacity: { value: 0 },
        centre: { value: centre },
        axisA: { value: axisA },
        axisB: { value: axisB },
        clip: { value: this.clip },
      };
      let material: ShaderMaterial;
      if (glow) {
        const tint = part.tint ?? [1, 1, 1];
        material = new ShaderMaterial({
          uniforms: { ...uniforms, tint: { value: new Vector3(tint[0], tint[1], tint[2]) } },
          vertexShader: VERTEX,
          fragmentShader: GLOW_FRAGMENT,
          transparent: true,
          blending: AdditiveBlending,
          depthWrite: false,
          side: DoubleSide,
          toneMapped: false,
        });
      } else if (depth > 0) {
        material = new ShaderMaterial({
          uniforms,
          vertexShader: VERTEX,
          fragmentShader: FAR_SHADOW_FRAGMENT,
          transparent: true,
          blending: CustomBlending,
          blendEquation: AddEquation,
          blendSrc: ZeroFactor,
          blendDst: OneMinusSrcAlphaFactor,
          blendSrcAlpha: OneFactor,
          blendDstAlpha: OneMinusSrcAlphaFactor,
          depthWrite: false,
          side: DoubleSide,
          toneMapped: false,
        });
      } else {
        material = new ShaderMaterial({
          uniforms,
          vertexShader: VERTEX,
          fragmentShader: SHADOW_FRAGMENT,
          transparent: true,
          blending: CustomBlending,
          blendEquation: MinEquation,
          blendEquationAlpha: MaxEquation,
          blendSrc: OneFactor,
          blendDst: OneFactor,
          depthWrite: false,
          side: DoubleSide,
          toneMapped: false,
        });
      }
      const mesh = new Mesh(PuppetView.quad, material);
      mesh.matrixAutoUpdate = false;
      mesh.frustumCulled = false;
      // Shadows lie on the wall with the hands' shadows; the glows are light on top of them.
      mesh.renderOrder = (glow ? RenderOrder.sprite : RenderOrder.shadow) + i * 0.0001;
      mesh.visible = false;
      this.group.add(mesh);
      const pivot = part.pivot ?? [0.5, 0.5];
      this.pieces.push({
        mesh,
        part: i,
        w: part.w,
        h: part.h,
        px: pivot[0],
        py: pivot[1],
        mirror: part.mirror ? -1 : 1,
        glow,
        strength: depthStrength(depth),
        material,
        texture,
        centre,
        axisA,
        axisB,
      });
    });
  }

  /**
   * Poses the parts from `player` on `stage`. `light` (0..1) is how much of the candle's light reaches the wall times the
   * shadows' solidity: covering the flame takes the puppets' shadows (and glows) away with the hands'.
   */
  update(player: ScenePlayer, stage: StagePlane, light: number): void {
    this.group.visible = light > 0.001;
    if (!this.group.visible) return;
    const world = player.world;
    const r = stage.right,
      u = stage.up,
      n = stage.normal,
      o = stage.origin;
    for (let k = 0; k < this.pieces.length; k++) {
      const p = this.pieces[k];
      const b = p.part * POSE_STRIDE;
      const opacity = world[b + 4] * light * p.strength;
      p.mesh.visible = opacity > 0.003;
      if (!p.mesh.visible) continue;
      p.material.uniforms.opacity.value = opacity;
      const c = Math.cos(world[b + 2]),
        s = Math.sin(world[b + 2]),
        sc = world[b + 3] * this.scale;
      const w = p.w * sc,
        h = p.h * sc;
      // The quad's centre, from the pivot: its offset to the centre turned with the part.
      const dx = (0.5 - p.px) * w,
        dy = (0.5 - p.py) * h;
      const x = world[b] * this.scale + c * dx - s * dy,
        y = world[b + 1] * this.scale + s * dx + c * dy;
      // Its axes in stage coordinates: x along (c, s), y along (-s, c); then into the scene through the stage's frame.
      const ax = c * w * p.mirror,
        ay = s * w * p.mirror,
        bx = -s * h,
        by = c * h;
      p.centre.set(x, y);
      p.axisA.set(ax, ay);
      p.axisB.set(bx, by);
      const lift = LIFT_M + k * LIFT_STEP_M;
      // prettier-ignore
      p.mesh.matrix.set(
        r[0] * ax + u[0] * ay, r[0] * bx + u[0] * by, n[0], o[0] + r[0] * x + u[0] * y + n[0] * lift,
        r[1] * ax + u[1] * ay, r[1] * bx + u[1] * by, n[1], o[1] + r[1] * x + u[1] * y + n[1] * lift,
        r[2] * ax + u[2] * ay, r[2] * bx + u[2] * by, n[2], o[2] + r[2] * x + u[2] * y + n[2] * lift,
        0, 0, 0, 1,
      );
      p.mesh.matrixWorldNeedsUpdate = true;
    }
  }

  /** Hides it until the next update with light. */
  hide(): void {
    this.group.visible = false;
  }

  /** Drops the scene's meshes and textures. */
  unload(): void {
    for (const p of this.pieces) {
      this.group.remove(p.mesh);
      (p.material as Material).dispose();
      p.texture.dispose();
    }
    this.pieces = [];
    this.scene = null;
  }
}

/** Draws `src` over the whole of `g`'s canvas, blurred by `blurPx` (none below half a pixel). */
function drawSoft(g: CanvasRenderingContext2D, src: CanvasImageSource, w: number, h: number, blurPx: number): void {
  if (blurPx >= 0.5) g.filter = `blur(${blurPx.toFixed(1)}px)`;
  g.drawImage(src, 0, 0, w, h);
  g.filter = 'none';
}
