// Lightweight wooden bed tray, and the patchwork quilt the player has just sat up in: it runs from a turned-back fold at the
// waist, over the thighs (the tray stands on them) and the knees, down over the shins and the feet to the foot of the bed, and
// hangs over its end and its sides. The bed itself is a model in the room (room-models.ts), under the player, its own neat
// cover hidden: this quilt is the one he slept under. Seated look-down embodiment inside the dark bedroom at night.
// Belongs to Teammate B's presentation domain (src/engine/render/room).
//
// Constraints:
// - Lightweight static mesh (<= 400 triangles total).
// - Single Three.js imports through @iwsdk/core.
// - Zero allocations per frame.
//
// The tray (with its rims and legs) and the quilt are pieces of the room layout's `lap` section
// (content/rooms/bedroom.json), in the tray's own space: the room editor moves them. The candle is a piece too, standing on the
// tray: its placement is in the tray's space, so it goes where the tray goes.
import {
  BoxGeometry,
  CanvasTexture,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PlaneGeometry,
  SRGBColorSpace,
  Vector3,
} from '@iwsdk/core';
import { placement, placementOr, type Placement, type RoomLayout } from '../../stage/room-layout';
import { applyPlacement, type EditablePiece, type EditableSource } from '../../shadow/room-placement';
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

/** The lap pieces' ids in the layout file's `lap` section. */
export const LAP_PIECE_IDS = ['tray', 'quilt', 'candle'] as const;

/**
 * Where the candle stands when the layout file says nothing, in the tray's space: on its top, centred across it and on its near
 * half (+z is toward the player), its saucer at the near rim. Hands cast only once they are in front of the flame, so the nearer
 * it is, the less the player has to reach.
 */
const CANDLE_DEFAULT: Placement = placement([0, 0.01, 0.05]);

/** Where the code puts the quilt when the layout file says nothing: its shape is already in the tray's space (QUILT_*). */
const QUILT_DEFAULT: Placement = placement([0, 0, 0]);

/** The quilt's size (m): across, and from the waist (+z, by the body) to past the foot of the bed (-z); its grid. */
const QUILT_W = 1.0;
const QUILT_NEAR_Z = 0.34;
const QUILT_FAR_Z = -0.8;
const QUILT_SEG_X = 10;
const QUILT_SEG_Z = 14;
/** Half the bed's width (m): past it, the quilt hangs down the bed's sides. */
const BED_HALF_W = 0.42;

/**
 * The quilt's height (m, in the tray's space: 0 is the tray's top) along its length, from the waist to the end, as (z, y)
 * points: the turned-back fold at the waist, the thighs under the tray (its legs stand on them at -0.12), the knees a little
 * raised, the shins, the feet making a bump, then over the foot of the bed (about 0.75 m ahead of the tray) and down.
 */
const QUILT_PROFILE: readonly (readonly [number, number])[] = [
  [0.34, -0.15],
  [0.29, -0.07], // the fold he pushed back, rolled up at the waist
  [0.23, -0.1],
  [0.12, -0.12], // thighs, under the tray
  [-0.12, -0.12],
  [-0.27, -0.08], // knees
  [-0.45, -0.17],
  [-0.6, -0.2], // shins
  [-0.67, -0.13], // feet
  [-0.73, -0.19],
  [-0.76, -0.3], // the foot of the bed
  [-0.8, -0.46],
];

/** The quilt's height at `z` along its middle (QUILT_PROFILE, eased between its points). */
export function quiltHeight(z: number): number {
  const p = QUILT_PROFILE;
  if (z >= p[0][0]) return p[0][1];
  for (let i = 1; i < p.length; i++) {
    if (z >= p[i][0]) {
      const [z0, y0] = p[i - 1];
      const [z1, y1] = p[i];
      const s = (z0 - z) / (z0 - z1);
      return y0 + (y1 - y0) * (s * s * (3 - 2 * s));
    }
  }
  return p[p.length - 1][1];
}

/** The quilt's surface: QUILT_PROFILE along it, the legs as two soft ridges, the sides hanging over the bed's edge, and creases. */
function quiltGeometry(): PlaneGeometry {
  const g = new PlaneGeometry(QUILT_W, QUILT_NEAR_Z - QUILT_FAR_Z, QUILT_SEG_X, QUILT_SEG_Z);
  // Lay it flat: its +y (the top of the texture) towards the end of the bed (-z), its face up.
  g.rotateX(-Math.PI / 2);
  g.translate(0, 0, (QUILT_NEAR_Z + QUILT_FAR_Z) / 2);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const ax = Math.abs(x);
    let y = quiltHeight(z);
    // The legs under it, a little apart, from the hips to the feet.
    if (z < 0.2 && z > -0.7) y += 0.018 * Math.exp(-((ax - 0.11) ** 2) / 0.006);
    // Past the edge of the bed it falls away down the sides.
    if (ax > BED_HALF_W - 0.08) {
      const s = Math.min(1, (ax - (BED_HALF_W - 0.08)) / (QUILT_W / 2 - (BED_HALF_W - 0.08)));
      y -= 0.24 * s * s;
    } else if (ax > 0.24) {
      y -= 0.04 * ((ax - 0.24) / (BED_HALF_W - 0.32));
    }
    // Creases from being slept in (fixed, not random: the same quilt every time).
    y += 0.008 * Math.sin(x * 23 + z * 7) * Math.cos(z * 17 - x * 5) + 0.006 * Math.sin(z * 31 + 1.3);
    pos.setY(i, y);
  }
  g.computeVertexNormals();
  return g;
}

export class BedTrayView implements EditableSource {
  /** Placed in front of the player by `place`; the tray and the quilt are placed inside it by the layout. */
  readonly group = new Group();
  /** The tray, its rims and its legs: one piece. The candle stands on it. */
  private readonly tray = new Group();
  /** Where the candle stands (its saucer's foot), a child of the tray. Holds only an unseen box, for the room editor to click. */
  private readonly candleSpot = new Object3D();
  private readonly candlePickGeo = new BoxGeometry(0.08, 0.16, 0.08);
  private readonly candlePickMat = new MeshBasicMaterial({ visible: false });
  private readonly pieces: EditablePiece[];
  private readonly saucer = new Vector3();
  /** Called after the room editor moves a piece (the candle is put back on the tray). */
  onPieceMoved: (() => void) | null = null;

  private readonly traySurfaceGeo: BoxGeometry;
  private readonly rimFrontBackGeo: BoxGeometry;
  private readonly rimLeftRightGeo: BoxGeometry;
  private readonly legGeo: BoxGeometry;
  private readonly blanketGeo: PlaneGeometry;

  private readonly woodMat: MeshBasicMaterial;
  private readonly blanketMat: MeshBasicMaterial;
  private readonly quiltTexture: CanvasTexture;

  private _triangleCount = 0;

  /** @param layout where the tray and the quilt sit (the room layout file's `lap` section); defaults where it says nothing */
  constructor(layout: Readonly<RoomLayout> | null = null) {
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

    // 4. The quilt he sat up in, from the waist to the foot of the bed (QUILT_SEG_X * QUILT_SEG_Z * 2 triangles)
    this.blanketGeo = quiltGeometry();

    const blanketMesh = new Mesh(this.blanketGeo, this.blanketMat);
    blanketMesh.name = 'quilt';

    this.tray.name = 'tray';
    this.tray.add(trayMesh, rimFront, rimBack, rimLeft, rimRight, legLeft, legRight);
    this.group.add(this.tray, blanketMesh);
    const trayDefault = placement([0, 0, 0]);
    applyPlacement(this.tray, placementOr(layout, 'lap', 'tray', trayDefault));
    applyPlacement(blanketMesh, placementOr(layout, 'lap', 'quilt', QUILT_DEFAULT));
    this.candleSpot.name = 'candle';
    const candlePick = new Mesh(this.candlePickGeo, this.candlePickMat);
    candlePick.position.y = 0.08;
    candlePick.userData.pickOnly = true; // casts no shadow
    this.candleSpot.add(candlePick);
    this.tray.add(this.candleSpot);
    applyPlacement(this.candleSpot, placementOr(layout, 'lap', 'candle', CANDLE_DEFAULT));
    this.pieces = [
      { id: 'tray', section: 'lap', object: this.tray, fallback: trayDefault },
      { id: 'quilt', section: 'lap', object: blanketMesh, fallback: QUILT_DEFAULT },
      { id: 'candle', section: 'lap', object: this.candleSpot, fallback: CANDLE_DEFAULT },
    ];

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

  /** The tray and the quilt, for the room editor. */
  editables(): readonly EditablePiece[] {
    return this.pieces;
  }

  moved(): void {
    this.onPieceMoved?.();
  }

  get triangleCount(): number {
    return this._triangleCount;
  }

  /** Makes the candle on the tray a real light for it (candle-light.ts): the tray and blanket are lit by it and cast its shadows. */
  useCandleLight(candle: CandleLight): void {
    // The wood's colour was its final look; as its own colour under the faint moonlight it is brightened (as BedroomView's).
    this.woodMat.color.multiplyScalar(3.5);
    candle.light(this.woodMat);
    candle.light(this.blanketMat);
    this.group.traverse((o) => {
      if (o instanceof Mesh && !o.userData.pickOnly) candle.cast(o);
    });
  }

  /** Positions and rotates the bed tray and blanket relative to the player. */
  place(x: number, y: number, z: number, yaw = 0): void {
    this.group.position.set(x, y, z);
    this.group.rotation.y = yaw;
  }

  /** Copies the world position of where the candle stands (the `candle` piece, on the tray wherever the layout puts them). */
  getCandleSaucerPosition(out: Float64Array | number[]): void {
    this.group.updateMatrixWorld(true);
    this.candleSpot.localToWorld(this.saucer.set(0, 0, 0));
    out[0] = this.saucer.x;
    out[1] = this.saucer.y;
    out[2] = this.saucer.z;
  }

  dispose(): void {
    this.traySurfaceGeo.dispose();
    this.rimFrontBackGeo.dispose();
    this.rimLeftRightGeo.dispose();
    this.legGeo.dispose();
    this.blanketGeo.dispose();
    this.candlePickGeo.dispose();
    this.candlePickMat.dispose();
    this.woodMat.dispose();
    this.blanketMat.dispose();
    this.quiltTexture.dispose();
  }
}
