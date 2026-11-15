// Real 3D furniture and keepsakes for the bedroom (most from Kenney's Furniture Kit, CC0: https://kenney.nl/assets/furniture-kit;
// the rest credited in CREDITS.md), in place of the
// painted stand-ins where they exist (the bed, the bookcase, the rug) and as extra pieces round the room. Each piece is a .glb in
// src/assets/models, loaded when the room is placed; a piece whose file is missing simply is not there (and its painted
// stand-in stays), so the room never waits on, or breaks for, a model.
//
// Every model's materials become the room's kind (MeshBasicMaterial, its own colour and texture), lit by the candle and the moon
// (candle-light.ts), and every model casts the candle's shadows. Positions are in RoomDressingView's space (the room: x right,
// y up from the floor, -z toward the wall the shadows play on).
//
// Where each piece stands comes from the room layout file (content/rooms/bedroom.json, src/engine/stage/room-layout.ts) under
// the piece's `id`; `at` and `yaw` below are the defaults when the file has no entry. The layout's scale multiplies the fitted size.
import { AssetManager, Box3, Group, Vector3 } from '@iwsdk/core';
import type { Material, Object3D } from '@iwsdk/core';
import type { CandleLight } from './candle-light';
import { toRoomLook } from './room-look';
import { placement, placementOr, type Placement, type RoomLayout } from '../stage/room-layout';
import { ROOM_BACK_WALL_Z } from '../stage/stage-frame';
import { applyPlacement, type EditablePiece, type EditableSource } from './room-placement';

/** A painted piece of RoomDressingView that a model can take the place of. */
export type StandIn = 'bed' | 'bookcase' | 'rug';

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
  /** The painted stand-in it replaces, hidden once the model is in (see RoomDressingView.hideStandIn). */
  readonly replaces?: StandIn;
  /** Parts of the model (by node name) left out: something of the game's own is there instead. */
  readonly hide?: readonly string[];
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
    replaces: 'bed',
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
    replaces: 'bookcase',
  },
  // (Nothing stands along the wall ahead: the whole of it is kept clear for the shadows.)
  // A round rug beside the bed, between it and the right wall, in place of the painted one (its top 4 mm above the floor).
  {
    id: 'rug',
    ids: ['ruground', 'rug-round', 'rugrounded'],
    at: [1.2, -0.012, -0.35],
    size: [1.2, 1.2],
    replaces: 'rug',
  },
  // A chair in front of the window, facing into the room, and a plant just this side of the window.
  { id: 'chair', ids: ['chair', 'chaircushion'], at: [-1.45, 0, -0.8], size: [0.4, 0.4], yaw: Math.PI / 2 },
  { id: 'plant', ids: ['pottedplant', 'potted-plant', 'plantsmall1'], at: [-1.75, 0, 0.05], size: [0.35, 0.4] },

  // Her keepsakes, on top of the bookcase (1.32 m up), behind the player's right shoulder: half seen in the dark at first, and
  // found by the last of the candle in scene 7 (docs/STORY.md). The jar she gave him on the firefly night (0.17 m tall, its lid
  // on) and her torch from the night they met, lying on its side, its lens turned into the room.
  { id: 'jar', ids: ['glassjar'], at: [1.5, 1.32, 0.3], size: [0.11, 0.11] },
  { id: 'torch', ids: ['flashlight'], at: [1.72, 1.32, 0.28], size: [0.07, 0.2], yaw: -Math.PI / 2 + 0.3 },
  // He has just moved in (the prologue's boxes): a stack of taped boxes in the corner ahead on the right (0.68 m high), by the
  // pictures; behind his left shoulder, beside the bed's head, an open box half unpacked and a flat one with folded blankets on
  // it (its top 0.235 m up, the blankets 0.11 m high).
  { id: 'boxes', ids: ['cardboardboxstack'], at: [1.7, 0, -1.2], size: [0.55, 0.4], yaw: -Math.PI / 2 },
  { id: 'box-open', ids: ['cardboardboxopen'], at: [-0.85, 0, 0.32], size: [0.42, 0.25], yaw: 0.25 },
  { id: 'box-flat', ids: ['cardboardboxflat'], at: [-1.35, 0, 0.34], size: [0.45, 0.34], yaw: Math.PI },
  { id: 'blankets', ids: ['blanketsfolded'], at: [-1.35, 0.235, 0.34], size: [0.4, 0.27], yaw: Math.PI + 0.1 },
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
   * @param hideStandIn hides the painted stand-in a model replaces
   * @param layout where the pieces stand (the room layout file); a piece it doesn't list stands at its default
   */
  constructor(
    private readonly has: (id: string) => boolean,
    private readonly hideStandIn: (part: StandIn) => void,
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
          if (piece.replaces) this.hideStandIn(piece.replaces);
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
    const fallback = defaultPlacement(piece);
    this.group.add(holder);
    applyPlacement(holder, placementOr(this.layout, 'room', piece.id, fallback));
    this.placed.push({ id: piece.id, section: 'room', object: holder, fallback });
  }

  dispose(): void {
    for (const m of this.materials) m.dispose();
  }
}
