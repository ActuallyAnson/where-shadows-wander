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
  MeshStandardMaterial,
  PlaneGeometry,
  SRGBColorSpace,
} from '@iwsdk/core';

const PATCH_COLORS = [
  '#25324d', // flannel navy
  '#2d3e33', // dusty spruce
  '#583a2d', // weathered terracotta
  '#604f35', // muted mustard
  '#3d2b38', // heather plum
  '#302b28', // warm charcoal
];

function createQuiltTexture(customCanvas?: HTMLCanvasElement): CanvasTexture {
  let canvas = customCanvas;
  if (!canvas && typeof document !== 'undefined') {
    canvas = document.createElement('canvas');
  }
  if (!canvas) {
    canvas = {
      width: 512,
      height: 512,
      getContext: () => null,
    } as unknown as HTMLCanvasElement;
  }

  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext ? canvas.getContext('2d') : null;
  if (ctx) {
    const cols = 6;
    const rows = 5;
    const pw = canvas.width / cols;
    const ph = canvas.height / rows;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const colorIdx = (r * 3 + c * 2 + (r % 2)) % PATCH_COLORS.length;
        ctx.fillStyle = PATCH_COLORS[colorIdx];
        ctx.fillRect(c * pw, r * ph, pw, ph);

        // Subtle weave noise
        ctx.fillStyle = 'rgba(0,0,0,0.06)';
        for (let i = 0; i < 6; i++) {
          ctx.fillRect(c * pw + i * (pw / 6), r * ph, pw / 12, ph);
        }

        // Stitched seam lines
        ctx.strokeStyle = 'rgba(235, 225, 205, 0.45)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 4]);
        ctx.strokeRect(c * pw + 2, r * ph + 2, pw - 4, ph - 4);
      }
    }
  }

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

  private readonly woodMat: MeshStandardMaterial;
  private readonly blanketMat: MeshStandardMaterial;
  private readonly quiltTexture: CanvasTexture;

  private _triangleCount = 0;

  constructor() {
    this.woodMat = new MeshStandardMaterial({
      color: 0x443224,
      roughness: 0.85,
      metalness: 0.05,
    });

    this.quiltTexture = createQuiltTexture();
    this.blanketMat = new MeshStandardMaterial({
      map: this.quiltTexture,
      roughness: 0.95,
      metalness: 0.0,
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
