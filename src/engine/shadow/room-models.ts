// Real 3D furniture for the bedroom (Kenney's Furniture Kit, CC0: https://kenney.nl/assets/furniture-kit), in place of the
// painted stand-ins where they exist (the bed, the bookcase) and as extra pieces round the room. Each piece is a .glb in
// src/assets/models, loaded when the room is placed; a piece whose file is missing simply is not there (and its painted
// stand-in stays), so the room never waits on, or breaks for, a model.
//
// Every model's materials become the room's kind (MeshBasicMaterial, its own colour and texture), lit by the candle and the moon
// (candle-light.ts), and every model casts the candle's shadows. Positions are in RoomDressingView's space (the room: x right,
// y up from the floor, -z toward the wall the shadows play on).
import { AssetManager, Box3, DoubleSide, Group, Mesh, MeshBasicMaterial, Vector3 } from '@iwsdk/core';
import type { Material, Object3D, Texture } from '@iwsdk/core';
import type { CandleLight } from './candle-light';

/** One piece of furniture: which file, where it stands, and the space it fills. */
export interface RoomPiece {
  /** Asset ids to try, in order (the file name in lower case: `bedSingle.glb` is `bedsingle`). The first one there is used. */
  readonly ids: readonly string[];
  /** Where the middle of its footprint stands on the floor (x, z) and how high its base is (y), metres. */
  readonly at: readonly [number, number, number];
  /** The footprint it is scaled to fit (x across, z deep, metres) and its longest side lies along. */
  readonly size: readonly [number, number];
  /** Turn about the vertical, after the fit (radians): which way its front faces. */
  readonly yaw?: number;
  /** The painted stand-in it replaces, hidden once the model is in (see RoomDressingView.hideStandIn). */
  readonly replaces?: 'bed' | 'bookcase';
}

/** The furniture, by the room's layout: the bed and bookcase along the right wall, a bedside table and lamp, a plant. */
export const ROOM_PIECES: readonly RoomPiece[] = [
  // The bed: its head against the wall ahead, along the right wall (as the painted one).
  { ids: ['bedsingle', 'bed-single', 'beddouble'], at: [1.4, 0, -0.8], size: [0.9, 1.7], replaces: 'bed' },
  // The bookcase on the right wall, its open side toward the room.
  {
    ids: ['bookcaseopen', 'bookcase-open', 'bookcaseclosedwide', 'bookcaseclosed'],
    at: [1.78, 0, -1.25],
    size: [0.36, 1.0],
    yaw: -Math.PI / 2,
    replaces: 'bookcase',
  },
  // A small table by the bed's head, with a lamp on it.
  { ids: ['sidetable', 'side-table', 'sidetabledrawers'], at: [0.72, 0, -1.6], size: [0.4, 0.4] },
  { ids: ['lamproundtable', 'lamp-round-table', 'lampsquaretable'], at: [0.72, 0.42, -1.6], size: [0.2, 0.2] },
  // A plant in the far left corner, by the window.
  { ids: ['pottedplant', 'potted-plant', 'plantsmall1'], at: [-1.7, 0, -1.9], size: [0.4, 0.4] },
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
    private readonly hideStandIn: (part: 'bed' | 'bookcase') => void,
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

    // Fit it to its footprint: its longest side along the footprint's, scaled to fill it, its base on the floor.
    const holder = new Group();
    holder.add(model);
    const box = new Box3().setFromObject(model);
    const dims = box.getSize(new Vector3());
    const [w, d] = piece.size;
    if (dims.x > dims.z !== w > d) model.rotation.y = Math.PI / 2;
    box.setFromObject(model);
    box.getSize(dims);
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
