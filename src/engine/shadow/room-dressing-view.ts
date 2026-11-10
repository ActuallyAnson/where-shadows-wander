// The bedroom's painted art (room-art.ts) as a few textured quads that go over Damon's bare room without changing it: wallpaper,
// shelves and pictures on the wall behind the stage, the night in the window, a bookcase on the right wall and a rug on the floor.
// Its group goes inside BedroomView's group, so it is placed and turned with the room. Candlelight warms it, and in the dark it goes
// blue and quiet, like the room around it. Textures are drawn once; update() allocates nothing.
import {
  AdditiveBlending,
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  RepeatWrapping,
  SRGBColorSpace,
  Vector3,
} from '@iwsdk/core';
import type { Material } from '@iwsdk/core';
import { BuntingView } from './bunting-view';
import { mergeBoxes } from './merge-boxes';
import type { LanternLight } from './pure/lantern-light';
import {
  castShadow,
  NIGHT_MARGIN,
  type NightLayer,
  paintBookcase,
  paintMoonPatch,
  paintNight,
  paintPillow,
  paintQuilt,
  paintRug,
  paintSill,
  paintSnow,
  paintStraw,
  paintWall,
  paintWallThings,
  paintWood,
  WALL_THINGS,
} from './room-art';
import { RenderOrder } from './pure/render-order';
import { ROOM_WALL_BEHIND_STAGE_M } from '../stage/stage-frame';

/** Colours the art is multiplied by: dark and blue by moonlight, warm and bright by the candle. */
/** Before everything else in the scene (Damon's plain front wall is -10). */
const WALL_ORDER = -11;

/** What the window shows is lit by the moon, not the candle, so it keeps one cool colour. */
const OUTSIDE_TINT = new Color(0.95, 0.98, 1.0);
/** Seconds a snowflake takes to fall the height of one tile of each layer, and how far each sways. */
const SNOW_FALL = [0.075, 0.045] as const;
const SNOW_SWAY = [0.03, 0.02] as const;

/** How far the framed pictures and the shelves stand out from the wallpaper, in metres (the shelves' keepsakes stand further). */
const PICTURES_OUT = 0.03;
const SHELVES_OUT = 0.1;
/** How deep the bookcase is, front to wall. */
/** (Slim, so it stands clear of the bed, whose edge is 2 cm from it.) */
const CASE_DEPTH = 0.14;

/** The window opening, in metres, and where it is in the room (the centre of the left wall's window). */
const WINDOW_W = 1.1;
const WINDOW_H = 1.3;
const WINDOW_Y = 1.45;
const WINDOW_Z = -0.8;
/** The outside layers, far to near: how many metres each slides across the window for every metre the head moves, and the size of
 * the canvas it is painted on. The farther the layer, the more it seems to follow the head, as the far side of a real window does. */
const OUTSIDE_LAYERS: readonly { layer: NightLayer; slide: number; w: number; h: number }[] = [
  { layer: 'sky', slide: 0.1, w: 400, h: 460 },
  { layer: 'hills', slide: 0.07, w: 520, h: 600 },
  { layer: 'village', slide: 0.045, w: 520, h: 600 },
  { layer: 'near', slide: 0.02, w: 520, h: 600 },
];
/** Share of a painted margin a layer may slide into, so a bare edge never shows. */
const SLIDE_LIMIT = 0.9;

/** Candlelight on the room: what is left of the colour far from the flame, and the distance (m) at which the light is half gone. */
const FLAME_AMBIENT = 0.08;
const FLAME_REACH = 0.85;
/**
 * The light spreading out from a newly lit candle: its reach (m) the moment it catches, and the seconds it takes to grow from that
 * to FLAME_REACH. When the candle goes out (covered, paused) the light draws back to the flame in DARKEN_S.
 */
const SPREAD_FROM_M = 0.12;
export const SPREAD_S = 8;
export const DARKEN_S = 2;
/** The reach has to change this much (m) before the walls' light is worked out again. */
const REACH_STEP = 0.015;
/** The most of its brightness the room art has at full candlelight (the paper stage is the brightest thing), and how far the flame's flicker moves it. */
const LIT_PEAK = 0.8;
const FLICKER = 0.1;
/** The flame has to move this far (m) before the walls' light is worked out again. */
const FLAME_MOVE = 0.02;

/** Things in the room that light up as the night goes, one more for each puzzle solved. */
const WONDERS = 5;
/** Seconds a wonder takes to come on (or go out). */
const WONDER_EASE_S = 2.2;
/** In front of the room's walls, to draw over them, added to what is under it. */
const WONDER_ORDER = RenderOrder.wonder;
/** How strongly the glows add to what is under them (they are magic, not floodlights). */
const WONDER_GAIN = 0.75;

interface GlowSpec {
  /** Which wonder (0 .. WONDERS - 1) lights it. */
  readonly wonder: number;
  /** Where its middle is: on the wall behind the stage in that wall's 1024 by 640 units (`wall`), or in the room in metres. */
  readonly wall?: readonly [number, number, number];
  readonly at?: readonly [number, number, number];
  readonly size: readonly [number, number];
  /** Which way it faces: the player (+z), into the room from the left wall (+x), or from the right wall (-x). */
  readonly facing: 'z' | '+x' | '-x';
  readonly colour: readonly [number, number, number];
}

/**
 * What lights up, in order: the lamp on the shelf, the bunting along the rail, the two pictures (the moon and the hill of stars),
 * the globe on the bookcase, then the window (the sill's candle, and the night outside brightening). `wall` is (x, y, lift in
 * metres off the paper).
 */
const GLOWS: readonly GlowSpec[] = [
  { wonder: 0, wall: [889, 292, 0.12], size: [0.5, 0.5], facing: 'z', colour: [1, 0.72, 0.36] },
  { wonder: 1, wall: [255, 122, 0.03], size: [1.45, 0.28], facing: 'z', colour: [0.9, 0.5, 0.42] },
  { wonder: 1, wall: [775, 122, 0.03], size: [1.45, 0.28], facing: 'z', colour: [0.9, 0.5, 0.42] },
  { wonder: 2, wall: [220, 391, 0.06], size: [0.55, 0.45], facing: 'z', colour: [0.7, 0.8, 1] },
  { wonder: 2, wall: [875, 210, 0.06], size: [0.72, 0.58], facing: 'z', colour: [0.5, 0.65, 1] },
  { wonder: 3, at: [1.8, 1.76, -1.25], size: [0.42, 0.42], facing: '-x', colour: [0.45, 0.95, 0.75] },
  { wonder: 4, at: [-1.9, 0.99, -0.71], size: [0.3, 0.3], facing: '+x', colour: [1, 0.7, 0.35] },
  { wonder: 4, at: [-1.96, 1.45, -0.8], size: [1.1, 1.3], facing: '+x', colour: [0.3, 0.5, 0.6] },
];

const MOON_TINT = new Color(0.2, 0.25, 0.4);
const CANDLE_TINT = new Color(1.0, 0.82, 0.6);

function paintedCanvas(
  w: number,
  h: number,
  paint: (g: CanvasRenderingContext2D, w: number, h: number) => void,
): HTMLCanvasElement {
  let canvas: HTMLCanvasElement | undefined;
  if (typeof document !== 'undefined') canvas = document.createElement('canvas');
  if (!canvas) canvas = { width: w, height: h, getContext: () => null } as unknown as HTMLCanvasElement;
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext ? canvas.getContext('2d') : null;
  if (g) paint(g, w, h);
  return canvas;
}

export class RoomDressingView {
  readonly group = new Group();
  /** The wallpaper wall behind the stage, kept to move it when the stage's distance is known. */
  readonly wall: Mesh;
  /** The hung pictures and shelves, held off the wall (one quad per cluster, as in WALL_THINGS); `place` keeps them in front of it. */
  private readonly things: Mesh[] = [];

  private readonly geometries: BufferGeometry[] = [];
  private readonly materials: MeshBasicMaterial[] = [];
  /** The window's own pictures (the night, the snow), which keep one cool colour whatever the room does. */
  private readonly outdoor: MeshBasicMaterial[] = [];
  private readonly snow: CanvasTexture[] = [];
  private readonly moonPatch: MeshBasicMaterial;
  /** The outside layers' textures and how far each slides with the head (parallel to OUTSIDE_LAYERS). */
  private readonly outside: CanvasTexture[] = [];
  private readonly head = new Vector3();
  private time = 0;
  private readonly textures: CanvasTexture[] = [];
  private readonly tint = new Color();
  /** The walls, lit per vertex by the candle, and the rest of the room art, lit by how far its middle is from the flame. */
  private readonly vertexLit: Mesh[] = [];
  private readonly centreLit: Mesh[] = [];
  private readonly falloff = new Map<MeshBasicMaterial, number>();
  /** Where in the flicker each piece is, so the light seems to dance across the room rather than blink all at once. */
  private readonly phase = new Map<MeshBasicMaterial, number>();
  private readonly flame = new Vector3();
  private readonly spot = new Vector3();
  private flameOn = false;
  /** How far the candle's light has spread into the room, 0 (only by the flame) .. 1 (the whole room), and the reach last lit with. */
  private spreadLevel = 0;
  private reachNow = SPREAD_FROM_M;
  /** The wonders' glow: how lit each is (0..1), how many should be lit, and the one mesh that draws them all. */
  private readonly levels = new Float32Array(WONDERS);
  private awakeCount = 0;
  private wondersWereOn = false;
  /** The swinging bunting along the picture rail on the wall behind the stage. */
  private readonly bunting = new BuntingView();
  /** How far in front of the player the wall behind the stage is (z in the room's space), set by `place`. */
  private wallZ = -2.35;
  private warmNow = 0;
  private wonders: Mesh;
  private readonly wonderMat: MeshBasicMaterial;
  private readonly wonderTexture: CanvasTexture;

  constructor() {
    // The walls are solid and drawn first, so the plain walls of Damon's room behind them fail the depth test and cost nothing
    // to draw; everything on a wall sits a hair in front of it.
    // What hangs on the wall behind the stage stands out from it, in two layers (frames, then shelves with their keepsakes); their
    // shadows are painted onto the paper, so the gap between them shows when the head moves.
    const thingCanvases = WALL_THINGS.map((spec) =>
      paintedCanvas(spec.area.w, spec.area.h, (g, w, h) => paintWallThings(g, w, h, spec.layer, spec.area)),
    );
    // The wall behind the stage (same size as Damon's front wall, a hair in front of it).
    const wallCanvas = paintedCanvas(1024, 640, (g, w, h) => {
      paintWall(g, w, h, false); // the bunting here is alive (bunting-view.ts)
      WALL_THINGS.forEach((spec, i) => {
        const far = spec.layer === 'shelves';
        castShadow(
          g,
          thingCanvases[i],
          spec.area.x,
          spec.area.y,
          far ? 16 : 6,
          far ? 22 : 9,
          far ? 16 : 7,
          far ? 0.55 : 0.5,
        );
      });
    });
    this.wall = this.quad(4, 2.5, this.texture(wallCanvas), false, true, undefined, [16, 10]);
    this.wall.position.set(0, 1.25, -2.4);
    this.wall.renderOrder = WALL_ORDER;
    WALL_THINGS.forEach((spec, i) => {
      this.things.push(this.quad(spec.area.w / 256, spec.area.h / 256, this.texture(thingCanvases[i]), true));
    });

    // The same paper and panelling on the two side walls (one material for both).
    const sideTexture = this.texture(paintedCanvas(800, 400, (g, w, h) => paintWall(g, w, h)));
    const left = this.quad(5, 2.5, sideTexture, false, true, undefined, [20, 10]);
    left.rotation.y = Math.PI / 2;
    left.position.set(-1.995, 1.25, -0.4);
    left.renderOrder = WALL_ORDER;
    const right = this.quad(5, 2.5, sideTexture, false, true, left, [20, 10]);
    right.rotation.y = -Math.PI / 2;
    right.position.set(1.995, 1.25, -0.4);
    right.renderOrder = WALL_ORDER;

    // The night in the left window, in five layers that slide against each other as the head moves, so the outside has depth: sky,
    // hills, village, near ground, then the curtains (which belong to the window and do not slide). They sit in front of the paper,
    // behind the window's frame, with two layers of snow falling between the near ground and the curtains.
    const marginU = NIGHT_MARGIN / (220 + 2 * NIGHT_MARGIN);
    const marginV = NIGHT_MARGIN / (260 + 2 * NIGHT_MARGIN);
    const nightMeshes: Mesh[] = [];
    for (let i = 0; i < OUTSIDE_LAYERS.length; i++) {
      const spec = OUTSIDE_LAYERS[i];
      const tex = this.texture(paintedCanvas(spec.w, spec.h, (g, w, h) => paintNight(g, w, h, spec.layer)));
      tex.repeat.set(1 - 2 * marginU, 1 - 2 * marginV);
      tex.offset.set(marginU, marginV);
      this.outside.push(tex);
      const layer = this.quad(WINDOW_W, WINDOW_H, tex, i > 0);
      layer.rotation.y = Math.PI / 2;
      layer.position.set(-1.99 + i * 0.0004, WINDOW_Y, WINDOW_Z);
      layer.renderOrder = i;
      this.moveToOutdoor(layer);
      nightMeshes.push(layer);
    }
    const curtains = this.quad(
      WINDOW_W,
      WINDOW_H,
      this.texture(paintedCanvas(440, 520, (g, w, h) => paintNight(g, w, h, 'curtains'))),
      true,
    );
    curtains.rotation.y = Math.PI / 2;
    curtains.position.set(-1.984, WINDOW_Y, WINDOW_Z);
    curtains.renderOrder = 6;
    this.moveToOutdoor(curtains);
    nightMeshes.push(curtains);
    const snowLayers: Mesh[] = [];
    for (let i = 0; i < 2; i++) {
      const tile = this.texture(
        paintedCanvas(256, 256, (g, w, h) => paintSnow(g, w, h, 3 + i * 7, i === 0 ? 34 : 70, i === 0 ? 5.5 : 3.2)),
      );
      tile.wrapS = tile.wrapT = RepeatWrapping;
      tile.repeat.set(i === 0 ? 2 : 3.2, i === 0 ? 2.4 : 3.8);
      this.snow.push(tile);
      const layer = this.quad(1.1, 1.3, tile, true);
      layer.rotation.y = Math.PI / 2;
      layer.position.set(-1.985 + i * 0.002, 1.45, -0.8);
      layer.renderOrder = 4 + i;
      this.moveToOutdoor(layer);
      snowLayers.push(layer);
    }

    // The sill: a fern, a paper bird on two books, a candle stub (it stands on Damon's sill, whose top is at 0.875 m).
    const sill = this.quad(0.5, 0.3, this.texture(paintedCanvas(300, 180, paintSill)), true);
    sill.rotation.y = Math.PI / 2;
    sill.position.set(-1.9, 0.875 + 0.15, -0.55);
    sill.renderOrder = 3;

    // The window's light on the floor: a slanted patch of cool moonlight cut by the cross bars, added to the floor.
    const patch = this.quad(1.7, 1.7, this.texture(paintedCanvas(256, 256, paintMoonPatch)), true);
    patch.rotation.x = -Math.PI / 2;
    patch.position.set(-0.95, 0.008, -0.8);
    patch.renderOrder = 3;
    (patch.material as MeshBasicMaterial).map!.anisotropy = 4; // the floor is seen at a slant
    this.moonPatch = patch.material as MeshBasicMaterial;
    this.moonPatch.blending = AdditiveBlending;
    this.moonPatch.polygonOffset = true;
    this.moonPatch.polygonOffsetFactor = -3;
    this.moonPatch.polygonOffsetUnits = -3;

    // The bookcase on the right wall: a box of dark wood that stands out from the wall, with its painted front on the open side.
    const caseBox = new Mesh(
      new BoxGeometry(CASE_DEPTH, 1.6, 1.0),
      new MeshBasicMaterial({
        map: this.texture(paintedCanvas(128, 128, paintWood)),
        toneMapped: false,
      }),
    );
    this.geometries.push(caseBox.geometry);
    this.materials.push(caseBox.material as MeshBasicMaterial);
    caseBox.position.set(1.988 - CASE_DEPTH / 2, 0.83, -1.25);
    const bookcase = this.quad(1.0, 1.8, this.texture(paintedCanvas(400, 720, paintBookcase)), true);
    bookcase.rotation.y = -Math.PI / 2;
    bookcase.position.set(1.988 - CASE_DEPTH - 0.002, 0.93, -1.25);

    // The bed on the right, in place of Damon's plain pallet (hidden by the caller): a wooden frame with posts and a headboard, a
    // straw mattress with buttons, a patchwork quilt folded over its foot and a linen pillow. Same spot, same size, much more to see.
    const wood = this.texture(paintedCanvas(128, 128, paintWood));
    const woodMat = (): MeshBasicMaterial => new MeshBasicMaterial({ map: wood, toneMapped: false });
    const post = new BoxGeometry(0.06, 0.3, 0.06);
    const rail = new BoxGeometry(0.04, 0.09, 1.66);
    const board = new BoxGeometry(0.9, 0.46, 0.05);
    const foot = new BoxGeometry(0.9, 0.2, 0.04);
    const frameGeo = mergeBoxes([
      { geo: post, x: 0.96, y: 0.15, z: -1.62 },
      { geo: post, x: 1.84, y: 0.15, z: -1.62 },
      { geo: post, x: 0.96, y: 0.15, z: 0.02 },
      { geo: post, x: 1.84, y: 0.15, z: 0.02 },
      { geo: rail, x: 0.97, y: 0.09, z: -0.8 },
      { geo: rail, x: 1.83, y: 0.09, z: -0.8 },
      { geo: board, x: 1.4, y: 0.25, z: -1.665 },
      { geo: foot, x: 1.4, y: 0.12, z: 0.045 },
    ]);
    for (const g of [post, rail, board, foot]) g.dispose();
    frameGeo.translate(-1.4, -0.12, 0.8); // so the mesh's own position is its middle (the candle's light is worked out from it)
    const frame = new Mesh(frameGeo, woodMat());
    frame.position.set(1.4, 0.12, -0.8);
    const mattressGeo = new BoxGeometry(0.8, 0.12, 1.62);
    const mattress = new Mesh(
      mattressGeo,
      new MeshBasicMaterial({ map: this.texture(paintedCanvas(128, 256, paintStraw)), toneMapped: false }),
    );
    mattress.position.set(1.4, 0.13, -0.8);
    const quiltGeo = new BoxGeometry(0.82, 0.05, 1.0);
    const quilt = new Mesh(
      quiltGeo,
      new MeshBasicMaterial({ map: this.texture(paintedCanvas(205, 256, paintQuilt)), toneMapped: false }),
    );
    quilt.position.set(1.4, 0.215, -0.35);
    const pillowGeo = new BoxGeometry(0.62, 0.1, 0.34);
    const pillow = new Mesh(
      pillowGeo,
      new MeshBasicMaterial({ map: this.texture(paintedCanvas(128, 64, paintPillow)), toneMapped: false }),
    );
    pillow.position.set(1.4, 0.25, -1.4);
    for (const m of [frame, mattress, quilt, pillow]) {
      this.geometries.push(m.geometry);
      this.materials.push(m.material as MeshBasicMaterial);
    }
    const bed = [frame, mattress, quilt, pillow];

    // The rug under the bed tray, a hair above the floor.
    const rug = this.quad(2.2, 1.55, this.texture(paintedCanvas(512, 360, paintRug)), true);
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(0.1, 0.004, -0.4);
    const rugMat = rug.material as MeshBasicMaterial;
    rugMat.map!.anisotropy = 4;
    rugMat.polygonOffset = true;
    rugMat.polygonOffsetFactor = -2;
    rugMat.polygonOffsetUnits = -2;

    // None of them moves inside the room: their matrices are made once (and `place` makes the wall's again), and they are
    // culled when out of view, so looking away from the bookcase or the window does not draw them.
    for (const m of [
      this.wall,
      left,
      right,
      ...nightMeshes,
      ...snowLayers,
      sill,
      patch,
      bookcase,
      rug,
      ...this.things,
      caseBox,
      ...bed,
    ]) {
      m.matrixAutoUpdate = false;
      m.updateMatrix();
    }
    this.group.add(
      this.wall,
      left,
      right,
      ...nightMeshes,
      ...snowLayers,
      sill,
      patch,
      bookcase,
      rug,
      ...this.things,
      caseBox,
      ...bed,
    );
    // The wonders: soft glows, all in one mesh (vertex colours say how lit each is), added over what they light.
    this.wonderTexture = this.texture(
      paintedCanvas(128, 128, (g, w, h) => {
        const glow = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
        glow.addColorStop(0, 'rgba(255, 255, 255, 1)');
        glow.addColorStop(0.35, 'rgba(255, 255, 255, 0.4)');
        glow.addColorStop(1, 'rgba(255, 255, 255, 0)');
        g.fillStyle = glow;
        g.fillRect(0, 0, w, h);
      }),
    );
    this.wonderMat = new MeshBasicMaterial({
      map: this.wonderTexture,
      vertexColors: true,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
      side: DoubleSide,
      toneMapped: false,
    });
    this.wonders = new Mesh(new BufferGeometry(), this.wonderMat);
    this.wonders.renderOrder = WONDER_ORDER;
    this.wonders.frustumCulled = false; // its glows are spread over the whole room
    this.wonders.matrixAutoUpdate = false;
    this.group.add(this.wonders);
    this.vertexLit.push(this.wall, left, right);
    this.group.add(this.bunting.mesh);
    this.materials.push(this.bunting.material);
    this.centreLit.push(sill, bookcase, caseBox, rug, ...this.things, ...bed, this.bunting.mesh);
    for (const m of [...this.vertexLit, ...this.centreLit]) {
      this.phase.set(m.material as MeshBasicMaterial, m.position.x * 1.3 + m.position.z * 0.9 + m.position.y * 0.4);
    }
    this.place();
    this.update({ lit: false, intensity: 0 } as Readonly<LanternLight>, 0);
  }

  /** Moves a quad's material from the room's tinted ones to the window's own. */
  private moveToOutdoor(m: Mesh): void {
    const mat = m.material as MeshBasicMaterial;
    const i = this.materials.indexOf(mat);
    if (i >= 0) this.materials.splice(i, 1);
    this.outdoor.push(mat);
  }

  private texture(canvas: HTMLCanvasElement): CanvasTexture {
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = 1;
    this.textures.push(texture);
    return texture;
  }

  private quad(
    w: number,
    h: number,
    texture: CanvasTexture,
    alpha: boolean,
    solid = false,
    shared?: Mesh,
    segments?: readonly [number, number],
  ): Mesh {
    const geometry = new PlaneGeometry(w, h, segments?.[0] ?? 1, segments?.[1] ?? 1);
    if (segments) {
      // Lit per vertex by the candle (see relight); white until then.
      geometry.setAttribute(
        'color',
        new Float32BufferAttribute(new Float32Array(geometry.attributes.position.count * 3).fill(1), 3),
      );
    }
    const material =
      (shared?.material as MeshBasicMaterial | undefined) ??
      new MeshBasicMaterial({
        map: texture,
        transparent: alpha,
        depthWrite: solid,
        side: DoubleSide,
        toneMapped: false,
        vertexColors: segments !== undefined,
      });
    this.geometries.push(geometry);
    if (!shared) this.materials.push(material);
    return new Mesh(geometry, material);
  }

  /** Puts the wallpaper wall just in front of Damon's front wall, and the pictures and shelves in front of that (`stageDist` is how far the stage is from the player). */
  place(stageDist = 2.0): void {
    const z = -(Math.max(stageDist, 1.5) + ROOM_WALL_BEHIND_STAGE_M) + 0.012;
    this.wallZ = z;
    this.wall.position.set(0, 1.25, z);
    this.wall.updateMatrix();
    WALL_THINGS.forEach((spec, i) => {
      const m = this.things[i];
      m.position.set(
        ((spec.area.x + spec.area.w / 2) / 1024) * 4 - 2,
        2.5 - ((spec.area.y + spec.area.h / 2) / 640) * 2.5,
        z + (spec.layer === 'shelves' ? SHELVES_OUT : PICTURES_OUT),
      );
      m.updateMatrix();
    });
    this.bunting.place(z + 0.05);
    this.buildWonders(z);
    this.relight();
  }

  /**
   * Lights the art like the room: dark and blue by moonlight, and by candlelight warm near the flame and dark far from it (`flame` is
   * the flame's world position; without it the candle lights everything evenly). Same other arguments as BedroomView.update.
   */
  update(light: Readonly<LanternLight>, occlusion = 1, flame?: ArrayLike<number>): void {
    const brightness = light.lit ? Math.max(0.04, occlusion * (0.2 + 0.8 * light.intensity)) : 0.04;
    const warm = Math.min(1, Math.max(0, (brightness - 0.04) / 0.5));
    this.warmNow = warm;
    this.tint.copy(MOON_TINT).lerp(CANDLE_TINT, warm);
    const k = 0.5 + 0.5 * Math.min(1, brightness);
    this.tint.multiplyScalar(warm > 0 ? k * LIT_PEAK : 1);
    // Where the flame is (in the room's own space), and whether it lights the room at all.
    if (light.lit && flame) {
      this.group.worldToLocal(this.spot.set(flame[0], flame[1], flame[2]));
      if (!this.flameOn || this.spot.distanceToSquared(this.flame) > FLAME_MOVE * FLAME_MOVE) {
        this.flame.copy(this.spot);
        this.flameOn = true;
        this.relight();
      }
    } else if (this.flameOn) {
      this.flameOn = false;
      this.relight();
    }
    // The flame's flicker: a few sines of different speeds, a different moment for each piece, only when the candle lights the room.
    const time = this.time;
    for (const m of this.materials) {
      const p = this.phase.get(m) ?? 0;
      const flicker = this.flameOn
        ? 1 +
          FLICKER *
            (0.5 * Math.sin(time * 6.1 + p) +
              0.3 * Math.sin(time * 9.7 + 1.7 * p) +
              0.2 * Math.sin(time * 2.3 + 0.6 * p))
        : 1;
      m.color.copy(this.tint).multiplyScalar((this.falloff.get(m) ?? 1) * flicker);
    }
    for (const m of this.outdoor) m.color.copy(OUTSIDE_TINT);
    // The moonlight on the floor shrinks into the room's light when the candle is bright.
    const moonK = 0.3 - 0.2 * warm;
    this.moonPatch.color.setRGB(0.5 * moonK, 0.62 * moonK, moonK);
  }

  /**
   * The candle's light spreading through the room: while `lit` it grows out from the flame to the whole room over SPREAD_S, and
   * when the candle goes out it draws back in DARKEN_S. Call once a frame. Allocates nothing.
   */
  spread(lit: boolean, dt: number): void {
    const step = dt > 0 ? Math.min(dt, 0.1) : 0;
    this.spreadLevel = lit
      ? Math.min(1, this.spreadLevel + step / SPREAD_S)
      : Math.max(0, this.spreadLevel - step / DARKEN_S);
    const s = this.spreadLevel;
    const eased = s * s * (3 - 2 * s);
    const want = SPREAD_FROM_M + (FLAME_REACH - SPREAD_FROM_M) * eased;
    if (Math.abs(want - this.reachNow) >= REACH_STEP || (s >= 1 && want !== this.reachNow)) {
      this.reachNow = want;
      if (this.flameOn) this.relight();
    }
  }

  /** How far the candle's light has spread into the room, 0 .. 1. */
  get spreadAmount(): number {
    return this.spreadLevel;
  }

  /** How much of the candle's light reaches a point `d2` (squared metres) from the flame: all of it close by, little far away. */
  private reach(d2: number): number {
    return FLAME_AMBIENT + (1 - FLAME_AMBIENT) / (1 + d2 / (this.reachNow * this.reachNow));
  }

  /** Works out the candle's light on every wall vertex and on the middle of each other piece (when the flame moves or goes out). */
  private relight(): void {
    for (const mesh of this.vertexLit) {
      const position = mesh.geometry.attributes.position;
      const color = mesh.geometry.attributes.color;
      for (let i = 0; i < position.count; i++) {
        let f = 1;
        if (this.flameOn) {
          this.spot.fromBufferAttribute(position, i).applyMatrix4(mesh.matrix);
          f = this.reach(this.spot.distanceToSquared(this.flame));
        }
        color.setXYZ(i, f, f, f);
      }
      color.needsUpdate = true;
    }
    for (const mesh of this.centreLit) {
      this.falloff.set(
        mesh.material as MeshBasicMaterial,
        this.flameOn ? this.reach(mesh.position.distanceToSquared(this.flame)) : 1,
      );
    }
  }

  /** Where the sleeper `index` (0 = the lamp .. 4 = the window) is, in the world: the point the spark flies to. Writes into `out` and returns it. */
  wakePoint(index: number, out: Vector3): Vector3 {
    const i = Math.max(0, Math.min(WONDERS - 1, Math.floor(index) || 0));
    const spec = GLOWS.find((g) => g.wonder === i) ?? GLOWS[0];
    if (spec.wall) out.set((spec.wall[0] / 1024) * 4 - 2, 2.5 - (spec.wall[1] / 640) * 2.5, this.wallZ + spec.wall[2]);
    else out.set(spec.at![0], spec.at![1], spec.at![2]);
    this.group.updateWorldMatrix(true, false);
    return this.group.localToWorld(out);
  }

  /** The wind along the wall, for the bunting (the fan puzzle blows it hard; see bunting-view.ts). */
  setWind(wind: number): void {
    this.bunting.setWind(wind);
  }

  /** Sets the bunting swinging from where the spark lands on it. */
  rippleBunting(): void {
    this.bunting.ripple(-1.0, 2.02, 3.5, 0.7);
  }

  /** Lights the room's wonders up to `count` of them, in order (each eases on over a couple of seconds; fewer than before puts the later ones out). */
  setAwake(count: number): void {
    this.awakeCount = Math.max(0, Math.min(WONDERS, Math.floor(count) || 0));
  }

  /** (Re)builds the one mesh of glows: those on the wall follow the wall's depth `z`. */
  private buildWonders(z: number): void {
    const parts: { geo: BufferGeometry; x: number; y: number; z: number }[] = [];
    for (const spec of GLOWS) {
      const geo = new PlaneGeometry(spec.size[0], spec.size[1]);
      if (spec.facing === '+x') geo.rotateY(Math.PI / 2);
      else if (spec.facing === '-x') geo.rotateY(-Math.PI / 2);
      if (spec.wall) {
        parts.push({
          geo,
          x: (spec.wall[0] / 1024) * 4 - 2,
          y: 2.5 - (spec.wall[1] / 640) * 2.5,
          z: z + spec.wall[2],
        });
      } else {
        parts.push({ geo, x: spec.at![0], y: spec.at![1], z: spec.at![2] });
      }
    }
    const merged = mergeBoxes(parts);
    for (const p of parts) p.geo.dispose();
    merged.setAttribute('color', new Float32BufferAttribute(new Float32Array(GLOWS.length * 4 * 3), 3));
    this.wonders.geometry.dispose();
    this.wonders.geometry = merged;
    this.paintWonders();
  }

  /** Sets every glow's colour from how lit its wonder is now (a small flicker, dimmer when the candle is covered). */
  private paintWonders(): void {
    const color = this.wonders.geometry.attributes.color;
    if (!color) return;
    const dim = 0.35 + 0.65 * this.warmNow;
    for (let i = 0; i < GLOWS.length; i++) {
      const spec = GLOWS[i];
      const level = this.levels[spec.wonder];
      const shimmer = 0.88 + 0.12 * Math.sin(this.time * (2.6 + spec.wonder * 0.7) + i * 1.9);
      const k = level * dim * shimmer * WONDER_GAIN;
      for (let v = 0; v < 4; v++) color.setXYZ(i * 4 + v, spec.colour[0] * k, spec.colour[1] * k, spec.colour[2] * k);
    }
    color.needsUpdate = true;
  }

  /**
   * Moves the snow outside the window and slides the outside layers against each other for where the head is (call once a frame
   * with the frame's seconds and the head's world position). Allocates nothing.
   */
  tick(dt: number, headWorld?: Readonly<{ x: number; y: number; z: number }>): void {
    if (headWorld) this.slideOutside(this.group.worldToLocal(this.head.set(headWorld.x, headWorld.y, headWorld.z)));
    if (!(dt > 0)) return;
    this.time += Math.min(dt, 0.1);
    this.easeWonders(Math.min(dt, 0.1));
    this.bunting.update(Math.min(dt, 0.1));
    for (let i = 0; i < this.snow.length; i++) {
      const t = this.snow[i];
      t.offset.y += Math.min(dt, 0.1) * SNOW_FALL[i];
      t.offset.x = Math.sin(this.time * (0.5 + i * 0.3)) * SNOW_SWAY[i];
    }
  }

  private easeWonders(dt: number): void {
    let any = false;
    for (let i = 0; i < WONDERS; i++) {
      const goal = i < this.awakeCount ? 1 : 0;
      const step = dt / WONDER_EASE_S;
      this.levels[i] = Math.max(
        0,
        Math.min(1, this.levels[i] + Math.max(-step, Math.min(step, goal - this.levels[i]))),
      );
      if (this.levels[i] > 0) any = true;
    }
    if (any || this.wondersWereOn) this.paintWonders();
    this.wondersWereOn = any;
  }

  /** A layer's picture slides across the window with the head, by less the nearer the layer is, and never past its painted margin. */
  private slideOutside(head: Readonly<Vector3>): void {
    // Across the window runs along -z (the pictures' left to right), up is y.
    const dx = head.z - WINDOW_Z;
    const dy = head.y - WINDOW_Y;
    const textureW = (WINDOW_W * (220 + 2 * NIGHT_MARGIN)) / 220;
    const textureH = (WINDOW_H * (260 + 2 * NIGHT_MARGIN)) / 260;
    const limitU = (NIGHT_MARGIN / (220 + 2 * NIGHT_MARGIN)) * SLIDE_LIMIT;
    const limitV = (NIGHT_MARGIN / (260 + 2 * NIGHT_MARGIN)) * SLIDE_LIMIT;
    const baseU = NIGHT_MARGIN / (220 + 2 * NIGHT_MARGIN);
    const baseV = NIGHT_MARGIN / (260 + 2 * NIGHT_MARGIN);
    for (let i = 0; i < this.outside.length; i++) {
      const k = OUTSIDE_LAYERS[i].slide;
      const u = Math.max(-limitU, Math.min(limitU, (dx * k) / textureW));
      const v = Math.max(-limitV, Math.min(limitV, (-dy * k) / textureH));
      this.outside[i].offset.set(baseU + u, baseV + v);
    }
  }

  dispose(): void {
    this.wonders.geometry.dispose();
    this.wonderMat.dispose();
    this.bunting.dispose();
    for (const t of this.textures) t.dispose();
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials as Material[]) m.dispose();
    for (const m of this.outdoor as Material[]) m.dispose();
  }
}
