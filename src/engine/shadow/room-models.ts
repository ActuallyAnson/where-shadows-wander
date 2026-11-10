// Real 3D furniture for the bedroom (Kenney's Furniture Kit, CC0: https://kenney.nl/assets/furniture-kit), in place of the
// painted stand-ins where they exist (the bed, the bookcase, the rug) and as extra pieces round the room. Each piece is a .glb in
// src/assets/models, loaded when the room is placed; a piece whose file is missing simply is not there (and its painted
// stand-in stays), so the room never waits on, or breaks for, a model.
//
// Every model's materials become the room's kind (MeshBasicMaterial, its own colour and texture), lit by the candle and the moon
// (candle-light.ts), and every model casts the candle's shadows. Positions are in RoomDressingView's space (the room: x right,
// y up from the floor, -z toward the wall the shadows play on).
import { AssetManager, Box3, DoubleSide, Group, Mesh, MeshBasicMaterial, Vector3 } from '@iwsdk/core';
import type { Material, Object3D, Texture } from '@iwsdk/core';
import type { CandleLight } from './candle-light';

/** A painted piece of RoomDressingView that a model can take the place of. */
export type StandIn = 'bed' | 'bookcase' | 'rug';

/** One piece of furniture: which file, where it stands, and the space it fills. */
export interface RoomPiece {
  /** Asset ids to try, in order (the file name in lower case: `bedSingle.glb` is `bedsingle`). The first one there is used. */
  readonly ids: readonly string[];
  /** Where the middle of its footprint stands on the floor (x, z) and how high its base is (y), metres. */
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
  // The bed along the right wall, its headboard toward the wall ahead: 0.86 x 1.7 m, 0.57 m high. (15 cm nearer than the painted
  // one, whose head went through the wall when the wall is at its nearest.)
  { ids: ['bedsingle', 'bed-single', 'beddouble'], at: [1.4, 0, -0.65], size: [0.9, 1.7], replaces: 'bed' },
  // The bookcase on the right wall past the bed's foot, its open side to the room: 0.6 m wide, 1.32 m high.
  {
    ids: ['bookcaseopen', 'bookcase-open', 'bookcaseclosedwide', 'bookcaseclosed'],
    at: [1.8, 0, 0.55],
    size: [0.6, 0.38],
    yaw: -Math.PI / 2,
    replaces: 'bookcase',
  },
  // A small table by the bed's head (its top at 0.36 m), with a lamp and a stack of books on it.
  { ids: ['sidetable', 'side-table', 'sidetabledrawers'], at: [0.66, 0, -1.4], size: [0.5, 0.21] },
  { ids: ['lamproundtable', 'lamp-round-table', 'lampsquaretable'], at: [0.55, 0.36, -1.4], size: [0.15, 0.174] },
  { ids: ['books'], at: [0.8, 0.36, -1.4], size: [0.15, 0.095], yaw: -0.3 },
  // A round rug under the player and the tray, in place of the painted one (its top 4 mm above the floor, under the moonlight on it).
  { ids: ['ruground', 'rug-round', 'rugrounded'], at: [0.1, -0.012, -0.4], size: [1.5, 1.5], replaces: 'rug' },
  // A teddy bear on the floor by the bed, between the lap blanket and the side table, turned to the player: 0.29 m high.
  { ids: ['bear'], at: [0.72, 0, -1.05], size: [0.25, 0.16], yaw: -0.6 },
  // A chair in front of the window, facing into the room, and a plant just this side of the window.
  { ids: ['chair', 'chaircushion'], at: [-1.45, 0, -0.8], size: [0.4, 0.4], yaw: Math.PI / 2 },
  { ids: ['pottedplant', 'potted-plant', 'plantsmall1'], at: [-1.75, 0, 0.05], size: [0.35, 0.4] },
];

export class RoomModels {
  readonly group = new Group();
  private readonly materials: Material[] = [];

  /**
   * @param has whether a model's asset id is in the manifest (a file in src/assets/models)
   * @param hideStandIn hides the painted stand-in a model replaces
   */
  constructor(
    private readonly has: (id: string) => boolean,
    private readonly hideStandIn: (part: StandIn) => void,
  ) {}

  /** Loads every piece there is a file for, puts it in the room, lit by `candle` and casting its shadows. Never rejects. */
  async load(candle: CandleLight, pieces: readonly RoomPiece[] = ROOM_PIECES): Promise<number> {
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

    // Fit it to its footprint (in its own axes), scaled evenly to fill it, its base on the floor; then turn it by `yaw`.
    const holder = new Group();
    holder.add(model);
    const box = new Box3().setFromObject(model);
    const dims = box.getSize(new Vector3());
    const [w, d] = piece.size;
    const scale = Math.min(w / Math.max(dims.x, 1e-3), d / Math.max(dims.z, 1e-3));
    model.scale.setScalar(scale);
    box.setFromObject(model);
    const centre = box.getCenter(new Vector3());
    model.position.set(-centre.x, -box.min.y, -centre.z);
    holder.rotation.y = piece.yaw ?? 0;
    holder.position.set(piece.at[0], piece.at[1], piece.at[2]);
    this.group.add(holder);
    holder.updateMatrixWorld(true);
  }

  dispose(): void {
    for (const m of this.materials) m.dispose();
  }
}
