// The travel scenes, in the game's own engine: between puzzles the room is hidden and the traveller walks into the next land, turning its
// back to us as it goes along a road that winds toward the horizon (the ARRIVAL, the land still asleep and lit only by the lantern), and after
// a puzzle is solved the sleeper wakes and the day sweeps out from the lantern (the WAKING). Like the cinematic scenes it is a handful of large
// flat things at real depth (sky, far hills, the destination, the ground, a ribbon of road, sprites standing along it), so each eye sees the
// layers apart; a frame only moves them. The pictures are painted in code (walk-lands.ts, depth-walk.ts, traveller-art.ts) when a scene starts,
// under the fade to black, and freed when it ends.
import {
  AdditiveBlending,
  BufferGeometry,
  CanvasTexture,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  RepeatWrapping,
  SRGBColorSpace,
} from '@iwsdk/core';
import { paintPropSprite, placeProps, PROP_BOX, ROAD_M, roadX, type PlacedProp, type Prop } from './depth-walk';
import {
  arrivalAt,
  ARRIVAL_S,
  createArrivalState,
  createWakingState,
  ROAD_END_M,
  START_Z,
  wakingAt,
  WAKE_BEAT_S,
  WAKING_S,
} from './pure/walk-timeline';
import { SKIP_RADIUS_M } from './pure/skip-touch';
import { createStagePlane, type MutableStagePlane } from './pure/stage-plane';
import { paintTraveller, paintTravellerBack, Pose } from './traveller-art';
import { LAND_SIZE, LANDS, paintLandLayer, type LandId } from './walk-lands';

/** The ground is this far below the eyes (a seated player's eyes are about 1.2 m up). */
const FLOOR_Y = -1.25;
/** How far ahead of the eyes the traveller walks, metres. */
const AHEAD_M = 3.6;
/** Width of a screen's worth of painting, in pixels, that the layers are made at (the memory cost grows with its square). */
const SCREEN_PX = 768;
const SCREEN_ASPECT = 16 / 9;
/** How wide the view is at a distance (a wide field of view: 100 degrees across). */
const VIEW_PER_M = 2.38;
const SKY_AT = 95;
const FAR_AT = 75;
const MID_START = 80;
const MID_END = 46;
const STRIDE_M = 0.55;
/** Where the Skip button is, in the scene's own space: a little to the right, low and near. */
const SKIP_LOCAL = [0.28, -0.5, -0.6] as const;

export type WalkMode = 'arrive' | 'wake';

const MID_BASE: Readonly<Record<string, number>> = { castle: 0.66, peaks: 0.8, ridge: 0.8, cave: 0.76, buttes: 0.8 };

function paintedTexture(
  w: number,
  h: number,
  paint: (g: CanvasRenderingContext2D, w: number, h: number) => void,
  repeat = false,
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
  if (repeat) t.wrapS = t.wrapT = RepeatWrapping;
  return t;
}

const smooth = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

interface PropMesh {
  mesh: Mesh;
  mat: MeshBasicMaterial;
  prop: PlacedProp;
  sways: boolean;
}

export class WalkSceneView {
  readonly group = new Group();
  private readonly world = new Group();
  private readonly textures: CanvasTexture[] = [];
  private readonly geometries: BufferGeometry[] = [];
  private readonly materials: MeshBasicMaterial[] = [];
  /** The materials the land's tint (cold while asleep, daylight when awake) is multiplied over. */
  private readonly tinted: MeshBasicMaterial[] = [];
  private readonly props: PropMesh[] = [];
  private readonly arrival = createArrivalState();
  private readonly waking = createWakingState();
  private land: LandId | null = null;
  private mode: WalkMode = 'arrive';
  private time = 0;
  private built = false;
  private traveller!: Mesh;
  private travellerMat!: MeshBasicMaterial;
  private mid!: Mesh;
  private stars!: Mesh;
  private starsMat!: MeshBasicMaterial;
  private flashMat!: MeshBasicMaterial;
  private pool!: Mesh;
  private poolMat!: MeshBasicMaterial;
  private shadow!: Mesh;
  private frames: Record<string, CanvasTexture> = {};
  private castleX = 0;
  private done = false;
  private skipButton!: Mesh;
  private skipMat!: MeshBasicMaterial;
  private lastStride = 0;
  private wakeSounded = false;
  /** Where a fingertip pokes to skip (the same ring as the other full-view scenes). */
  readonly skipPlane: MutableStagePlane = createStagePlane();
  /** Told on each footstep (which of the two feet) and once when the sleeper wakes, for the app to make the sounds. */
  onStep: ((alternate: boolean) => void) | null = null;
  onWake: (() => void) | null = null;

  constructor() {
    this.group.visible = false;
    this.group.add(this.world);
  }

  /** Whether the scene being played has reached its end. */
  get finished(): boolean {
    return this.done;
  }

  get playing(): boolean {
    return this.group.visible && !this.done;
  }

  /** How long the scene being played lasts, seconds. */
  get length(): number {
    return this.mode === 'arrive' ? ARRIVAL_S : WAKING_S;
  }

  private prepared: { land: LandId; mode: WalkMode } | null = null;

  /** Says which scene the next `enter` shows (so the scene fits the same host the other full-view scenes use). */
  prepare(land: LandId, mode: WalkMode): void {
    this.prepared = { land, mode };
  }

  /** Starts the prepared scene around the head (the host's call, after its fade). */
  enter(head: Readonly<{ x: number; y: number; z: number }>, dirX: number, dirZ: number): void {
    const p = this.prepared;
    if (p) this.start(head, dirX, dirZ, p.land, p.mode);
  }

  /** Shows `land` in `mode` around the head, facing the way it faces now (painting it first if it is not the land already made). */
  start(
    head: Readonly<{ x: number; y: number; z: number }>,
    dirX: number,
    dirZ: number,
    land: LandId,
    mode: WalkMode,
  ): void {
    if (this.built && this.land !== land) this.unbuild();
    if (!this.built) this.build(land);
    this.mode = mode;
    this.time = 0;
    this.done = false;
    this.group.position.set(head.x, head.y, head.z);
    this.group.rotation.set(0, Math.atan2(-dirX, -dirZ), 0);
    this.lastStride = Math.floor(START_Z / STRIDE_M);
    this.wakeSounded = false;
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
    sp.right[1] = 0;
    sp.normal[1] = 0;
    sp.up[1] = 1;
    sp.width = sp.height = SKIP_RADIUS_M * 2;
    this.skipMat.opacity = 0.55;
    this.group.visible = true;
    this.update(0);
  }

  /** How far the fingertip has held on Skip, 0 to 1: the ring brightens and swells. */
  setSkipProgress(progress: number): void {
    if (!this.built) return;
    const k = Math.min(1, Math.max(0, progress));
    this.skipMat.opacity = 0.55 + 0.45 * k;
    const sc = 1 + 0.25 * k;
    this.skipButton.scale.set(sc, sc, 1);
  }

  /** Ends the scene now. */
  skip(): void {
    this.time = this.length;
    this.update(0);
  }

  /** Takes the scene away and frees the pictures. */
  leave(): void {
    this.group.visible = false;
    this.unbuild();
  }

  dispose(): void {
    this.leave();
  }

  private unbuild(): void {
    if (!this.built) return;
    for (const child of [...this.world.children]) this.world.remove(child);
    for (const child of [...this.group.children]) if (child !== this.world) this.group.remove(child);
    for (const t of this.textures) t.dispose();
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials) m.dispose();
    this.textures.length = 0;
    this.geometries.length = 0;
    this.materials.length = 0;
    this.tinted.length = 0;
    this.props.length = 0;
    this.frames = {};
    this.built = false;
    this.land = null;
  }

  private build(land: LandId): void {
    const style = LANDS[land];
    const tex = (
      w: number,
      h: number,
      paint: (g: CanvasRenderingContext2D, w: number, h: number) => void,
      repeat = false,
    ) => {
      const t = paintedTexture(w, h, paint, repeat);
      this.textures.push(t);
      return t;
    };
    const make = (
      geo: BufferGeometry,
      map: CanvasTexture,
      order: number,
      opts: { additive?: boolean; tint?: boolean; opacity?: number; parent?: Group } = {},
    ): { mesh: Mesh; mat: MeshBasicMaterial } => {
      const mat = new MeshBasicMaterial({
        map,
        transparent: true,
        depthWrite: false,
        blending: opts.additive ? AdditiveBlending : undefined,
        toneMapped: false,
        side: DoubleSide,
        opacity: opts.opacity ?? 1,
      });
      this.geometries.push(geo);
      this.materials.push(mat);
      if (opts.tint) this.tinted.push(mat);
      const mesh = new Mesh(geo, mat);
      mesh.renderOrder = order;
      mesh.frustumCulled = false;
      (opts.parent ?? this.group).add(mesh);
      return { mesh, mat };
    };
    const plane = (w: number, h: number) => new PlaneGeometry(w, h);

    // The backdrops: sky, far hills, and the destination (the castle, the cave wall, the peaks), each a painting at its own distance.
    const layer = (name: 'sky' | 'far' | 'mid') => {
      const [fw, fh] = LAND_SIZE[name];
      const w = Math.round(fw * SCREEN_PX);
      const h = Math.round((fh * SCREEN_PX) / SCREEN_ASPECT);
      return { w, h, tex: tex(w, h, (g) => paintLandLayer(land, name, g, w, h, SCREEN_PX)) };
    };
    const sky = layer('sky');
    const skyW = SKY_AT * VIEW_PER_M * 1.1;
    const skyH = skyW * (sky.h / sky.w);
    const skyMesh = make(plane(skyW, skyH), sky.tex, 0, { tint: true }).mesh;
    skyMesh.position.set(0, skyH * 0.2, -SKY_AT);
    const far = layer('far');
    const farW = FAR_AT * VIEW_PER_M * LAND_SIZE.far[0];
    const farH = farW * (far.h / far.w);
    const farMesh = make(plane(farW, farH), far.tex, 1, { tint: true }).mesh;
    farMesh.position.set(0, FLOOR_Y + (0.72 - 0.5) * farH, -FAR_AT);
    const mid = layer('mid');
    const midW = 45 * VIEW_PER_M * LAND_SIZE.mid[0];
    const midH = midW * (mid.h / mid.w);
    this.mid = make(plane(midW, midH), mid.tex, 2, { tint: true }).mesh;
    const base = MID_BASE[style.mid.kind] ?? 0.7;
    this.castleX = style.mid.kind === 'castle' ? -(0.52 - 0.5) * midW : 0;
    this.mid.position.set(this.castleX, FLOOR_Y + (base - 0.5) * midH, -MID_START);
    // Stars in the sky while it sleeps.
    const stars = tex(1024, 512, (g, w, h) => {
      for (let i = 0; i < 160; i++) {
        g.fillStyle = `rgba(235,240,255,${0.4 + 0.6 * Math.abs(Math.sin(i * 12.9))})`;
        const x = (Math.abs(Math.sin(i * 78.2)) * 9301) % w;
        const y = ((Math.abs(Math.sin(i * 39.3)) * 4973) % h) * 0.62;
        g.fillRect(x, y, 2, 2);
      }
    });
    const starsMake = make(plane(skyW * 0.9, skyH * 0.9), stars, 0.5, { additive: true });
    this.stars = starsMake.mesh;
    this.starsMat = starsMake.mat;
    this.stars.position.set(0, skyH * 0.2, -SKY_AT + 1);

    // The ground, going to haze in the distance, and the road: a ribbon that follows the winding.
    const ground = tex(8, 512, (g, w, h) => {
      const gr = g.createLinearGradient(0, h, 0, 0);
      gr.addColorStop(0, style.ground.bottom);
      gr.addColorStop(0.035, style.ground.bottom);
      gr.addColorStop(0.12, style.ground.top);
      gr.addColorStop(0.3, `rgb(${style.far.haze})`);
      gr.addColorStop(1, `rgb(${style.far.haze})`);
      g.fillStyle = gr;
      g.fillRect(0, 0, w, h);
    });
    const groundGeo = new PlaneGeometry(700, 600);
    groundGeo.rotateX(-Math.PI / 2);
    const groundMesh = make(groundGeo, ground, 3, { tint: true }).mesh;
    groundMesh.position.set(0, FLOOR_Y, -280);
    // Haze lying along the horizon, so the ground and the backdrops melt into each other and the horizon is not a line.
    const hazeTex = tex(8, 128, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, `rgba(${style.far.haze},0)`);
      gr.addColorStop(0.55, `rgba(${style.far.haze},0.85)`);
      gr.addColorStop(1, `rgba(${style.far.haze},0)`);
      g.fillStyle = gr;
      g.fillRect(0, 0, w, h);
    });
    const hazeBand = make(plane(520, 22), hazeTex, 3.5, { tint: true }).mesh;
    hazeBand.position.set(0, FLOOR_Y + 8.5, -FAR_AT + 6);
    const roadTex = tex(
      128,
      128,
      (g, w, h) => {
        const gr = g.createLinearGradient(0, 0, w, 0);
        gr.addColorStop(0, '#9a8262');
        gr.addColorStop(0.5, '#cdb995');
        gr.addColorStop(1, '#9a8262');
        g.fillStyle = gr;
        g.fillRect(0, 0, w, h);
        g.strokeStyle = 'rgba(60,40,24,0.35)';
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(0, 2);
        g.lineTo(w, 2);
        g.moveTo(w * 0.4, 2);
        g.lineTo(w * 0.4, h * 0.5);
        g.moveTo(w * 0.7, h * 0.5);
        g.lineTo(w * 0.7, h);
        g.stroke();
        g.strokeStyle = 'rgba(255,244,214,0.5)';
        g.lineWidth = 4;
        g.beginPath();
        g.moveTo(2, 0);
        g.lineTo(2, h);
        g.moveTo(w - 2, 0);
        g.lineTo(w - 2, h);
        g.stroke();
      },
      true,
    );
    const roadGeo = this.roadGeometry(land);
    const road = make(roadGeo, roadTex, 4, { tint: true, parent: this.world });
    road.mesh.position.y = FLOOR_Y + 0.01;

    // What stands along the road, as sprites (one picture per kind, shared).
    const spriteFor: Partial<Record<Prop, CanvasTexture>> = {};
    for (const p of placeProps(land, ROAD_END_M + 2, ROAD_END_M)) {
      const [mw, mh] = PROP_BOX[p.kind];
      let map = spriteFor[p.kind];
      if (!map) {
        map = tex(Math.round(mw * 64), Math.round(mh * 64), (g, w, h) => paintPropSprite(g, p.kind, w, h, 3));
        spriteFor[p.kind] = map;
      }
      const made = make(plane(mw * p.size, mh * p.size), map, 200 - p.z * 5, { tint: true, parent: this.world });
      made.mesh.position.set(roadX(land, p.z, ROAD_END_M) + p.off, FLOOR_Y + (mh * p.size) / 2, -p.z);
      this.props.push({ mesh: made.mesh, mat: made.mat, prop: p, sways: p.kind === 'tree' || p.kind === 'tuft' });
    }

    // The traveller: one sprite whose picture is swapped (side view standing, a hop, the back view standing and walking).
    const frameOf = (key: string, paint: (g: CanvasRenderingContext2D) => void) => {
      this.frames[key] = tex(256, 256, (g) => paint(g));
    };
    frameOf('stand', (g) => paintTraveller(g, 256, Pose.Idle));
    frameOf('blink', (g) => paintTraveller(g, 256, Pose.Blink));
    frameOf('hop', (g) => paintTraveller(g, 256, Pose.Hop));
    frameOf('back', (g) => paintTravellerBack(g, 256, 0, false));
    for (let i = 0; i < 4; i++) frameOf(`walk${i}`, (g) => paintTravellerBack(g, 256, i, true));
    const size = 1 / 0.6;
    const trav = make(plane(size, size), this.frames.stand, 150, { parent: this.world });
    this.traveller = trav.mesh;
    this.travellerMat = trav.mat;
    this.traveller.position.y = FLOOR_Y + size * (238 / 256 - 0.5);
    // Its shadow on the road, and the warm pool of the lantern.
    const shadowTex = tex(64, 64, (g, w, h) => {
      const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      gr.addColorStop(0, 'rgba(10,6,12,0.6)');
      gr.addColorStop(1, 'rgba(10,6,12,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, w, h);
    });
    const shadowGeo = new PlaneGeometry(1.2, 0.5);
    shadowGeo.rotateX(-Math.PI / 2);
    this.shadow = make(shadowGeo, shadowTex, 149, { parent: this.world }).mesh;
    const poolTex = tex(128, 128, (g, w, h) => {
      const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      gr.addColorStop(0, 'rgba(255,196,110,0.55)');
      gr.addColorStop(1, 'rgba(255,170,80,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, w, h);
    });
    const poolGeo = new PlaneGeometry(7, 3.2);
    poolGeo.rotateX(-Math.PI / 2);
    const pool = make(poolGeo, poolTex, 148, { additive: true, parent: this.world });
    this.pool = pool.mesh;
    this.poolMat = pool.mat;

    // The Skip button: a ring with its word, low and near where the hands rest.
    const skipTex = tex(128, 128, (g, w, h) => {
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
    });
    const skip = make(plane(SKIP_RADIUS_M * 2.4, SKIP_RADIUS_M * 2.4), skipTex, 1001);
    this.skipButton = skip.mesh;
    this.skipMat = skip.mat;
    this.skipMat.depthTest = false;
    this.skipMat.opacity = 0.55;
    this.skipButton.position.set(SKIP_LOCAL[0], SKIP_LOCAL[1], SKIP_LOCAL[2]);
    // The flash of gold at the moment the sleeper wakes: a veil in front of the eyes.
    const flashTex = tex(8, 8, (g, w, h) => {
      g.fillStyle = '#ffd896';
      g.fillRect(0, 0, w, h);
    });
    const flash = make(plane(6, 4), flashTex, 1000, { additive: true, opacity: 0 });
    flash.mesh.position.set(0, 0, -1.2);
    this.flashMat = flash.mat;

    this.built = true;
    this.land = land;
  }

  /** The road as a ribbon: two vertices a road's width apart at each step along it, bending with the winding. */
  private roadGeometry(land: LandId): BufferGeometry {
    const steps = 120;
    const length = ROAD_END_M + 8;
    const pos: number[] = [];
    const uv: number[] = [];
    const index: number[] = [];
    for (let i = 0; i <= steps; i++) {
      const z = -2 + (i / steps) * (length + 2);
      const cx = roadX(land, z, ROAD_END_M);
      pos.push(cx - ROAD_M / 2, 0, -z, cx + ROAD_M / 2, 0, -z);
      uv.push(0, z / 2, 1, z / 2);
      if (i < steps) {
        const a = i * 2;
        index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new Float32BufferAttribute(uv, 2));
    geo.setIndex(index);
    return geo;
  }

  /** Once per frame while the scene plays. */
  update(dt: number): void {
    if (!this.built || !this.land) return;
    const step = dt > 0 ? Math.min(dt, 0.1) : 0;
    this.time += step;
    const land = this.land;
    const style = LANDS[land];
    let zT: number;
    let look: string;
    let hop = 0;
    let wake = 0;
    let flash = 0;
    let progress = 1;
    if (this.mode === 'arrive') {
      const a = arrivalAt(this.time, this.arrival);
      zT = a.z;
      look = a.look;
      hop = a.hop;
      progress = a.progress;
      this.done = a.done;
    } else {
      const w = wakingAt(this.time, this.waking);
      zT = ROAD_END_M - 1;
      look = 'turned';
      wake = w.wake;
      flash = w.flash;
      this.done = w.done;
    }
    const cx = roadX(land, zT, ROAD_END_M);
    // The camera follows the traveller down the road: the world slides toward us, and across a little as the road bends.
    this.world.position.set(-0.85 * cx, 0, zT - AHEAD_M);
    this.traveller.position.x = cx;
    this.traveller.position.z = -zT;
    this.traveller.renderOrder = 200 - zT * 5 + 0.5;
    this.shadow.position.set(cx, FLOOR_Y + 0.02, -zT);
    this.pool.position.set(cx + 0.5, FLOOR_Y + 0.03, -zT);
    // Sounds: a footstep at each stride of the walk, and the sleeper's note when the day begins.
    if (this.mode === 'arrive') {
      const stride = Math.floor(zT / STRIDE_M);
      if (look === 'walk' && stride !== this.lastStride) this.onStep?.(stride % 2 === 0);
      this.lastStride = stride;
    } else if (!this.wakeSounded && this.time >= WAKE_BEAT_S + 0.15) {
      this.wakeSounded = true;
      this.onWake?.();
    }
    // Which picture the traveller shows.
    let frame = 'back';
    if (look === 'stand') frame = this.time % 4.5 > 4.3 ? 'blink' : 'stand';
    else if (look === 'hop') frame = 'hop';
    else if (look === 'walk') frame = `walk${Math.floor(zT / STRIDE_M) % 4}`;
    this.travellerMat.map = this.frames[frame];
    const lift = hop * 0.3 + (this.mode === 'wake' ? flash * 0.25 : 0);
    this.traveller.position.y = FLOOR_Y + (1 / 0.6) * (238 / 256 - 0.5) + lift;
    // The destination comes nearer as the road is walked.
    this.mid.position.z = -(MID_START + (MID_END - MID_START) * (this.mode === 'arrive' ? progress : 1));
    // The land's tint: cold while it sleeps, its own colours as the day comes; and the lantern's pool grows.
    const t = style.sleepTint;
    const r = (t[0] + (255 - t[0]) * wake) / 255;
    const g = (t[1] + (255 - t[1]) * wake) / 255;
    const b = (t[2] + (255 - t[2]) * wake) / 255;
    for (const m of this.tinted) m.color.setRGB(r, g, b);
    this.starsMat.opacity = (1 - wake) * 0.9;
    this.poolMat.opacity = 1 - wake * 0.6;
    this.pool.scale.setScalar(1 + wake * 1.4);
    this.flashMat.opacity = flash * 0.35;
    // Things further along the road melt into the haze, and the trees and grass sway.
    const camZ = zT - AHEAD_M;
    for (const p of this.props) {
      const dz = p.prop.z - camZ;
      p.mat.opacity = dz < 0.4 ? 0 : 1 - smooth((dz - 22) / 16);
      if (p.sways) p.mesh.rotation.z = Math.sin(this.time * 0.9 + p.prop.z) * 0.025;
    }
    void START_Z;
  }
}
