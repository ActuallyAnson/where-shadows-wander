// Real 3D furniture and keepsakes for the bedroom (most from Kenney's Furniture Kit, CC0: https://kenney.nl/assets/furniture-kit;
// the rest credited in CREDITS.md). Each piece is a .glb in src/assets/models, loaded when the room is placed; a piece whose
// file is missing simply is not there, so the room never waits on, or breaks for, a model.
//
// Every model's materials become the room's kind (MeshBasicMaterial, its own colour and texture), lit by the candle and the moon
// (candle-light.ts), and every model casts the candle's shadows. Positions are in RoomDressingView's space (the room: x right,
// y up from the floor, -z toward the wall the shadows play on).
//
// Where each piece stands comes from the room layout file (content/rooms/bedroom.json, src/engine/stage/room-layout.ts) under
// the piece's `id`; `at` and `yaw` below are the defaults when the file has no entry. The layout's scale multiplies the fitted size.
import { AssetManager, Box3, Group, Matrix4, Mesh, Vector3 } from '@iwsdk/core';
import type { BufferGeometry, Material, Object3D } from '@iwsdk/core';
import type { CandleLight } from './candle-light';
import { toRoomLook } from './room-look';
import { placement, placementOr, type Placement, type RoomLayout } from '../stage/room-layout';
import { ROOM_BACK_WALL_Z } from '../stage/stage-frame';
import { applyPlacement, type EditablePiece, type EditableSource } from './room-placement';

/** One piece of furniture: which file, where it stands, and the space it fills. */
export interface RoomPiece {
  /** Its id in the room layout file (`room` section). */
  readonly id: string;
  /** Asset ids to try, in order (the file name in lower case: `bedSingle.glb` is `bedsingle`). The first one there is used. */
  readonly ids: readonly string[];
  /** Where the middle of its footprint stands on the floor (x, z) and how high its base is (y), metres, unless the layout says. */
  readonly at: readonly [number, number, number];
  /**
   * The most it may fill, in the model's own axes before `yaw` (width along its x, depth along its z, metres). It is scaled
   * evenly, as large as fits both, so its height follows from its own proportions.
   */
  readonly size: readonly [number, number];
  /**
   * Turn about the vertical (radians). The models face +z (toward the player, who looks down -z): 0 faces the player,
   * -π/2 faces -x (out from the right wall), π/2 faces +x (out from the left wall).
   */
  readonly yaw?: number;
  /** Parts of the model (by node name) left out: something of the game's own is there instead. */
  readonly hide?: readonly string[];
  /**
   * Its two halves (either side of its middle, across its width) drawn this far further apart (m each), what lies across the
   * middle stretching to meet them: the curtains drawn back from the window, their rod as long as they need.
   */
  readonly part?: number;
}

/**
 * The furniture, by the room's layout (the player sits at the origin looking down -z; the walls are at x = ±2, the back wall
 * at ROOM_BACK_WALL_Z just behind the bed's head, and the wall the shadows play on is at least 1.52 m ahead, so nothing stands beyond z = -1.5; the window is on the left wall, z -1.35..-0.25).
 * Heights noted below follow from each Kenney model's proportions at its size, so a piece standing on another uses that height.
 */
export const ROOM_PIECES: readonly RoomPiece[] = [
  // The bed the player sits up in: under them, its headboard just behind their back, its foot toward the wall ahead (ending at
  // z -1.2, short of the wall at its nearest): 0.86 x 1.7 m, 0.57 m high.
  {
    id: 'bed',
    ids: ['bedsingle', 'bed-single', 'beddouble'],
    at: [0, 0, -0.35],
    size: [0.9, 1.7],
    yaw: Math.PI,
    // Its neat cover: the player has just sat up in the bed, under the lap's own rumpled quilt (bed-tray-view.ts), which runs
    // to the bed's foot; the sheet shows behind them, where they lay.
    hide: ['cover'],
  },
  // The bookcase against the back wall in the right corner, beside the bed's head, its open side to the room: 0.6 m wide,
  // 1.32 m high.
  {
    id: 'bookcase',
    ids: ['bookcaseopen', 'bookcase-open', 'bookcaseclosedwide', 'bookcaseclosed'],
    at: [1.6, 0, ROOM_BACK_WALL_Z - 0.2],
    size: [0.6, 0.38],
    yaw: Math.PI,
  },
  // (Nothing stands along the wall ahead: the whole of it is kept clear for the shadows.)
  // A round rug beside the bed, between it and the right wall (its top 4 mm above the floor).
  {
    id: 'rug',
    ids: ['ruground', 'rug-round', 'rugrounded'],
    at: [1.2, -0.012, -0.35],
    size: [1.2, 1.2],
  },
  // His desk under the window, against the left wall (1.2 m long, its top 0.61 m up), and its chair pulled up to it, its back
  // to the bed (0.98 m high). On the desk, a mug of pencils at the near-the-stage end and a globe at the other.
  { id: 'desk', ids: ['desk'], at: [-1.71, 0, -0.8], size: [1.2, 0.56], yaw: Math.PI / 2 },
  { id: 'chair', ids: ['deskchair'], at: [-1.2, 0, -0.8], size: [0.42, 0.46], yaw: -Math.PI / 2 },
  { id: 'pencils', ids: ['penciljar'], at: [-1.82, 0.607, -1.22], size: [0.08, 0.08], yaw: Math.PI / 2 },
  { id: 'globe', ids: ['globe'], at: [-1.8, 0.607, -0.42], size: [0.17, 0.15], yaw: Math.PI / 2 + 0.5 },
  // Curtains either side of the window, from above it to just over the desk (1.55 m long; the window is z -1.35..-0.25), drawn
  // back so the moon shines in through the middle of the window onto the desk and the floor (candle-light.ts).
  { id: 'curtains', ids: ['curtains'], at: [-1.9, 0.8, -0.8], size: [1.24, 0.18], yaw: Math.PI / 2, part: 0.12 },
  // A small wardrobe in the corner behind his left shoulder, against the left wall (1.23 m high), and the room's door on the
  // back wall between it and the bed (1.05 x 1.89 m), the moving boxes just inside it.
  { id: 'closet', ids: ['closet'], at: [-1.81, 0, 0.18], size: [0.64, 0.36], yaw: Math.PI / 2 },
  { id: 'door', ids: ['door'], at: [-1.06, 0, ROOM_BACK_WALL_Z - 0.1], size: [1.05, 0.2], yaw: Math.PI },
  // A nightstand by the bed's head on the right (0.37 m high) with a small plant on it, his slippers on the rug beside the bed,
  // his schoolbag dropped by the bookcase, and a coat stand against the right wall (1.25 m high).
  { id: 'nightstand', ids: ['nightstand'], at: [0.7, 0, 0.3], size: [0.42, 0.42], yaw: Math.PI },
  { id: 'plant', ids: ['pottedplant', 'potted-plant', 'plantsmall1'], at: [0.7, 0.365, 0.3], size: [0.13, 0.14] },
  { id: 'slippers', ids: ['slippers'], at: [0.78, 0.004, -0.1], size: [0.24, 0.28], yaw: Math.PI / 2 },
  { id: 'bag', ids: ['backpack'], at: [1.1, 0, 0.34], size: [0.3, 0.24], yaw: Math.PI + 0.2 },
  { id: 'coat-stand', ids: ['coatrack'], at: [1.76, 0, -0.42], size: [0.44, 0.44] },
  // The light in the ceiling (2.5 m), over the middle of the room, unlit: it hangs 0.67 m, high above the stage wall's view.
  { id: 'ceiling-light', ids: ['ceilinglight'], at: [0, 2.5 - 0.67, -0.45], size: [0.4, 0.4] },

  // The jar she gave him on the firefly night (0.17 m tall, its lid on), on his desk between the pencils and the globe, under
  // the window: her firefly glows in it (jar-firefly-view.ts) until it leaves the jar on the wall in scene 5 (docs/STORY.md).
  { id: 'jar', ids: ['glassjar'], at: [-1.64, 0.607, -0.66], size: [0.11, 0.11] },
  // Her torch from the night they met, on top of the bookcase (1.32 m up), behind the player's right shoulder, lying on its
  // side, its lens turned into the room.
  { id: 'torch', ids: ['flashlight'], at: [1.72, 1.32, 0.28], size: [0.07, 0.2], yaw: -Math.PI / 2 + 0.3 },
  // He has just moved in (the prologue's boxes): a stack of taped boxes in the corner ahead on the right (0.68 m high), by the
  // pictures; behind his left shoulder, in front of the door, an open box half unpacked and a flat one with folded blankets on
  // it (its top 0.235 m up, the blankets 0.11 m high).
  { id: 'boxes', ids: ['cardboardboxstack'], at: [1.7, 0, -1.2], size: [0.55, 0.4], yaw: -Math.PI / 2 },
  { id: 'box-open', ids: ['cardboardboxopen'], at: [-0.8, 0, 0.17], size: [0.42, 0.25], yaw: 0.25 },
  { id: 'box-flat', ids: ['cardboardboxflat'], at: [-1.3, 0, 0.15], size: [0.45, 0.34], yaw: Math.PI },
  { id: 'blankets', ids: ['blanketsfolded'], at: [-1.3, 0.235, 0.15], size: [0.4, 0.27], yaw: Math.PI + 0.1 },
  // A toy fox (her shape, the second he learns) on the rug, by the boxes, looking at the bed (0.32 m nose to tail).
  { id: 'fox', ids: ['toyfox'], at: [1.35, 0, -0.8], size: [0.1, 0.32], yaw: -1.07 },
];

/** The furniture's ids, as the layout file's `room` section names them. */
export const ROOM_PIECE_IDS: readonly string[] = ROOM_PIECES.map((p) => p.id);

/** Where the code puts a piece when the layout file says nothing. */
export function defaultPlacement(piece: RoomPiece): Placement {
  return placement(piece.at, [0, ((piece.yaw ?? 0) * 180) / Math.PI, 0]);
}

export class RoomModels implements EditableSource {
  readonly group = new Group();
  private readonly materials: Material[] = [];
  private readonly placed: EditablePiece[] = [];
  private candle: CandleLight | null = null;

  /**
   * @param has whether a model's asset id is in the manifest (a file in src/assets/models)
   * @param layout where the pieces stand (the room layout file); a piece it doesn't list stands at its default
   */
  constructor(
    private readonly has: (id: string) => boolean,
    private readonly layout: Readonly<RoomLayout> | null = null,
  ) {}

  /** The pieces that loaded, for the room editor. */
  editables(): readonly EditablePiece[] {
    return this.placed;
  }

  /** A piece was moved: the candle's shadows are baked again. */
  moved(): void {
    this.candle?.rebake();
  }

  /** Loads every piece there is a file for, puts it in the room, lit by `candle` and casting its shadows. Never rejects. */
  async load(candle: CandleLight, pieces: readonly RoomPiece[] = ROOM_PIECES): Promise<number> {
    this.candle = candle;
    let placed = 0;
    await Promise.all(
      pieces.map(async (piece) => {
        const id = piece.ids.find((i) => this.has(i));
        if (!id) return;
        try {
          await AssetManager.loadGLTFById(id);
          const gltf = AssetManager.getGLTF(id);
          if (!gltf) return;
          this.add(gltf.scene, piece, candle);
          placed++;
        } catch (e) {
          console.warn(`room model "${id}" did not load:`, e);
        }
      }),
    );
    if (placed > 0) candle.rebake();
    return placed;
  }

  private add(model: Object3D, piece: RoomPiece, candle: CandleLight): void {
    // The room's look: each surface its own colour and texture, lit by the room's one light.
    toRoomLook(model, candle, this.materials);

    // Fit it to its footprint (in its own axes), scaled evenly to fill it, its base on the floor. The holder then takes the
    // layout's placement (by default at `at`, turned by `yaw`).
    const holder = new Group();
    holder.name = piece.id;
    holder.add(model);
    for (const name of piece.hide ?? []) {
      const part = model.getObjectByName(name);
      if (part) part.visible = false;
    }
    const box = new Box3().setFromObject(model);
    const dims = box.getSize(new Vector3());
    const [w, d] = piece.size;
    const scale = Math.min(w / Math.max(dims.x, 1e-3), d / Math.max(dims.z, 1e-3));
    model.scale.setScalar(scale);
    box.setFromObject(model);
    const centre = box.getCenter(new Vector3());
    model.position.set(-centre.x, -box.min.y, -centre.z);
    if (piece.part) drawApart(holder, model, piece.part);
    const fallback = defaultPlacement(piece);
    this.group.add(holder);
    applyPlacement(holder, placementOr(this.layout, 'room', piece.id, fallback));
    this.placed.push({ id: piece.id, section: 'room', object: holder, fallback });
  }

  dispose(): void {
    for (const m of this.materials) m.dispose();
  }
}

/**
 * Moves every point of `model` either side of its holder's middle (x = 0, across its width) `by` metres further out, so its
 * halves stand further apart and whatever spans the middle stretches. The holder must not be placed yet (its space is the
 * fitted model's). The meshes get their own copies of their geometry.
 */
function drawApart(holder: Object3D, model: Object3D, by: number): void {
  holder.updateMatrixWorld(true);
  const p = new Vector3();
  const inverse = new Matrix4();
  model.traverse((o) => {
    if (!(o instanceof Mesh)) return;
    const geometry = (o.geometry as BufferGeometry).clone();
    const position = geometry.getAttribute('position');
    inverse.copy(o.matrixWorld).invert();
    for (let i = 0; i < position.count; i++) {
      p.fromBufferAttribute(position, i).applyMatrix4(o.matrixWorld);
      p.x += Math.sign(p.x) * by;
      p.applyMatrix4(inverse);
      position.setXYZ(i, p.x, p.y, p.z);
    }
    position.needsUpdate = true;
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    o.geometry = geometry;
  });
}
