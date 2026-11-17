// Lightweight wooden bed tray across the player's lap. The bed itself is a model in the room (room-models.ts), under the player.
// Seated look-down embodiment inside the dark bedroom at night.
// Belongs to Teammate B's presentation domain (src/engine/render/room).
//
// Constraints:
// - Lightweight static mesh (<= 400 triangles total).
// - Single Three.js imports through @iwsdk/core.
// - Zero allocations per frame.
//
// The tray (with its rims and legs) is a piece of the room layout's `lap` section
// (content/rooms/bedroom.json): the room editor moves it. The candle is a piece too, standing on the
// tray: its placement is in the tray's space, so it goes where the tray goes.
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, Object3D, Vector3 } from '@iwsdk/core';
import { placement, placementOr, type Placement, type RoomLayout } from '../../stage/room-layout';
import { applyPlacement, type EditablePiece, type EditableSource } from '../../shadow/room-placement';
import type { CandleLight } from '../../shadow/candle-light';

/** The lap pieces' ids in the layout file's `lap` section. */
export const LAP_PIECE_IDS = ['tray', 'candle'] as const;

/**
 * Where the candle stands when the layout file says nothing, in the tray's space: on its top, centred across it and on its near
 * half (+z is toward the player), its saucer at the near rim. Hands cast only once they are in front of the flame, so the nearer
 * it is, the less the player has to reach.
 */
const CANDLE_DEFAULT: Placement = placement([0, 0.01, 0.05]);

export class BedTrayView implements EditableSource {
  /** Placed in front of the player by `place`; the tray is placed inside it by the layout. */
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

  private readonly woodMat: MeshBasicMaterial;

  private _triangleCount = 0;

  /** @param layout where the tray and the candle sit (the room layout file's `lap` section); defaults where it says nothing */
  constructor(layout: Readonly<RoomLayout> | null = null) {
    this.woodMat = new MeshBasicMaterial({
      color: 0x3d2c1e,
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

    this.tray.name = 'tray';
    this.tray.add(trayMesh, rimFront, rimBack, rimLeft, rimRight, legLeft, legRight);
    this.group.add(this.tray);
    const trayDefault = placement([0, 0, 0]);
    applyPlacement(this.tray, placementOr(layout, 'lap', 'tray', trayDefault));
    this.candleSpot.name = 'candle';
    const candlePick = new Mesh(this.candlePickGeo, this.candlePickMat);
    candlePick.position.y = 0.08;
    candlePick.userData.pickOnly = true; // casts no shadow
    this.candleSpot.add(candlePick);
    this.tray.add(this.candleSpot);
    applyPlacement(this.candleSpot, placementOr(layout, 'lap', 'candle', CANDLE_DEFAULT));
    this.pieces = [
      { id: 'tray', section: 'lap', object: this.tray, fallback: trayDefault },
      { id: 'candle', section: 'lap', object: this.candleSpot, fallback: CANDLE_DEFAULT },
    ];

    // Count triangles
    this._triangleCount =
      this.traySurfaceGeo.index!.count / 3 +
      (this.rimFrontBackGeo.index!.count / 3) * 2 +
      (this.rimLeftRightGeo.index!.count / 3) * 2 +
      (this.legGeo.index!.count / 3) * 2;

    // Default position across lap: Y ≈ 0.65m, Z ≈ -0.45m
    this.group.position.set(0, 0.65, -0.45);
  }

  /** The tray and the candle, for the room editor. */
  editables(): readonly EditablePiece[] {
    return this.pieces;
  }

  moved(): void {
    this.onPieceMoved?.();
  }

  get triangleCount(): number {
    return this._triangleCount;
  }

  /** Makes the candle on the tray a real light for it (candle-light.ts): the tray is lit by it and cast its shadows. */
  useCandleLight(candle: CandleLight): void {
    // The wood's colour was its final look; as its own colour under the faint moonlight it is brightened (as BedroomView's).
    this.woodMat.color.multiplyScalar(3.5);
    candle.light(this.woodMat);
    this.group.traverse((o) => {
      if (o instanceof Mesh && !o.userData.pickOnly) candle.cast(o);
    });
  }

  /** Positions and rotates the bed tray relative to the player. */
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
    this.candlePickGeo.dispose();
    this.candlePickMat.dispose();
    this.woodMat.dispose();
  }
}
