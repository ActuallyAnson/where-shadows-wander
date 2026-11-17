// The bedroom's painted art (room-art.ts) as a few textured quads that go over Damon's bare room without changing it: wallpaper
// on the walls, and the night and the rain in the window. Everything else in the room is a model. The moonlight the window lets in
// is a light (candle-light.ts): this view says where the window is.
// Its group goes inside BedroomView's group, so it is placed and turned with the room. Candlelight warms it, and in the dark it goes
// blue and quiet, like the room around it. Textures are drawn once; update() allocates nothing.
import {
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
  Object3D,
  PlaneGeometry,
  RepeatWrapping,
  RGBAFormat,
  SRGBColorSpace,
  UnsignedByteType,
  Vector3,
} from '@iwsdk/core';
import type { Material } from '@iwsdk/core';
import type { LanternLight } from './pure/lantern-light';
import { NIGHT_MARGIN, RAIN_SLANT, type NightLayer, paintNight, paintRain, paintWall } from './room-art';
import { plasterNormals } from './pure/plaster-bump';
import { ROOM_BACK_WALL_Z, ROOM_DEPTH_M, ROOM_MID_Z, ROOM_WALL_BEHIND_STAGE_M } from '../stage/stage-frame';
import { CANDLE_REACH_M, type CandleBump, type CandleLight } from './candle-light';
import { placementOr, type RoomLayout } from '../stage/room-layout';
import { applyPlacement, readPlacement, type EditablePiece, type EditableSource } from './room-placement';

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

/** The window opening, in metres, and where it is in the room (the centre of the left wall's window). */
const WINDOW_W = 1.1;
const WINDOW_H = 1.3;
/** The opening inside the window's frame (m), which the moon's light comes in at (the frame's posts and bars: bedroom-view.ts). */
const OPENING_W = 0.84;
const OPENING_H = 1.08;
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
/** How bright the candle's glow is at the end of the hold that lights it, as it catches (its full brightness is about 1). */
const IGNITION_GLOW = 0.9;
/**
 * How bright the candle's small pool of light is while it waits to be lit (`waiting`), before the hold on the wick: bright, but
 * only about SPREAD_FROM_M across, so the eye goes to the candle first. The hold then spreads it out to the room.
 */
const WAITING_GLOW = 3.5;
/** Seconds the glow from the hold takes to hand over to the burning flame's light (which fades in), so there is no dip. */
const HANDOVER_S = 0.6;

/** The pieces of the room dressing the room layout file places (`room` section). */
export const DRESSING_PIECE_IDS: readonly string[] = [];

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
  /** The pieces the room layout places (none now), for the room editor. */
  private readonly pieces: EditablePiece[] = [];
  /**
   * The window's opening, which the moon's light comes in at (candle-light.ts): in its middle, on the wall, its +x into the room.
   * The opening is inside the frame's posts and bars (bedroom-view.ts).
   */
  readonly moonWindow = new Object3D();
  /** The wallpaper wall behind the stage, kept to move it when the stage's distance is known. */
  readonly wall: Mesh;

  private readonly geometries: BufferGeometry[] = [];
  private readonly materials: MeshBasicMaterial[] = [];
  /** The window's own pictures (the night, the rain), which keep one cool colour whatever the room does. */
  private readonly outdoor: MeshBasicMaterial[] = [];
  private readonly rain: CanvasTexture[] = [];
  /** The outside layers' textures and how far each slides with the head (parallel to OUTSIDE_LAYERS). */
  private readonly outside: CanvasTexture[] = [];
  private readonly head = new Vector3();
  private readonly textures: CanvasTexture[] = [];
  /** The room art the candle lights (the walls). */
  private readonly lit: Mesh[] = [];
  /** The walls' plaster, as a normal map the candle's light catches (plaster-bump.ts), and which materials it is on. */
  private readonly plaster = plasterTexture();
  private readonly bumps = new Map<MeshBasicMaterial, CandleBump>();
  /** The candle as a light (candle-light.ts), once `useCandleLight` is called: it lights the art per pixel and casts the shadows. */
  private candle: CandleLight | null = null;
  /** How far the candle's light has spread into the room, 0 (only by the flame) .. 1 (the whole room), and its reach now (m). */
  private spreadLevel = 0;
  private reachNow = SPREAD_FROM_M;

  /** @param layout where the layout file puts the pieces (none now); their defaults where it says nothing */
  constructor(private readonly layout: Readonly<RoomLayout> | null = null) {
    // The walls are solid and drawn first, so the plain walls of Damon's room behind them fail the depth test and cost nothing
    // to draw; everything on a wall sits a hair in front of it.
    // The wall behind the stage (same size as Damon's front wall, a hair in front of it).
    const wallCanvas = paintedCanvas(1024, 640, (g, w, h) => {
      paintWall(g, w, h);
    });
    const wallTexture = this.texture(wallCanvas);
    this.wall = this.quad(4, 2.5, wallTexture, false, true, undefined, [16, 10]);
    this.wall.position.set(0, 1.25, -2.4);
    this.wall.renderOrder = WALL_ORDER;
    // The same paper and panelling on the two side walls (one material for both).
    const sideTexture = this.texture(paintedCanvas(800, 400, (g, w, h) => paintWall(g, w, h)));
    const left = this.quad(ROOM_DEPTH_M, 2.5, sideTexture, false, true, undefined, [4 * ROOM_DEPTH_M, 10]);
    left.rotation.y = Math.PI / 2;
    left.position.set(-1.995, 1.25, ROOM_MID_Z);
    left.renderOrder = WALL_ORDER;
    const right = this.quad(ROOM_DEPTH_M, 2.5, sideTexture, false, true, left, [4 * ROOM_DEPTH_M, 10]);
    right.rotation.y = -Math.PI / 2;
    right.position.set(1.995, 1.25, ROOM_MID_Z);
    right.renderOrder = WALL_ORDER;
    // The wall behind the player: the same paper as the wall behind the stage (same size), facing into the room, a hair in front
    // of Damon's plain back wall (ROOM_BACK_WALL_Z), against the bed's headboard.
    const back = this.quad(4, 2.5, wallTexture, false, true, undefined, [16, 10]);
    back.rotation.y = Math.PI;
    back.position.set(0, 1.25, ROOM_BACK_WALL_Z - 0.005);
    back.renderOrder = WALL_ORDER;
    // The walls all face into the room, so they are one-sided: from inside nothing changes, and from outside (the room editor's
    // views) the near walls drop away and the room can be seen into, like Damon's own walls, floor and ceiling.
    for (const m of [this.wall, left, back]) (m.material as MeshBasicMaterial).side = FrontSide;

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

    this.moonWindow.name = 'moon-window';
    this.moonWindow.position.set(-1.995, WINDOW_Y, WINDOW_Z);

    // None of them moves inside the room: their matrices are made once (and `place` makes the wall's again), and they are
    // culled when out of view, so looking away from the window does not draw it.
    for (const m of [this.wall, left, right, back, ...nightMeshes, ...rainLayers, this.moonWindow]) {
      m.matrixAutoUpdate = false;
      m.updateMatrix();
    }
    this.group.add(this.wall, left, right, back, ...nightMeshes, ...rainLayers, this.moonWindow);
    this.lit.push(this.wall, left, right, back);
    // The walls are plaster: the candle catches its lumps (one tile about every PLASTER_TILE_M).
    this.bumps.set(this.wall.material as MeshBasicMaterial, {
      map: this.plaster,
      repeat: [4 / PLASTER_TILE_M, 2.5 / PLASTER_TILE_M],
    });
    this.bumps.set(back.material as MeshBasicMaterial, {
      map: this.plaster,
      repeat: [4 / PLASTER_TILE_M, 2.5 / PLASTER_TILE_M],
    });
    this.bumps.set(left.material as MeshBasicMaterial, {
      map: this.plaster,
      repeat: [ROOM_DEPTH_M / PLASTER_TILE_M, 2.5 / PLASTER_TILE_M],
    });
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
  }

  /** The pieces the room layout places, for the room editor. */
  editables(): readonly EditablePiece[] {
    return this.pieces;
  }

  /** A piece moved (in the editor): the candle's shadows are cast again. */
  moved(): void {
    this.candle?.rebake();
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
   * Puts the wallpaper wall just in front of Damon's front wall (`stageDist` is how
   * far the stage is ahead of the player, and `playerZ` where the player sits in room space: the wall is that far ahead of them).
   */
  place(stageDist = 2.0, playerZ = 0): void {
    const z = playerZ - (Math.max(stageDist, 1.5) + ROOM_WALL_BEHIND_STAGE_M) + 0.012;
    this.wall.position.set(0, 1.25, z);
    this.wall.updateMatrix();
    this.candle?.rebake(); // the shadows fall on the wall where it is now
  }

  /**
   * Makes the candle a real light for the room (candle-light.ts), the room's one lighting model: the art keeps its own colours,
   * lit per pixel by the moon's faint blue light everywhere plus the candle's, by how far each point is from the flame and how
   * squarely it faces it. Call once.
   */
  useCandleLight(candle: CandleLight): void {
    this.candle = candle;
    candle.setMoonWindow(this.moonWindow, OPENING_W, OPENING_H);
    for (const m of this.lit) {
      const material = m.material as MeshBasicMaterial;
      material.color.setScalar(LIT_PEAK); // the art's own colour; the light does the rest
      candle.light(material, this.bumps.get(material));
    }
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
    this.candle?.set(brightness, flame ?? null, this.reachNow);
    const flash = this.lightning > 0 ? Math.min(1, this.lightning) : 0;
    for (const m of this.outdoor) m.color.copy(OUTSIDE_TINT).lerp(FLASH_TINT, flash);
    // The moon's light through the window stays as it is (the candle adds its light, it never takes the moon's away), but for a flash.
    this.candle?.setMoonFlash(flash);
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
  /** Where the window is, in the world (the middle of the glass): where the rain and the thunder are heard from. Writes into `out` and returns it. */
  windowPoint(out: Vector3): Vector3 {
    out.set(-1.95, WINDOW_Y, WINDOW_Z);
    this.group.updateWorldMatrix(true, false);
    return this.group.localToWorld(out);
  }

  /**
   * Moves the rain outside the window and slides the outside layers against each other for where the head is (call once a frame
   * with the frame's seconds and the head's world position). Allocates nothing.
   */
  tick(dt: number, headWorld?: Readonly<{ x: number; y: number; z: number }>): void {
    if (headWorld) this.slideOutside(this.group.worldToLocal(this.head.set(headWorld.x, headWorld.y, headWorld.z)));
    if (!(dt > 0)) return;
    for (let i = 0; i < this.rain.length; i++) {
      // Down and along the streaks' lean, kept in 0..1 so the offsets never grow large enough to lose precision.
      const t = this.rain[i];
      const fall = Math.min(dt, 0.1) * RAIN_FALL[i];
      t.offset.y = (t.offset.y + fall) % 1;
      t.offset.x = (t.offset.x + fall * RAIN_SLANT) % 1;
    }
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
    for (const t of this.textures) t.dispose();
    this.plaster.dispose();
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials as Material[]) m.dispose();
    for (const m of this.outdoor as Material[]) m.dispose();
  }
}
