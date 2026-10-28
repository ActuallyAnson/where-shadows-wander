// The bedroom's painted art (room-art.ts) as a few textured quads that go over Damon's bare room without changing it: wallpaper,
// shelves and pictures on the wall behind the stage, the night in the window, a bookcase on the right wall and a rug on the floor.
// Its group goes inside BedroomView's group, so it is placed and turned with the room. Candlelight warms it, and in the dark it goes
// blue and quiet, like the room around it. Textures are drawn once; update() allocates nothing.
import {
  AdditiveBlending,
  BoxGeometry,
  CanvasTexture,
  Color,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  RepeatWrapping,
  SRGBColorSpace,
  Vector3,
} from '@iwsdk/core';
import type { BufferGeometry, Material } from '@iwsdk/core';
import type { LanternLight } from './pure/lantern-light';
import {
  castShadow,
  NIGHT_MARGIN,
  type NightLayer,
  paintBookcase,
  paintMoonPatch,
  paintNight,
  paintRug,
  paintSill,
  paintSnow,
  paintWall,
  paintWallThings,
  paintWood,
  WALL_THINGS_ROWS,
  WALL_THINGS_TOP,
} from './room-art';

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
const CASE_DEPTH = 0.3;

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
  /** The pictures and the shelves, held off the wall; `place` keeps them in front of it. */
  private readonly pictures: Mesh;
  private readonly shelves: Mesh;

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

  constructor() {
    // The walls are solid and drawn first, so the plain walls of Damon's room behind them fail the depth test and cost nothing
    // to draw; everything on a wall sits a hair in front of it.
    // What hangs on the wall behind the stage stands out from it, in two layers (frames, then shelves with their keepsakes); their
    // shadows are painted onto the paper, so the gap between them shows when the head moves.
    const picturesCanvas = paintedCanvas(1024, WALL_THINGS_ROWS, (g, w, h) => paintWallThings(g, w, h, 'pictures'));
    const shelvesCanvas = paintedCanvas(1024, WALL_THINGS_ROWS, (g, w, h) => paintWallThings(g, w, h, 'shelves'));
    // The wall behind the stage (same size as Damon's front wall, a hair in front of it).
    const wallCanvas = paintedCanvas(1024, 640, (g, w, h) => {
      paintWall(g, w, h);
      castShadow(g, picturesCanvas, 0, WALL_THINGS_TOP, 6, 9, 7, 0.5);
      castShadow(g, shelvesCanvas, 0, WALL_THINGS_TOP, 16, 22, 16, 0.55);
    });
    this.wall = this.quad(4, 2.5, this.texture(wallCanvas), false, true);
    this.wall.position.set(0, 1.25, -2.4);
    this.wall.renderOrder = WALL_ORDER;
    this.pictures = this.quad(4, 1.25, this.texture(picturesCanvas), true);
    this.shelves = this.quad(4, 1.25, this.texture(shelvesCanvas), true);

    // The same paper and panelling on the two side walls (one material for both).
    const sideTexture = this.texture(paintedCanvas(1280, 640, (g, w, h) => paintWall(g, w, h)));
    const left = this.quad(5, 2.5, sideTexture, false, true);
    left.rotation.y = Math.PI / 2;
    left.position.set(-1.995, 1.25, -0.4);
    left.renderOrder = WALL_ORDER;
    const right = this.quad(5, 2.5, sideTexture, false, true, left);
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

    // The rug under the bed tray, a hair above the floor.
    const rug = this.quad(2.2, 1.55, this.texture(paintedCanvas(512, 360, paintRug)), true);
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(0.1, 0.004, -0.4);
    const rugMat = rug.material as MeshBasicMaterial;
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
      this.pictures,
      this.shelves,
      caseBox,
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
      this.pictures,
      this.shelves,
      caseBox,
    );
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
    texture.anisotropy = 4;
    this.textures.push(texture);
    return texture;
  }

  private quad(w: number, h: number, texture: CanvasTexture, alpha: boolean, solid = false, shared?: Mesh): Mesh {
    const geometry = new PlaneGeometry(w, h);
    const material =
      (shared?.material as MeshBasicMaterial | undefined) ??
      new MeshBasicMaterial({
        map: texture,
        transparent: alpha,
        depthWrite: solid,
        side: DoubleSide,
        toneMapped: false,
      });
    this.geometries.push(geometry);
    if (!shared) this.materials.push(material);
    return new Mesh(geometry, material);
  }

  /** Puts the wallpaper wall just in front of Damon's front wall, and the pictures and shelves in front of that (`stageDist` is how far the stage is from the player). */
  place(stageDist = 2.0): void {
    const z = -(Math.max(stageDist, 1.5) + 0.35) + 0.012;
    this.wall.position.set(0, 1.25, z);
    this.wall.updateMatrix();
    // The band of wall the things cover: rows 120 to 440 of 640, so its middle is row 280.
    const y = 2.5 - ((WALL_THINGS_TOP + WALL_THINGS_ROWS / 2) / 640) * 2.5;
    this.pictures.position.set(0, y, z + PICTURES_OUT);
    this.pictures.updateMatrix();
    this.shelves.position.set(0, y, z + SHELVES_OUT);
    this.shelves.updateMatrix();
  }

  /** Lights the art like the room: warm and bright with the candle, dark and blue without. Same arguments as BedroomView.update. */
  update(light: Readonly<LanternLight>, occlusion = 1): void {
    const brightness = light.lit ? Math.max(0.04, occlusion * (0.2 + 0.8 * light.intensity)) : 0.04;
    const warm = Math.min(1, Math.max(0, (brightness - 0.04) / 0.5));
    this.tint.copy(MOON_TINT).lerp(CANDLE_TINT, warm);
    const k = 0.5 + 0.5 * Math.min(1, brightness);
    this.tint.multiplyScalar(warm > 0 ? k : 1);
    for (const m of this.materials) m.color.copy(this.tint);
    for (const m of this.outdoor) m.color.copy(OUTSIDE_TINT);
    // The moonlight on the floor shrinks into the room's light when the candle is bright.
    const moonK = 0.3 - 0.2 * warm;
    this.moonPatch.color.setRGB(0.5 * moonK, 0.62 * moonK, moonK);
  }

  /**
   * Moves the snow outside the window and slides the outside layers against each other for where the head is (call once a frame
   * with the frame's seconds and the head's world position). Allocates nothing.
   */
  tick(dt: number, headWorld?: Readonly<{ x: number; y: number; z: number }>): void {
    if (headWorld) this.slideOutside(this.group.worldToLocal(this.head.set(headWorld.x, headWorld.y, headWorld.z)));
    if (!(dt > 0)) return;
    this.time += Math.min(dt, 0.1);
    for (let i = 0; i < this.snow.length; i++) {
      const t = this.snow[i];
      t.offset.y += Math.min(dt, 0.1) * SNOW_FALL[i];
      t.offset.x = Math.sin(this.time * (0.5 + i * 0.3)) * SNOW_SWAY[i];
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
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials as Material[]) m.dispose();
    for (const m of this.outdoor as Material[]) m.dispose();
  }
}
