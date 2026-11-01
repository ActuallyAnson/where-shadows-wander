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
import { paintTraveller, Pose, WALK_CYCLE } from './traveller-art';

/** The floor is this far below the eyes (a seated player's eyes are about 1.2 m up). */
const FLOOR_Y = -1.25;
const MOTES = 170;
/** Where the Skip button is, in the scene's own space: a little to the right, low and near. */
const SKIP_LOCAL = [0.28, -0.5, -0.6] as const;
const FADE_IN_S = 1.3;
const FADE_OUT_S = 1;
/** How long the wordless opening reel runs (seconds from its start), and when its parts happen. */
export const REEL_S = 21;

/** A smooth 0..1 ramp of `t` between `a` and `b` (module level, so the reel makes no closure each frame). */
function ramp(t: number, a: number, b: number): number {
  const k = (t - a) / (b - a);
  return k < 0 ? 0 : k > 1 ? 1 : k * k * (3 - 2 * k);
}
function basic(m: Mesh): MeshBasicMaterial {
  return m.material as MeshBasicMaterial;
}
function dim(m: Mesh, k: number): void {
  basic(m).color.setRGB(1 - k * 0.72, 1 - k * 0.7, 1 - k * 0.38);
}
/** The five sleepers' lights over the castle: their colours (lamp, bunting, pictures, globe, window). */
const WISP_COLOURS: readonly (readonly [number, number, number])[] = [
  [1, 0.75, 0.35],
  [1, 0.55, 0.58],
  [0.55, 0.72, 1],
  [0.45, 0.95, 0.78],
  [0.72, 0.9, 1],
];
/** When the wisps go out, one by one, last sleeper first, and how long each takes to fade. */
export const WISP_OUT_FROM_S = 7.6;
export const WISP_OUT_EVERY_S = 0.8;
const WISP_OUT_S = 0.6;

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
  private moteMat!: ShaderMaterial;
  private traveller!: Mesh;
  /** The parts the opening reel animates (the dusk scene only). */
  private reel: {
    sun: Mesh;
    castle: Mesh;
    sky: Mesh;
    floor: Mesh;
    horizon: Mesh;
    streak: Mesh;
    wisps: Mesh[];
    traveller: Mesh;
    ember: Mesh;
    title: Mesh;
    subtitle: Mesh;
    walk: CanvasTexture[];
    idle: CanvasTexture;
  } | null = null;
  private text!: Mesh;
  private textMat!: MeshBasicMaterial;
  private textTexture: CanvasTexture | null = null;
  /** The Skip button: a ring in front of the lap, where a fingertip can poke it (it is a StagePlane for SkipTouch, centred on the button). */
  readonly skipPlane: MutableStagePlane = createStagePlane();
  private skipButton!: Mesh;
  private skipMat!: MeshBasicMaterial;
  /** Whether the scene's meshes and textures exist: they are made when it is entered and freed when it is left (about 10 MB of textures between the two scenes). */
  private built = false;
  private time = 0;
  /** Seconds into the line of words, and how long it holds; negative when there is none. */
  private line = -1;
  private hold = 0;

  constructor(
    private readonly palette: CinematicPalette = DUSK,
    private readonly kind: SceneKind = 'dusk',
  ) {
    // Nothing is made yet: the scene builds itself when it is entered and frees itself when it is left.
    this.skipPlane.right[0] = 1;
    this.skipPlane.up[1] = 1;
    this.skipPlane.normal[2] = 1;
    this.skipPlane.width = this.skipPlane.height = 0.14;
    this.group.visible = false;
  }

  /** Paints the textures and makes the meshes (about 20 ms: done under the fade to black). */
  private build(): void {
    const p = this.palette;
    const kind = this.kind;
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
    const skyMesh = make(
      420,
      160,
      tex(8, 256, (g, w, h) => paintSky(g, w, h, p)),
      ORDER.sky,
    );
    skyMesh.position.set(0, FLOOR_Y + 76, -80);
    let sunMesh: Mesh | null = null;
    let castleMesh: Mesh | null = null;
    if (kind === 'dusk') {
      sunMesh = make(
        34,
        34,
        tex(256, 256, (g, w, h) => paintSun(g, w, h, p)),
        ORDER.sun,
        { additive: true },
      );
      sunMesh.position.set(2, FLOOR_Y + 4.5, -78);
      castleMesh = make(30, 12, tex(512, 205, paintCastle), ORDER.castle);
      castleMesh.position.set(2, FLOOR_Y + 6, -76);
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

    // The wordless opening reel (dusk only): five glowing sleepers over the castle, a walking traveller, an ember, a title.
    if (kind === 'dusk' && sunMesh && castleMesh) {
      const orb = tex(128, 128, (g, w, h) => {
        const grad = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
        grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
        grad.addColorStop(0.25, 'rgba(255, 255, 255, 0.55)');
        grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        g.fillStyle = grad;
        g.fillRect(0, 0, w, h);
      });
      const wisps: Mesh[] = [];
      for (let i = 0; i < 5; i++) {
        const w = make(5.5, 5.5, orb, ORDER.glow + 1, { additive: true });
        w.position.set(2 + (i - 2) * 6, FLOOR_Y + 15 + 2.2 * Math.cos((i - 2) * 0.55), -68);
        (w.material as MeshBasicMaterial).color.setRGB(WISP_COLOURS[i][0], WISP_COLOURS[i][1], WISP_COLOURS[i][2]);
        (w.material as MeshBasicMaterial).opacity = 0;
        wisps.push(w);
      }
      const ember = make(0.8, 0.8, orb, ORDER.traveller + 1, { additive: true });
      ember.position.set(-0.6, FLOOR_Y + 0.6, -5.9);
      (ember.material as MeshBasicMaterial).color.setRGB(1, 0.78, 0.4);
      (ember.material as MeshBasicMaterial).opacity = 0;
      const title = make(
        5.8,
        0.75,
        tex(1024, 128, (g, w, h) => paintCaption(g, w, h, 'WHERE SHADOWS WANDER')),
        ORDER.text,
      );
      title.position.set(0, 0.85, -4);
      const subtitle = make(
        3.4,
        0.43,
        tex(1024, 128, (g, w, h) => paintCaption(g, w, h, 'Help it wake them.')),
        ORDER.text,
      );
      subtitle.position.set(0, 0.1, -4);
      for (const m of [title, subtitle]) {
        const mat = m.material as MeshBasicMaterial;
        mat.depthTest = false;
        mat.opacity = 0;
      }
      const walk = WALK_CYCLE.map((pose) => tex(256, 256, (g, w) => paintTraveller(g, w, pose)));
      const idle = (this.traveller.material as MeshBasicMaterial).map as CanvasTexture;
      this.reel = {
        sun: sunMesh,
        castle: castleMesh,
        sky: skyMesh,
        floor,
        horizon,
        streak,
        wisps,
        traveller: this.traveller,
        ember,
        title,
        subtitle,
        walk,
        idle,
      };
    }

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
    this.skipButton.position.set(SKIP_LOCAL[0], SKIP_LOCAL[1], SKIP_LOCAL[2]);
    this.skipMat = this.skipButton.material as MeshBasicMaterial;
    this.skipMat.depthTest = false;
    this.skipMat.opacity = 0.55;
    this.built = true;
  }

  /** Frees the textures, geometries and materials, and takes the meshes out of the group. */
  private unbuild(): void {
    if (!this.built) return;
    for (const child of [...this.group.children]) this.group.remove(child);
    this.textTexture?.dispose();
    this.textTexture = null;
    for (const tex of this.textures) tex.dispose();
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials) m.dispose();
    this.textures.length = 0;
    this.geometries.length = 0;
    this.materials.length = 0;
    this.reel = null;
    this.line = -1;
    this.built = false;
  }

  /** Whether the scene is made now (between entering and leaving). */
  get isBuilt(): boolean {
    return this.built;
  }

  /** Puts the scene around the head, facing the way it faces now (`dirX`, `dirZ` is the head's direction on the floor), and shows it. */
  enter(head: Readonly<{ x: number; y: number; z: number }>, dirX: number, dirZ: number): void {
    if (!this.built) this.build();
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
    this.setReelTime(0);
    this.group.visible = true;
  }

  /** How far the Skip poke has got (0..1): the ring brightens as it fills. */
  setSkipProgress(progress: number): void {
    if (!this.built) return;
    this.skipMat.opacity = 0.55 + 0.45 * Math.min(1, Math.max(0, progress));
    const k = 1 + 0.25 * Math.min(1, Math.max(0, progress));
    this.skipButton.scale.set(k, k, 1);
  }

  /**
   * Sets the opening reel to `r` seconds in (a pure function of the time, so a jump or a skip cannot leave it half-way): the five
   * wisps over the castle glow and bob, the traveller walks in from the left, the wisps go out one by one (the last sleeper first),
   * the sun sinks and the dusk turns to night, an ember lights at the traveller's lantern, and the title writes itself in the dark.
   */
  setReelTime(r: number): void {
    const R = this.built ? this.reel : null;
    if (!R) return;
    const t = r > 0 ? r : 0;
    const night = ramp(t, 7.6, 12.5);
    // The sun rises into its glow, then sinks and the world cools to night.
    basic(R.sun).opacity = ramp(t, 0, 3) * (1 - night);
    R.sun.position.y = FLOOR_Y + 4.5 - 6.5 * night;
    dim(R.sky, night);
    dim(R.floor, night * 0.6);
    dim(R.castle, night * 0.55);
    basic(R.horizon).opacity = 1 - night;
    basic(R.streak).opacity = 1 - night;
    // The five sleepers' lights: they come up one by one, bob, and go out last-first.
    for (let i = 0; i < 5; i++) {
      const appear = ramp(t, 0.8 + 0.4 * i, 1.8 + 0.4 * i);
      const outAt = WISP_OUT_FROM_S + WISP_OUT_EVERY_S * (4 - i);
      const out = t < outAt ? 0 : Math.min(1, (t - outAt) / WISP_OUT_S);
      basic(R.wisps[i]).opacity = appear * (1 - out) * (0.85 + 0.15 * Math.sin(t * 2.1 + i * 1.3));
      R.wisps[i].position.y = FLOOR_Y + 15 + 2.2 * Math.cos((i - 2) * 0.55) + 0.25 * Math.sin(t * 1.3 + i);
    }
    // The traveller walks in from the left between 3 s and 8 s (a four-frame stride), then stands.
    const walking = t > 3 && t < 8;
    R.traveller.position.x = -9 + 8 * ramp(t, 3, 8);
    basic(R.traveller).map = walking ? R.walk[Math.floor(t * 8) % 4] : R.idle;
    R.traveller.position.y = FLOOR_Y + 0.72 + (walking ? Math.abs(Math.sin(t * 8 * Math.PI)) * 0.04 : 0);
    // The ember lights at its lantern, and the title and its one line come up out of the dark.
    basic(R.ember).opacity = ramp(t, 12, 13.5) * (0.85 + 0.15 * Math.sin(t * 9));
    R.ember.position.x = R.traveller.position.x + 0.38;
    basic(R.title).opacity = ramp(t, 13.5, 15.5) * (1 - ramp(t, 20, 21));
    basic(R.subtitle).opacity = ramp(t, 16.2, 17.8) * (1 - ramp(t, 20, 21));
  }

  /** Hides the scene and takes its words away. */
  leave(): void {
    this.clear();
    this.group.visible = false;
    this.unbuild();
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
    if (!this.built) return;
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
    if (!this.built) return;
    this.textMat.opacity = 0;
    this.text.visible = false;
  }

  /** Once per frame. Allocates nothing. */
  update(dt: number): void {
    if (!this.built || !this.group.visible) return;
    const step = dt > 0 ? Math.min(dt, 0.1) : 0;
    this.time += step;
    this.moteMat.uniforms.uTime.value = this.time;
    // The traveller breathes: a slow small sway.
    if (!this.reel) this.traveller.position.y = FLOOR_Y + 0.72 + Math.sin(this.time * 1.6) * 0.012;
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
  }
}
