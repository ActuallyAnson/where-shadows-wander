// The bedroom's painted art (room-art.ts) as a few textured quads that go over Damon's bare room without changing it: wallpaper,
// shelves and pictures on the wall behind the stage, the night in the window, a bookcase on the right wall and a rug on the floor.
// Its group goes inside BedroomView's group, so it is placed and turned with the room. Candlelight warms it, and in the dark it goes
// blue and quiet, like the room around it. Textures are drawn once; update() allocates nothing.
import {
  CanvasTexture,
  Color,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  SRGBColorSpace,
} from '@iwsdk/core';
import type { BufferGeometry, Material } from '@iwsdk/core';
import type { LanternLight } from './pure/lantern-light';
import { paintBookcase, paintNight, paintRug, paintWall } from './room-art';

/** Colours the art is multiplied by: dark and blue by moonlight, warm and bright by the candle. */
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

  private readonly geometries: BufferGeometry[] = [];
  private readonly materials: MeshBasicMaterial[] = [];
  private readonly textures: CanvasTexture[] = [];
  private readonly tint = new Color();

  constructor() {
    // The wall behind the stage (same size as Damon's front wall, a hair in front of it).
    this.wall = this.quad(4, 2.5, this.texture(paintedCanvas(1024, 640, paintWall)), false);
    this.wall.position.set(0, 1.25, -2.4);
    this.wall.renderOrder = -9;

    // The same paper and panelling on the two side walls (the window, bookcase and the stage's wall have their own art on top).
    const sideTexture = this.texture(paintedCanvas(1280, 640, (g, w, h) => paintWall(g, w, h, false)));
    const left = this.quad(5, 2.5, sideTexture, false);
    left.rotation.y = Math.PI / 2;
    left.position.set(-1.995, 1.25, -0.4);
    left.renderOrder = 1; // after Damon's plain walls (order 0), which would otherwise be drawn over it
    const right = this.quad(5, 2.5, sideTexture, false);
    right.rotation.y = -Math.PI / 2;
    right.position.set(1.995, 1.25, -0.4);
    right.renderOrder = 1;

    // The night in the left window (just in front of its plain sky, behind its frame).
    const night = this.quad(1.1, 1.3, this.texture(paintedCanvas(440, 520, paintNight)), false);
    night.rotation.y = Math.PI / 2;
    night.renderOrder = 2; // over the side wall's paper
    night.position.set(-2.008, 1.45, -0.8);

    // The bookcase on the right wall.
    const bookcase = this.quad(1.0, 1.8, this.texture(paintedCanvas(400, 720, paintBookcase)), true);
    bookcase.rotation.y = -Math.PI / 2;
    bookcase.renderOrder = 2;
    bookcase.position.set(1.985, 0.93, -1.25);

    // The rug under the bed tray, a hair above the floor.
    const rug = this.quad(2.2, 1.55, this.texture(paintedCanvas(512, 360, paintRug)), true);
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(0.1, 0.004, -0.4);
    const rugMat = rug.material as MeshBasicMaterial;
    rugMat.polygonOffset = true;
    rugMat.polygonOffsetFactor = -2;
    rugMat.polygonOffsetUnits = -2;

    this.group.add(this.wall, left, right, night, bookcase, rug);
    this.update({ lit: false, intensity: 0 } as Readonly<LanternLight>, 0);
  }

  private texture(canvas: HTMLCanvasElement): CanvasTexture {
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = 4;
    this.textures.push(texture);
    return texture;
  }

  private quad(w: number, h: number, texture: CanvasTexture, alpha: boolean): Mesh {
    const geometry = new PlaneGeometry(w, h);
    const material = new MeshBasicMaterial({
      map: texture,
      transparent: alpha,
      depthWrite: false,
      side: DoubleSide,
      toneMapped: false,
    });
    this.geometries.push(geometry);
    this.materials.push(material);
    const mesh = new Mesh(geometry, material);
    mesh.frustumCulled = false;
    return mesh;
  }

  /** Puts the wallpaper wall just in front of Damon's front wall (`stageDist` is how far the stage is from the player). */
  place(stageDist = 2.0): void {
    this.wall.position.set(0, 1.25, -(Math.max(stageDist, 1.5) + 0.35) + 0.012);
  }

  /** Lights the art like the room: warm and bright with the candle, dark and blue without. Same arguments as BedroomView.update. */
  update(light: Readonly<LanternLight>, occlusion = 1): void {
    const brightness = light.lit ? Math.max(0.04, occlusion * (0.2 + 0.8 * light.intensity)) : 0.04;
    const warm = Math.min(1, Math.max(0, (brightness - 0.04) / 0.5));
    this.tint.copy(MOON_TINT).lerp(CANDLE_TINT, warm);
    const k = 0.5 + 0.5 * Math.min(1, brightness);
    this.tint.multiplyScalar(warm > 0 ? k : 1);
    for (const m of this.materials) m.color.copy(this.tint);
  }

  dispose(): void {
    for (const t of this.textures) t.dispose();
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials as Material[]) m.dispose();
  }
}
