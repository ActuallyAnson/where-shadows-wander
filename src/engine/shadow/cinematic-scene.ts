// A cinematic scene that fills the view, like a painted film still: a sky that burns from violet to orange, one huge glowing sun
// with a castle's silhouette before it, a dark glossy floor with the light streaking across it, black pillars with a rim of
// light, motes of light drifting up, the little traveller standing small in front of it all, and a line of words floating over
// the floor. It is made of a handful of large quads placed at real depth (so each eye sees the layers apart) and one Points of
// motes moved by a shader, so a frame only advances a clock. The prologue plays in it; the room is hidden meanwhile.
import {
  AdditiveBlending,
  BufferGeometry,
  CanvasTexture,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Points,
  RepeatWrapping,
  ShaderMaterial,
  SRGBColorSpace,
} from '@iwsdk/core';
import {
  DUSK,
  paintBeam,
  paintCaption,
  paintCastle,
  paintColumn,
  paintCrystal,
  paintFloorTile,
  paintPillar,
  paintStreak,
  paintSky,
  paintSun,
  type CinematicPalette,
} from './cinematic-art';
import { SKIP_RADIUS_M } from './pure/skip-touch';
import { createStagePlane, type MutableStagePlane } from './pure/stage-plane';
import { paintTraveller, Pose } from './traveller-art';

/** The floor is this far below the eyes (a seated player's eyes are about 1.2 m up). */
const FLOOR_Y = -1.25;
const MOTES = 170;
/** Where the Skip button is, in the scene's own space: a little to the right, low and near. */
const SKIP_LOCAL = [0.28, -0.5, -0.6] as const;
const FADE_IN_S = 1.3;
const FADE_OUT_S = 1;
/** The orders things draw in: the far backdrop first, the floor over it, then the lights, then the words on top. */
const ORDER = {
  sky: -50,
  sun: -49,
  castle: -48,
  floor: -47,
  glow: -46,
  pillar: -45,
  traveller: -44,
  motes: -43,
  text: 50,
};

const MOTE_VERTEX = /* glsl */ `
uniform float uTime;
uniform float uScale;
attribute float aPhase;
attribute float aSize;
attribute vec3 aColor;
varying vec3 vColor;
varying float vA;
void main() {
  vec3 p = position;
  p.y = mod(p.y - ${FLOOR_Y.toFixed(2)} + uTime * (0.1 + 0.12 * fract(aPhase * 7.0)), 11.0) + ${FLOOR_Y.toFixed(2)};
  p.x += sin(uTime * 0.3 + aPhase * 6.28) * 0.6;
  p.z += cos(uTime * 0.25 + aPhase * 5.0) * 0.5;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aSize * uScale / max(0.5, -mv.z);
  vColor = aColor;
  vA = 0.35 + 0.65 * fract(sin(aPhase * 91.7 + uTime * 0.7) * 43758.5);
}`;

const MOTE_FRAGMENT = /* glsl */ `
varying vec3 vColor;
varying float vA;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, d);
  gl_FragColor = vec4(vColor, a * vA);
  #include <colorspace_fragment>
}`;

function paintedTexture(
  w: number,
  h: number,
  paint: (g: CanvasRenderingContext2D, w: number, h: number) => void,
): CanvasTexture {
  let canvas: HTMLCanvasElement | undefined;
  if (typeof document !== 'undefined') canvas = document.createElement('canvas');
  if (!canvas) canvas = { width: w, height: h, getContext: () => null } as unknown as HTMLCanvasElement;
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext ? canvas.getContext('2d') : null;
  if (g) paint(g, w, h);
  const t = new CanvasTexture(canvas);
  t.colorSpace = SRGBColorSpace;
  return t;
}

/** Which scene to build: the burning dusk with a castle on the horizon, or the hall with a great crystal. */
export type SceneKind = 'dusk' | 'hall';

export class CinematicScene {
  readonly group = new Group();
  private readonly textures: CanvasTexture[] = [];
  private readonly materials: (MeshBasicMaterial | ShaderMaterial)[] = [];
  private readonly geometries: BufferGeometry[] = [];
  private readonly moteMat: ShaderMaterial;
  private readonly traveller: Mesh;
  private readonly text: Mesh;
  private readonly textMat: MeshBasicMaterial;
  private textTexture: CanvasTexture | null = null;
  /** The Skip button: a ring in front of the lap, where a fingertip can poke it (it is a StagePlane for SkipTouch, centred on the button). */
  readonly skipPlane: MutableStagePlane = createStagePlane();
  private readonly skipButton: Mesh;
  private readonly skipMat: MeshBasicMaterial;
  private time = 0;
  /** Seconds into the line of words, and how long it holds; negative when there is none. */
  private line = -1;
  private hold = 0;

  constructor(
    private readonly palette: CinematicPalette = DUSK,
    kind: SceneKind = 'dusk',
  ) {
    const p = palette;
    const make = (
      w: number,
      h: number,
      tex: CanvasTexture,
      order: number,
      opts: { additive?: boolean; depth?: boolean; double?: boolean } = {},
    ): Mesh => {
      const mat = new MeshBasicMaterial({
        map: tex,
        transparent: true,
        depthWrite: opts.depth ?? false,
        blending: opts.additive ? AdditiveBlending : undefined,
        toneMapped: false,
        side: DoubleSide,
      });
      const geo = new PlaneGeometry(w, h);
      this.materials.push(mat);
      this.geometries.push(geo);
      const mesh = new Mesh(geo, mat);
      mesh.renderOrder = order;
      mesh.frustumCulled = false;
      this.group.add(mesh);
      return mesh;
    };
    const tex = (w: number, h: number, paint: (g: CanvasRenderingContext2D, w: number, h: number) => void) => {
      const t = paintedTexture(w, h, paint);
      this.textures.push(t);
      return t;
    };

    // The sky, then the big light on the horizon: the sun with the castle before it, or the crystal in the hall.
    make(
      420,
      160,
      tex(8, 256, (g, w, h) => paintSky(g, w, h, p)),
      ORDER.sky,
    ).position.set(0, FLOOR_Y + 76, -80);
    if (kind === 'dusk') {
      make(
        34,
        34,
        tex(256, 256, (g, w, h) => paintSun(g, w, h, p)),
        ORDER.sun,
        { additive: true },
      ).position.set(2, FLOOR_Y + 4.5, -78);
      make(30, 12, tex(512, 205, paintCastle), ORDER.castle).position.set(2, FLOOR_Y + 6, -76);
    } else {
      make(
        22,
        33,
        tex(256, 384, (g, w, h) => paintCrystal(g, w, h, p)),
        ORDER.sun,
        { additive: true },
      ).position.set(0, FLOOR_Y + 13, -46);
      make(
        10,
        36,
        tex(64, 256, (g, w, h) => paintBeam(g, w, h, p)),
        ORDER.castle,
        { additive: true },
      ).position.set(0, FLOOR_Y + 18, -45);
    }

    // The floor: dark tiles, a glow lying along the horizon, and the sun's streak running toward you.
    const tile = tex(256, 256, (g, w, h) => paintFloorTile(g, w, h, p));
    tile.wrapS = tile.wrapT = RepeatWrapping;
    tile.repeat.set(20, 20);
    tile.anisotropy = 4;
    const floor = make(140, 140, tile, ORDER.floor, { depth: true });
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, FLOOR_Y, -60);
    const horizon = make(
      140,
      45,
      tex(8, 64, (g, w, h) => {
        const grad = g.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, p.glow + '00');
        grad.addColorStop(1, p.glow + '88');
        g.fillStyle = grad;
        g.fillRect(0, 0, w, h);
      }),
      ORDER.glow,
      { additive: true },
    );
    horizon.rotation.x = -Math.PI / 2;
    horizon.position.set(0, FLOOR_Y + 0.01, -57);
    const streak = make(
      11,
      70,
      tex(128, 512, (g, w, h) => paintStreak(g, w, h, p)),
      ORDER.glow + 0.5,
      {
        additive: true,
      },
    );
    streak.rotation.x = -Math.PI / 2;
    streak.position.set(kind === 'dusk' ? 2 : 0, FLOOR_Y + 0.02, -41);

    // Pillars (black, rim lit) or fluted columns (stone, rim lit) at different depths, so the layers shift as the head moves.
    const pillars: ReadonlyArray<readonly [number, number, number, number, number]> =
      kind === 'dusk'
        ? [
            [-8.5, -13, 9, 41, 1],
            [-15, -23, 13, 43, 1],
            [8, -15, 10, 47, -1],
            [16, -27, 14, 53, -1],
          ]
        : [
            [-5.5, -10, 12, 71, 1],
            [5.5, -10, 12, 73, -1],
            [-8, -19, 14, 79, 1],
            [8, -19, 14, 83, -1],
            [-10.5, -30, 16, 89, 1],
            [10.5, -30, 16, 97, -1],
          ];
    for (const [x, z, h, seed, flip] of pillars) {
      const paint =
        kind === 'dusk'
          ? (g: CanvasRenderingContext2D, w: number, hh: number) => paintPillar(g, w, hh, p, seed)
          : (g: CanvasRenderingContext2D, w: number, hh: number) => paintColumn(g, w, hh, p, seed);
      const pillar = make(h * (kind === 'dusk' ? 0.3 : 0.24), h, tex(128, 512, paint), ORDER.pillar);
      pillar.position.set(x, FLOOR_Y + h / 2, z);
      pillar.scale.x = flip;
    }

    // The little traveller, small before the light.
    this.traveller = make(
      1.5,
      1.5,
      tex(256, 256, (g, w) => paintTraveller(g, w, Pose.Idle)),
      ORDER.traveller,
    );
    this.traveller.position.set(-1, FLOOR_Y + 0.72, -6);

    // Motes of light drifting up through it all.
    const pos = new Float32Array(MOTES * 3);
    const phase = new Float32Array(MOTES);
    const size = new Float32Array(MOTES);
    const colour = new Float32Array(MOTES * 3);
    let s = 7;
    const rnd = () => {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return s / 4294967296;
    };
    const c = new Color();
    for (let i = 0; i < MOTES; i++) {
      pos.set([(rnd() - 0.5) * 30, FLOOR_Y + rnd() * 11, -2 - rnd() * 38], i * 3);
      phase[i] = rnd();
      size[i] = 0.5 + rnd() * rnd() * 2.2;
      c.set(p.motes[Math.floor(rnd() * p.motes.length)]);
      colour.set([c.r, c.g, c.b], i * 3);
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
    geo.setAttribute('aPhase', new Float32BufferAttribute(phase, 1));
    geo.setAttribute('aSize', new Float32BufferAttribute(size, 1));
    geo.setAttribute('aColor', new Float32BufferAttribute(colour, 3));
    this.geometries.push(geo);
    this.moteMat = new ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uScale: { value: 260 } },
      vertexShader: MOTE_VERTEX,
      fragmentShader: MOTE_FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    this.materials.push(this.moteMat);
    const motes = new Points(geo, this.moteMat);
    motes.renderOrder = ORDER.motes;
    motes.frustumCulled = false;
    this.group.add(motes);

    // The line of words, low in the view, over the floor.
    this.text = make(
      4.2,
      0.5,
      tex(1024, 128, (g, w, h) => g.clearRect(0, 0, w, h)),
      ORDER.text,
    );
    this.text.position.set(0, -0.8, -3);
    this.textMat = this.text.material as MeshBasicMaterial;
    this.textMat.depthTest = false;
    this.textMat.opacity = 0;
    this.text.visible = false;

    // The Skip button, low and near, where the hands rest: a ring with its word.
    this.skipButton = make(
      SKIP_RADIUS_M * 2.4,
      SKIP_RADIUS_M * 2.4,
      tex(128, 128, (g, w, h) => {
        g.clearRect(0, 0, w, h);
        g.strokeStyle = 'rgba(255, 238, 205, 0.9)';
        g.lineWidth = 6;
        g.beginPath();
        g.arc(w / 2, h / 2, w * 0.4, 0, Math.PI * 2);
        g.stroke();
        g.fillStyle = 'rgba(255, 238, 205, 0.95)';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.font = `700 ${Math.round(w * 0.2)}px 'Cinzel Decorative', Georgia, serif`;
        g.fillText('SKIP', w / 2, h / 2 + 2);
      }),
      ORDER.text + 1,
    );
    this.skipPlane.right[0] = 1;
    this.skipPlane.up[1] = 1;
    this.skipPlane.normal[2] = 1;
    this.skipPlane.width = this.skipPlane.height = 0.14;
    this.skipButton.position.set(SKIP_LOCAL[0], SKIP_LOCAL[1], SKIP_LOCAL[2]);
    this.skipMat = this.skipButton.material as MeshBasicMaterial;
    this.skipMat.depthTest = false;
    this.skipMat.opacity = 0.55;
    this.group.visible = false;
  }

  /** Puts the scene around the head, facing the way it faces now (`dirX`, `dirZ` is the head's direction on the floor), and shows it. */
  enter(head: Readonly<{ x: number; y: number; z: number }>, dirX: number, dirZ: number): void {
    this.group.position.set(head.x, head.y, head.z);
    this.group.rotation.set(0, Math.atan2(-dirX, -dirZ), 0);
    this.time = 0;
    // The Skip button's plane, in the world: centred on the button, turned with the scene.
    const yaw = this.group.rotation.y;
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    const sp = this.skipPlane;
    sp.origin[0] = head.x + SKIP_LOCAL[0] * c + SKIP_LOCAL[2] * s;
    sp.origin[1] = head.y + SKIP_LOCAL[1];
    sp.origin[2] = head.z - SKIP_LOCAL[0] * s + SKIP_LOCAL[2] * c;
    sp.right[0] = c;
    sp.right[2] = -s;
    sp.normal[0] = s;
    sp.normal[2] = c;
    this.group.visible = true;
  }

  /** How far the Skip poke has got (0..1): the ring brightens as it fills. */
  setSkipProgress(progress: number): void {
    this.skipMat.opacity = 0.55 + 0.45 * Math.min(1, Math.max(0, progress));
    const k = 1 + 0.25 * Math.min(1, Math.max(0, progress));
    this.skipButton.scale.set(k, k, 1);
  }

  /** Hides the scene and takes its words away. */
  leave(): void {
    this.clear();
    this.group.visible = false;
  }

  /** Whether a line of words is showing. */
  get playing(): boolean {
    return this.line >= 0;
  }

  /**
   * Floats `text` over the floor: it fades in, holds for the page's writing time and hold, and fades out. (The page options are
   * the prologue's: how long it takes to write and to hold; here the words simply appear for about that long.)
   */
  show(text: string, options: { write: number; hold: number; maxEm?: number }): void {
    this.textTexture?.dispose();
    this.textTexture = paintedTexture(1024, 128, (g, w, h) => paintCaption(g, w, h, text));
    this.textMat.map = this.textTexture;
    this.textMat.needsUpdate = true;
    this.hold = Math.max(0, options.write * 0.6 + options.hold);
    this.line = 0;
    this.text.visible = true;
  }

  /** Takes the words away now. */
  clear(): void {
    this.line = -1;
    this.textMat.opacity = 0;
    this.text.visible = false;
  }

  /** Once per frame. Allocates nothing. */
  update(dt: number): void {
    if (!this.group.visible) return;
    const step = dt > 0 ? Math.min(dt, 0.1) : 0;
    this.time += step;
    this.moteMat.uniforms.uTime.value = this.time;
    // The traveller breathes: a slow small sway.
    this.traveller.position.y = FLOOR_Y + 0.72 + Math.sin(this.time * 1.6) * 0.012;
    if (this.line >= 0) {
      this.line += step;
      const total = FADE_IN_S + this.hold + FADE_OUT_S;
      if (this.line >= total) {
        this.clear();
        return;
      }
      const a = Math.min(1, this.line / FADE_IN_S, (total - this.line) / FADE_OUT_S);
      this.textMat.opacity = a;
    }
  }

  dispose(): void {
    this.leave();
    this.textTexture?.dispose();
    for (const t of this.textures) t.dispose();
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials) m.dispose();
  }
}
