// Lightweight wooden bed tray and quilted patchwork blanket mesh across the player's lap.
// Provides seated look-down embodiment inside the dark bedroom at night.
// Belongs to Teammate B's presentation domain (src/engine/render/room).
//
// Constraints:
// - Lightweight static mesh (<= 400 triangles total).
// - Single Three.js imports through @iwsdk/core.
// - Zero allocations per frame.
import {
  BoxGeometry,
  CanvasTexture,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  SRGBColorSpace,
} from '@iwsdk/core';
import { paintQuilt } from '../../shadow/room-art';
import type { CandleLight } from '../../shadow/candle-light';

function createQuiltTexture(customCanvas?: HTMLCanvasElement): CanvasTexture {
  let canvas = customCanvas;
  if (!canvas && typeof document !== 'undefined') {
    canvas = document.createElement('canvas');
  }
  if (!canvas) {
    canvas = {
      width: 128,
      height: 128,
      getContext: () => null,
    } as unknown as HTMLCanvasElement;
  }

  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext ? canvas.getContext('2d') : null;
  if (ctx) paintQuilt(ctx, canvas.width, canvas.height);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

export class BedTrayView {
  readonly group = new Group();

  private readonly traySurfaceGeo: BoxGeometry;
  private readonly rimFrontBackGeo: BoxGeometry;
  private readonly rimLeftRightGeo: BoxGeometry;
  private readonly legGeo: BoxGeometry;
  private readonly blanketGeo: PlaneGeometry;

  private readonly woodMat: MeshBasicMaterial;
  private readonly blanketMat: MeshBasicMaterial;
  private readonly quiltTexture: CanvasTexture;

  private _triangleCount = 0;

  constructor() {
    this.woodMat = new MeshBasicMaterial({
      color: 0x3d2c1e,
    });

    this.quiltTexture = createQuiltTexture();
    this.blanketMat = new MeshBasicMaterial({
      map: this.quiltTexture,
      side: DoubleSide,
    });

    // 1. Bed Tray Surface: 0.48m wide, 0.016m thick, 0.30m deep (12 triangles)
    this.traySurfaceGeo = new BoxGeometry(0.48, 0.016, 0.3);
    const trayMesh = new Mesh(this.traySurfaceGeo, this.woodMat);
    trayMesh.position.set(0, 0, 0);

    // 2. Tray Rim Borders: low raised lip (48 triangles total)
    this.rimFrontBackGeo = new BoxGeometry(0.48, 0.02, 0.012);
    this.rimLeftRightGeo = new BoxGeometry(0.012, 0.02, 0.276);

    const rimFront = new Mesh(this.rimFrontBackGeo, this.woodMat);
    rimFront.position.set(0, 0.012, 0.144);
    const rimBack = new Mesh(this.rimFrontBackGeo, this.woodMat);
    rimBack.position.set(0, 0.012, -0.144);

    const rimLeft = new Mesh(this.rimLeftRightGeo, this.woodMat);
    rimLeft.position.set(-0.234, 0.012, 0);
    const rimRight = new Mesh(this.rimLeftRightGeo, this.woodMat);
    rimRight.position.set(0.234, 0.012, 0);

    // 3. Folding Legs: left & right low brackets (24 triangles total)
    this.legGeo = new BoxGeometry(0.016, 0.12, 0.24);
    const legLeft = new Mesh(this.legGeo, this.woodMat);
    legLeft.position.set(-0.22, -0.06, 0);
    const legRight = new Mesh(this.legGeo, this.woodMat);
    legRight.position.set(0.22, -0.06, 0);

    // 4. Quilted Blanket: draped across the lap below the tray (96 triangles)
    this.blanketGeo = new PlaneGeometry(0.85, 0.65, 8, 6);
    const pos = this.blanketGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vy = pos.getY(i);
      // Gentle drape curve across the lap
      const sag = Math.sin(((vx + 0.425) / 0.85) * Math.PI) * 0.035 - Math.pow(vx / 0.425, 2) * 0.07;
      const wave = Math.sin(vx * 10.0) * Math.cos(vy * 8.0) * 0.008;
      pos.setZ(i, pos.getZ(i) + sag + wave);
    }
    this.blanketGeo.computeVertexNormals();

    const blanketMesh = new Mesh(this.blanketGeo, this.blanketMat);
    // Orient blanket to lay gently draped across the lap
    blanketMesh.rotation.x = -Math.PI / 2.3;
    blanketMesh.position.set(0, -0.07, 0.14);

    this.group.add(trayMesh, rimFront, rimBack, rimLeft, rimRight, legLeft, legRight, blanketMesh);

    // Count triangles
    this._triangleCount =
      this.traySurfaceGeo.index!.count / 3 +
      (this.rimFrontBackGeo.index!.count / 3) * 2 +
      (this.rimLeftRightGeo.index!.count / 3) * 2 +
      (this.legGeo.index!.count / 3) * 2 +
      this.blanketGeo.index!.count / 3;

    // Default position across lap: Y ≈ 0.65m, Z ≈ -0.45m
    this.group.position.set(0, 0.65, -0.45);
  }

  get triangleCount(): number {
    return this._triangleCount;
  }

  /** Makes the candle on the tray a real light for it (candle-light.ts): the tray and blanket are lit by it and cast its shadows. */
  useCandleLight(candle: CandleLight): void {
    candle.light(this.woodMat);
    candle.light(this.blanketMat);
    for (const child of this.group.children) if (child instanceof Mesh) candle.cast(child);
  }

  /** Positions and rotates the bed tray and blanket relative to the player. */
  place(x: number, y: number, z: number, yaw = 0): void {
    this.group.position.set(x, y, z);
    this.group.rotation.y = yaw;
  }

  /** Copies world position of the candle saucer resting spot on top of the tray. */
  getCandleSaucerPosition(out: Float64Array | number[]): void {
    out[0] = this.group.position.x;
    out[1] = this.group.position.y + 0.01;
    out[2] = this.group.position.z;
  }

  dispose(): void {
    this.traySurfaceGeo.dispose();
    this.rimFrontBackGeo.dispose();
    this.rimLeftRightGeo.dispose();
    this.legGeo.dispose();
    this.blanketGeo.dispose();
    this.woodMat.dispose();
    this.blanketMat.dispose();
    this.quiltTexture.dispose();
  }
}
