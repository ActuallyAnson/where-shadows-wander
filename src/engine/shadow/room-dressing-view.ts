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
  DataTexture,
  DoubleSide,
  Float32BufferAttribute,
  FrontSide,
  Group,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  RepeatWrapping,
  RGBAFormat,
  SRGBColorSpace,
  UnsignedByteType,
  Vector3,
} from '@iwsdk/core';
import type { Material, Object3D } from '@iwsdk/core';
import { mergeBoxes } from './merge-boxes';
import type { LanternLight } from './pure/lantern-light';
import {
  NIGHT_MARGIN,
  RAIN_SLANT,
  type NightLayer,
  paintBookcase,
  paintMoonPatch,
  paintNight,
  paintPillow,
  paintQuilt,
  paintRain,
  paintRug,
  paintSill,
  paintStraw,
  paintWall,
  paintWallThings,
  paintWood,
  WALL_THINGS,
} from './room-art';
import { RenderOrder } from './pure/render-order';
import { plasterNormals } from './pure/plaster-bump';
import { ROOM_WALL_BEHIND_STAGE_M } from '../stage/stage-frame';
import { CANDLE_REACH_M, type CandleBump, type CandleLight } from './candle-light';
import type { StandIn } from './room-models';
import { placementOr, type RoomLayout } from '../stage/room-layout';
import { applyPlacement, readPlacement, type EditablePiece, type EditableSource } from './room-placement';

/** Colours the art is multiplied by: dark and blue by moonlight, warm and bright by the candle. */
/** Before everything else in the scene (Damon's plain front wall is -10). */
const WALL_ORDER = -11;

/**
 * What the window shows is lit by the moon, not the candle, so it keeps one cool colour: a deep, dim night blue, so the window
 * is a faint shape in the dark room rather than its brightest thing.
 */
const OUTSIDE_TINT = new Color(0.22, 0.26, 0.38);
/** Tiles of each rain layer (near, far) that fall past in a second. */
const RAIN_FALL = [2.2, 1.5] as const;
/** The colour the window takes at the height of a lightning flash (it eases there from OUTSIDE_TINT by the flash). */
const FLASH_TINT = new Color(0.62, 0.68, 0.82);
/** How much a flash adds to the moonlight's patch on the floor, as a multiple of its usual brightness. */
const FLASH_PATCH = 2.5;

/** How far the framed pictures and the shelves stand out from the wallpaper, in metres (the shelves' keepsakes stand further). */
const PICTURES_OUT = 0.03;
const SHELVES_OUT = 0.1;
/**
 * Where each cluster of WALL_THINGS hangs (by its index there): on the right wall (`-x`, facing into the room) or the left (`+x`),
 * its middle at (z, y) metres, or `null` to leave it out. None hangs on the wall behind the stage, which is kept clear for play.
 */
const HUNG: readonly ({ readonly wall: '+x' | '-x'; readonly z: number; readonly y: number } | null)[] = [
  { wall: '-x', z: -1.05, y: 1.45 }, // the bird and the moon, over the bed
  { wall: '-x', z: -0.2, y: 1.6 }, // the hill, over the bed's foot
  { wall: '+x', z: 0.8, y: 1.35 }, // the shelf of books, boat and lamp, on the left wall behind the window
  null, // the jar and plant shelf
];
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

/**
 * The light spreading out from the candle: its reach (m) with no flame, and the seconds it takes to grow from that to
 * CANDLE_REACH_M when the candle is relit with no hold (after the pause). The first time, it grows with the hold on the wick
 * instead, so the room is lit as the candle catches, not after. When the candle goes out (covered, paused) the light draws back
 * to the flame in DARKEN_S.
 */
const SPREAD_FROM_M = 0.2;
export const SPREAD_S = 1.5;
export const DARKEN_S = 2;
/** The room art's own colour, as a share of its painted colour (the light multiplies it). */
const LIT_PEAK = 1.0;
/** How bright the moonlight's patch on the floor is (it is added to the floor). */
const MOON_PATCH = 0.07;
/** How bright the candle's glow is at the end of the hold that lights it, as it catches (its full brightness is about 1). */
const IGNITION_GLOW = 0.9;
/**
 * How bright the candle's small pool of light is while it waits to be lit (`waiting`), before the hold on the wick: bright, but
 * only about SPREAD_FROM_M across, so the eye goes to the candle first. The hold then spreads it out to the room.
 */
const WAITING_GLOW = 3.5;
/** Seconds the glow from the hold takes to hand over to the burning flame's light (which fades in), so there is no dip. */
const HANDOVER_S = 0.6;

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
  /** The room piece it glows on (a layout id): it moves with that piece when the room layout moves it from its default. */
  readonly follows?: string;
  /** Where its middle is: on the wall behind the stage in that wall's 1024 by 640 units (`wall`), or in the room in metres. */
  readonly wall?: readonly [number, number, number];
  readonly at?: readonly [number, number, number];
  readonly size: readonly [number, number];
  /** Which way it faces: the player (+z), into the room from the left wall (+x), or from the right wall (-x). */
  readonly facing: 'z' | '+x' | '-x';
  readonly colour: readonly [number, number, number];
}

/**
 * What lights up, in order: the lamp on the shelf, (nothing: the bunting that was here is gone), the two pictures (the moon and
 * the hill of stars), the globe on the bookcase, then the window (the sill's candle, and the night outside brightening). The shelf
 * and the pictures hang on the side walls (HUNG); the wall behind the stage is bare, for the story. `wall` is (x, y, lift in metres off the paper).
 */
const GLOWS: readonly GlowSpec[] = [
  // The lamp on the shelf (left wall, HUNG[2]), the moon and the hill (right wall, HUNG[0] and HUNG[1]).
  { wonder: 0, follows: 'shelf', at: [-1.875, 1.45, 0.55], size: [0.5, 0.5], facing: '+x', colour: [1, 0.72, 0.36] },
  {
    wonder: 2,
    follows: 'picture-moon',
    at: [1.935, 1.05, -1.05],
    size: [0.55, 0.45],
    facing: '-x',
    colour: [0.7, 0.8, 1],
  },
  {
    wonder: 2,
    follows: 'picture-hill',
    at: [1.935, 1.6, -0.2],
    size: [0.72, 0.58],
    facing: '-x',
    colour: [0.5, 0.65, 1],
  },
  // The bookcase (room-models.ts: its open front at x 1.61, 1.32 m high).
  {
    wonder: 3,
    follows: 'bookcase',
    at: [1.58, 1.0, 0.55],
    size: [0.42, 0.42],
    facing: '-x',
    colour: [0.45, 0.95, 0.75],
  },
  { wonder: 4, follows: 'sill', at: [-1.9, 0.99, -0.71], size: [0.3, 0.3], facing: '+x', colour: [1, 0.7, 0.35] },
  { wonder: 4, at: [-1.96, 1.45, -0.8], size: [1.1, 1.3], facing: '+x', colour: [0.3, 0.5, 0.6] },
];

/** The hung pieces' ids in the room layout file, by their index in HUNG (null where nothing hangs). */
const HUNG_IDS: readonly (string | null)[] = ['picture-moon', 'picture-hill', 'shelf', null];

/** The pieces of the room dressing the room layout file places (`room` section). */
export const DRESSING_PIECE_IDS: readonly string[] = [
  ...HUNG_IDS.filter((id): id is string => id !== null),
  'sill',
  'moon-patch',
];

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

/** How wide one tile of the plaster's lumps is on the wall (m), and its texture's size (px). */
const PLASTER_TILE_M = 0.6;
const PLASTER_PX = 256;

/** The plaster's normal map as a repeating texture, mipmapped so it calms into flat with distance instead of shimmering. */
function plasterTexture(): DataTexture {
  const t = new DataTexture(plasterNormals(PLASTER_PX, 5, 2), PLASTER_PX, PLASTER_PX, RGBAFormat, UnsignedByteType);
  t.wrapS = RepeatWrapping;
  t.wrapT = RepeatWrapping;
  t.magFilter = LinearFilter;
  t.minFilter = LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

export class RoomDressingView implements EditableSource {
  readonly group = new Group();
  /** The pieces the room layout places (the pictures, the shelf, the sill, the moonlight's patch), for the room editor. */
  private readonly pieces: EditablePiece[] = [];
  /** Pieces the glows follow (these and the furniture), by id: a glow moves as far as its piece is from its default. */
  private readonly followed = new Map<string, EditablePiece>();
  private readonly scratch = new Vector3();
  /** The wallpaper wall behind the stage, kept to move it when the stage's distance is known. */
  readonly wall: Mesh;
  /** The hung pictures and shelves, held off the wall (one quad per cluster, as in WALL_THINGS); `place` keeps them in front of it. */
  private readonly things: Mesh[] = [];

  private readonly geometries: BufferGeometry[] = [];
  private readonly materials: MeshBasicMaterial[] = [];
  /** The window's own pictures (the night, the rain), which keep one cool colour whatever the room does. */
  private readonly outdoor: MeshBasicMaterial[] = [];
  private readonly rain: CanvasTexture[] = [];
  private readonly moonPatch: MeshBasicMaterial;
  /** The outside layers' textures and how far each slides with the head (parallel to OUTSIDE_LAYERS). */
  private readonly outside: CanvasTexture[] = [];
  private readonly head = new Vector3();
  private time = 0;
  private readonly textures: CanvasTexture[] = [];
  /** The room art the candle lights (the walls, and everything on and by them), and the props that cast its shadows. */
  private readonly lit: Mesh[] = [];
  private readonly casters: Mesh[] = [];
  /** The walls' plaster, as a normal map the candle's light catches (plaster-bump.ts), and which materials it is on. */
  private readonly plaster = plasterTexture();
  private readonly bumps = new Map<MeshBasicMaterial, CandleBump>();
  /** The painted bed, bookcase and rug, hidden when real models take their place (room-models.ts). */
  private readonly standIns: Record<StandIn, Mesh[]> = { bed: [], bookcase: [], rug: [] };

  private flameOn = false;
  /** The candle as a light (candle-light.ts), once `useCandleLight` is called: it lights the art per pixel and casts the shadows. */
  private candle: CandleLight | null = null;
  /** How far the candle's light has spread into the room, 0 (only by the flame) .. 1 (the whole room), and its reach now (m). */
  private spreadLevel = 0;
  private reachNow = SPREAD_FROM_M;
  /** The wonders' glow: how lit each is (0..1), how many should be lit, and the one mesh that draws them all. */
  private readonly levels = new Float32Array(WONDERS);
  private awakeCount = 0;
  private wondersWereOn = false;
  /** How far in front of the player the wall behind the stage is (z in the room's space), set by `place`. */
  private wallZ = -2.35;
  private warmNow = 0;
  private wonders: Mesh;
  private readonly wonderMat: MeshBasicMaterial;
  private readonly wonderTexture: CanvasTexture;

  /** @param layout where the pictures, the shelf, the sill and the moonlight's patch are (the room layout file); defaults where it says nothing */
  constructor(private readonly layout: Readonly<RoomLayout> | null = null) {
    // The walls are solid and drawn first, so the plain walls of Damon's room behind them fail the depth test and cost nothing
    // to draw; everything on a wall sits a hair in front of it.
    // The pictures and the shelf hang on the side walls (HUNG), standing out from them (frames, then the shelf with its
    // keepsakes); the wall behind the stage is left clear for the shadows. The candle casts their shadows (candle-light.ts), so
    // the gap between them and the wall shows when the head moves, and the shadows move with the flame.
    // The wall behind the stage (same size as Damon's front wall, a hair in front of it).
    const wallCanvas = paintedCanvas(1024, 640, (g, w, h) => {
      paintWall(g, w, h);
    });
    this.wall = this.quad(4, 2.5, this.texture(wallCanvas), false, true, undefined, [16, 10]);
    this.wall.position.set(0, 1.25, -2.4);
    this.wall.renderOrder = WALL_ORDER;
    WALL_THINGS.forEach((spec, i) => {
      const hung = HUNG[i];
      if (!hung) return;
      const canvas = paintedCanvas(spec.area.w, spec.area.h, (g, w, h) =>
        paintWallThings(g, w, h, spec.layer, spec.area),
      );
      const m = this.quad(spec.area.w / 256, spec.area.h / 256, this.texture(canvas), true);
      const out = spec.layer === 'shelves' ? SHELVES_OUT : PICTURES_OUT;
      m.rotation.y = hung.wall === '+x' ? Math.PI / 2 : -Math.PI / 2;
      m.position.set(hung.wall === '+x' ? -1.995 + out : 1.995 - out, hung.y, hung.z);
      this.editable(HUNG_IDS[i]!, m);
      this.things.push(m);
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
    // The walls all face into the room, so they are one-sided: from inside nothing changes, and from outside (the room editor's
    // views) the near walls drop away and the room can be seen into, like Damon's own walls, floor and ceiling.
    for (const m of [this.wall, left]) (m.material as MeshBasicMaterial).side = FrontSide;

    // The night in the left window, in five layers that slide against each other as the head moves, so the outside has depth: sky,
    // hills, village, near ground, then the curtains (which belong to the window and do not slide). They sit in front of the paper,
    // behind the window's frame, with two layers of rain falling between the near ground and the curtains.
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
    const rainLayers: Mesh[] = [];
    for (let i = 0; i < 2; i++) {
      // Near: fewer, longer streaks; far: more, shorter and finer (a smaller tile repeated more).
      const tile = this.texture(
        paintedCanvas(256, 256, (g, w, h) => paintRain(g, w, h, 3 + i * 7, i === 0 ? 38 : 70, i === 0 ? 46 : 30)),
      );
      tile.wrapS = tile.wrapT = RepeatWrapping;
      tile.repeat.set(i === 0 ? 2 : 3.2, i === 0 ? 2.4 : 3.8);
      this.rain.push(tile);
      const layer = this.quad(1.1, 1.3, tile, true);
      layer.rotation.y = Math.PI / 2;
      layer.position.set(-1.985 + i * 0.002, 1.45, -0.8);
      layer.renderOrder = 4 + i;
      this.moveToOutdoor(layer);
      rainLayers.push(layer);
    }

    // The sill: a fern, a paper bird on two books, a candle stub (it stands on Damon's sill, whose top is at 0.875 m).
    const sill = this.quad(0.5, 0.3, this.texture(paintedCanvas(300, 180, paintSill)), true);
    sill.rotation.y = Math.PI / 2;
    sill.position.set(-1.9, 0.875 + 0.15, -0.55);
    sill.renderOrder = 3;
    this.editable('sill', sill);

    // The window's light on the floor: a slanted patch of cool moonlight cut by the cross bars, added to the floor.
    const patch = this.quad(1.7, 1.7, this.texture(paintedCanvas(256, 256, paintMoonPatch)), true);
    patch.rotation.x = -Math.PI / 2;
    patch.position.set(-0.95, 0.008, -0.8);
    patch.renderOrder = 3;
    this.editable('moon-patch', patch);
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
    this.standIns.bookcase = [caseBox, bookcase];
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
    this.standIns.bed = bed;

    // The rug under the bed tray, a hair above the floor.
    const rug = this.quad(2.2, 1.55, this.texture(paintedCanvas(512, 360, paintRug)), true);
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(0.1, 0.004, -0.4);
    const rugMat = rug.material as MeshBasicMaterial;
    rugMat.map!.anisotropy = 4;
    rugMat.polygonOffset = true;
    rugMat.polygonOffsetFactor = -2;
    rugMat.polygonOffsetUnits = -2;
    this.standIns.rug = [rug];

    // None of them moves inside the room: their matrices are made once (and `place` makes the wall's again), and they are
    // culled when out of view, so looking away from the bookcase or the window does not draw them.
    for (const m of [
      this.wall,
      left,
      right,
      ...nightMeshes,
      ...rainLayers,
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
      ...rainLayers,
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
    this.lit.push(this.wall, left, right, sill, bookcase, caseBox, rug, ...this.things, ...bed);
    // The walls are plaster: the candle catches its lumps (one tile about every PLASTER_TILE_M).
    this.bumps.set(this.wall.material as MeshBasicMaterial, {
      map: this.plaster,
      repeat: [4 / PLASTER_TILE_M, 2.5 / PLASTER_TILE_M],
    });
    this.bumps.set(left.material as MeshBasicMaterial, {
      map: this.plaster,
      repeat: [5 / PLASTER_TILE_M, 2.5 / PLASTER_TILE_M],
    });
    // The props that stand in the candle's light.
    this.casters.push(...this.things, caseBox, ...bed);
    this.place();

    this.update({ lit: false, intensity: 0 } as Readonly<LanternLight>, 0);
  }

  /** Makes a piece editable: where the code just put it is its default, and the layout file may put it elsewhere. */
  private editable(id: string, o: Object3D): void {
    o.name = id;
    const fallback = readPlacement(o);
    applyPlacement(o, placementOr(this.layout, 'room', id, fallback));
    const piece: EditablePiece = { id, section: 'room', object: o, fallback };
    this.pieces.push(piece);
    this.followed.set(id, piece);
  }

  /** The pictures, the shelf, the sill and the moonlight's patch, for the room editor. */
  editables(): readonly EditablePiece[] {
    return this.pieces;
  }

  /** A piece moved (in the editor): the glows that follow it go with it, and the candle's shadows are cast again. */
  moved(): void {
    this.buildWonders(this.wallZ);
    this.candle?.rebake();
  }

  /** Lets a glow follow a piece another view owns (the bookcase model, room-models.ts). */
  follow(piece: EditablePiece): void {
    this.followed.set(piece.id, piece);
    this.buildWonders(this.wallZ);
  }

  /** Where a glow authored at `at` is now: moved as far as the piece it follows is from that piece's default. */
  private glowAt(spec: GlowSpec, out: Vector3): Vector3 {
    out.set(spec.at![0], spec.at![1], spec.at![2]);
    const piece = spec.follows ? this.followed.get(spec.follows) : undefined;
    if (piece) {
      const p = piece.object.position,
        d = piece.fallback.pos;
      out.x += p.x - d[0];
      out.y += p.y - d[1];
      out.z += p.z - d[2];
    }
    return out;
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

  /**
   * Puts the wallpaper wall just in front of Damon's front wall, and the pictures and shelves in front of that (`stageDist` is how
   * far the stage is ahead of the player, and `playerZ` where the player sits in room space: the wall is that far ahead of them).
   */
  place(stageDist = 2.0, playerZ = 0): void {
    const z = playerZ - (Math.max(stageDist, 1.5) + ROOM_WALL_BEHIND_STAGE_M) + 0.012;
    this.wallZ = z;
    this.wall.position.set(0, 1.25, z);
    this.wall.updateMatrix();
    this.buildWonders(z);
    this.candle?.rebake(); // the props moved with the wall
  }

  /**
   * Makes the candle a real light for the room (candle-light.ts), the room's one lighting model: the art keeps its own colours,
   * lit per pixel by the moon's faint blue light everywhere plus the candle's, by how far each point is from the flame and how
   * squarely it faces it; and the pictures, shelves, bookcase and bed cast the candle's shadows. Call once.
   */
  useCandleLight(candle: CandleLight): void {
    this.candle = candle;
    for (const m of this.lit) {
      const material = m.material as MeshBasicMaterial;
      material.color.setScalar(LIT_PEAK); // the art's own colour; the light does the rest
      candle.light(material, this.bumps.get(material));
    }
    for (const m of this.casters) candle.cast(m);
  }

  /** Hides a painted bed, bookcase or rug (a real model stands there now); hidden, it casts no shadow either. */
  hideStandIn(part: StandIn): void {
    for (const m of this.standIns[part]) m.visible = false;
    this.candle?.rebake();
  }

  /** How far the lighting of the candle has got (0..1, the title's hold on the wick): the room starts to glow before it catches. */
  ignition = 0;
  /** Whether the candle is waiting to be lit for the first time: then it holds a small, bright pool of light (WAITING_GLOW). */
  waiting = false;
  /** How bright a lightning flash is on the window now (0..1; storm.ts): the outside and the moonlight on the floor brighten with it. */
  lightning = 0;
  /** The glow the hold had reached, held while the newly lit flame's own light fades in (see HANDOVER_S). */
  private glowCarry = 0;

  /**
   * Sets the candle's light on the room from the lantern (`flame` is the flame's world position): its brightness, flicker and
   * covering (`occlusion`) included, and while it is being lit, a glow that grows with `ignition`. Same other arguments as
   * BedroomView.update.
   */
  update(light: Readonly<LanternLight>, occlusion = 1, flame?: ArrayLike<number>): void {
    const ig = this.ignition > 0 ? Math.min(1, this.ignition) : 0;
    // The glow grows with the hold as a wick catching does: slowly at first, then quickly.
    const glow = IGNITION_GLOW * ig * ig * (3 - 2 * ig);
    let brightness: number;
    if (light.lit) {
      brightness = Math.max(occlusion * (0.2 + 0.8 * light.intensity), this.glowCarry * occlusion);
    } else {
      brightness = this.waiting ? Math.max(glow, WAITING_GLOW) : glow;
      this.glowCarry = brightness;
    }
    this.warmNow = Math.min(1, Math.max(0, brightness / 0.5));
    this.flameOn = brightness > 0 && flame !== undefined;
    this.candle?.set(brightness, flame ?? null, this.reachNow);
    const flash = this.lightning > 0 ? Math.min(1, this.lightning) : 0;
    for (const m of this.outdoor) m.color.copy(OUTSIDE_TINT).lerp(FLASH_TINT, flash);
    // The moonlight on the floor stays as it is (the candle adds its light, it never takes the moon's away), but for a flash.
    const patch = MOON_PATCH * (1 + FLASH_PATCH * flash);
    this.moonPatch.color.setRGB(0.5 * patch, 0.62 * patch, patch);
  }
  /**
   * The candle's light spreading through the room: while `lit` it grows out from the flame to the whole room over SPREAD_S, and
   * when the candle goes out it draws back in DARKEN_S. Call once a frame. Allocates nothing.
   */
  spread(lit: boolean, dt: number): void {
    const step = dt > 0 ? Math.min(dt, 0.1) : 0;
    this.glowCarry = Math.max(0, this.glowCarry - step / HANDOVER_S);
    if (lit) this.spreadLevel = Math.min(1, this.spreadLevel + step / SPREAD_S);
    else {
      // Unlit, the light reaches as far as the hold on the wick has got (it follows the hold both ways), else draws back.
      const ig = this.ignition > 0 ? Math.min(1, this.ignition) : 0;
      this.spreadLevel = Math.max(ig, this.spreadLevel - step / DARKEN_S);
    }
    const s = this.spreadLevel;
    const eased = s * s * (3 - 2 * s);
    this.reachNow = SPREAD_FROM_M + (CANDLE_REACH_M - SPREAD_FROM_M) * eased;
  }

  /** How far the candle's light has spread into the room, 0 .. 1. */
  get spreadAmount(): number {
    return this.spreadLevel;
  }

  /** How far the candle's light reaches now, metres (its half-light distance; it grows as the light spreads). */
  get reach(): number {
    return this.reachNow;
  }
  /** Where the sleeper `index` (0 = the lamp .. 4 = the window) is, in the world: the point the spark flies to. Writes into `out` and returns it. */
  wakePoint(index: number, out: Vector3): Vector3 {
    const i = Math.max(0, Math.min(WONDERS - 1, Math.floor(index) || 0));
    const spec = GLOWS.find((g) => g.wonder === i) ?? GLOWS[0];
    if (spec.wall) out.set((spec.wall[0] / 1024) * 4 - 2, 2.5 - (spec.wall[1] / 640) * 2.5, this.wallZ + spec.wall[2]);
    else this.glowAt(spec, out);
    this.group.updateWorldMatrix(true, false);
    return this.group.localToWorld(out);
  }

  /** Where the window is, in the world (the middle of the glass): where the rain and the thunder are heard from. Writes into `out` and returns it. */
  windowPoint(out: Vector3): Vector3 {
    out.set(-1.95, WINDOW_Y, WINDOW_Z);
    this.group.updateWorldMatrix(true, false);
    return this.group.localToWorld(out);
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
        const at = this.glowAt(spec, this.scratch);
        parts.push({ geo, x: at.x, y: at.y, z: at.z });
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
   * Moves the rain outside the window and slides the outside layers against each other for where the head is (call once a frame
   * with the frame's seconds and the head's world position). Allocates nothing.
   */
  tick(dt: number, headWorld?: Readonly<{ x: number; y: number; z: number }>): void {
    if (headWorld) this.slideOutside(this.group.worldToLocal(this.head.set(headWorld.x, headWorld.y, headWorld.z)));
    if (!(dt > 0)) return;
    this.time += Math.min(dt, 0.1);
    this.easeWonders(Math.min(dt, 0.1));
    for (let i = 0; i < this.rain.length; i++) {
      // Down and along the streaks' lean, kept in 0..1 so the offsets never grow large enough to lose precision.
      const t = this.rain[i];
      const fall = Math.min(dt, 0.1) * RAIN_FALL[i];
      t.offset.y = (t.offset.y + fall) % 1;
      t.offset.x = (t.offset.x + fall * RAIN_SLANT) % 1;
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
    for (const t of this.textures) t.dispose();
    this.plaster.dispose();
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials as Material[]) m.dispose();
    for (const m of this.outdoor as Material[]) m.dispose();
  }
}
