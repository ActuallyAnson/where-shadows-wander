// Real 3D furniture for the bedroom (Kenney's Furniture Kit, CC0: https://kenney.nl/assets/furniture-kit), in place of the
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
import { AssetManager, Box3, DoubleSide, Group, Mesh, MeshBasicMaterial, Vector3 } from '@iwsdk/core';
import type { Material, Object3D, Texture } from '@iwsdk/core';
import type { CandleLight } from './candle-light';
import { placement, placementOr, type Placement, type RoomLayout } from '../stage/room-layout';
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
}

/**
 * The furniture, by the room's layout (the player sits at the origin looking down -z; the walls are at x = ±2, and the wall
 * the shadows play on is at least 1.52 m ahead, so nothing stands beyond z = -1.5; the window is on the left wall, z -1.35..-0.25).
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
  },
  // The bookcase on the right wall past the bed's foot, its open side to the room: 0.6 m wide, 1.32 m high.
  {
    id: 'bookcase',
    ids: ['bookcaseopen', 'bookcase-open', 'bookcaseclosedwide', 'bookcaseclosed'],
    at: [1.8, 0, 0.55],
    size: [0.6, 0.38],
    yaw: -Math.PI / 2,
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
    model.traverse((o) => {
      if (!(o instanceof Mesh)) return;
      const source = (Array.isArray(o.material) ? o.material : [o.material]) as (Material & {
        color?: { getHex(): number };
        map?: Texture | null;
      })[];
      const made = source.map((m) => {
        const basic = new MeshBasicMaterial({
          color: m.color ? m.color.getHex() : 0xffffff,
          map: m.map ?? null,
          vertexColors: o.geometry.hasAttribute('color'),
          side: DoubleSide,
          toneMapped: false,
        });
        candle.light(basic);
        this.materials.push(basic);
        return basic;
      });
      o.material = made.length === 1 ? made[0] : made;
      candle.cast(o);
    });

    // Fit it to its footprint (in its own axes), scaled evenly to fill it, its base on the floor. The holder then takes the
    // layout's placement (by default at `at`, turned by `yaw`).
    const holder = new Group();
    holder.name = piece.id;
    holder.add(model);
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
