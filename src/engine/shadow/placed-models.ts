// The models placed in the room with the room editor: every layout entry that names a `model` (an asset id, a .glb under
// src/assets) is loaded and stood where the entry says, in the room (room space) or on the lap (the tray's space). Unlike the
// furniture the code places (room-models.ts), they are not fitted to a size: a model keeps its own size, times the layout's
// scale. Each is moved so the middle of its base is at its origin, so it turns about its middle and stands on what it is
// placed on.
//
// A model whose file is missing or fails to load is left out with a warning; its entry stays in the layout file.
import { Box3, Group, Vector3 } from '@iwsdk/core';
import type { Material, MeshBasicMaterial, Object3D } from '@iwsdk/core';
import type { CandleLight } from './candle-light';
import { toRoomLook } from './room-look';
import { applyPlacement, type EditablePiece, type EditableSource } from './room-placement';
import {
  copyPlacement,
  LAYOUT_SECTIONS,
  type LayoutSection,
  type Placement,
  type RoomLayout,
} from '../stage/room-layout';

/** Loads an asset by id: a fresh copy of the model's scene, or null if there is no such model. May reject. */
export type ModelLoader = (assetId: string) => Promise<Object3D | null>;

/** A model placed in the room: an editable piece that also says which asset it shows. */
export interface PlacedPiece extends EditablePiece {
  readonly model: string;
}

export class PlacedModels implements EditableSource {
  private readonly pieces: PlacedPiece[] = [];
  private readonly materials: Material[] = [];
  private readonly shared = new Map<Material, MeshBasicMaterial>();
  private readonly box = new Box3();
  private readonly centre = new Vector3();
  private candle: CandleLight | null = null;

  /**
   * @param parents what each layout section's pieces stand in (the room's group, the tray's group)
   * @param loader loads a model by asset id
   * @param layout the room layout; its entries with a `model` are loaded by `load`
   */
  constructor(
    private readonly parents: Readonly<Record<LayoutSection, Object3D>>,
    private loader: ModelLoader,
    private readonly layout: Readonly<RoomLayout> | null = null,
  ) {}

  /** The placed models standing now, for the room editor. */
  editables(): readonly PlacedPiece[] {
    return this.pieces;
  }

  /** A model was moved: the candle's shadows are baked again. */
  moved(): void {
    this.candle?.rebake();
  }

  /** Swaps how models are loaded (the room editor loads files added since the page loaded by their URL). */
  setLoader(loader: ModelLoader): void {
    this.loader = loader;
  }

  /** Loads every model the layout places, lit by `candle` and casting its shadows. Never rejects. Returns how many stand. */
  async load(candle: CandleLight): Promise<number> {
    this.candle = candle;
    if (!this.layout) return 0;
    const layout = this.layout;
    const placed = await Promise.all(
      LAYOUT_SECTIONS.flatMap((section) =>
        Object.entries(layout[section])
          .filter(([, entry]) => entry.model !== undefined)
          .map(([id, entry]) => this.add(section, id, entry.model as string, entry)),
      ),
    );
    return placed.filter((p) => p !== null).length;
  }

  /** Loads `model` and stands it in `section` at `at`, as piece `id`. Never rejects: null if the model would not load. */
  async add(section: LayoutSection, id: string, model: string, at: Readonly<Placement>): Promise<PlacedPiece | null> {
    let scene: Object3D | null;
    try {
      scene = await this.loader(model);
    } catch (e) {
      console.warn(`placed model "${id}" (${model}) did not load:`, e);
      return null;
    }
    if (!scene) {
      console.warn(`placed model "${id}": there is no model "${model}" in src/assets`);
      return null;
    }
    if (this.candle) toRoomLook(scene, this.candle, this.materials, this.shared);
    // The middle of its base at the holder's origin.
    scene.position.set(0, 0, 0);
    scene.updateMatrixWorld(true);
    this.box.setFromObject(scene);
    if (!this.box.isEmpty()) {
      this.box.getCenter(this.centre);
      scene.position.set(-this.centre.x, -this.box.min.y, -this.centre.z);
    }
    const holder = new Group();
    holder.name = id;
    holder.add(scene);
    const piece: PlacedPiece = { id, section, object: holder, fallback: copyPlacement(at), model };
    this.reattach(piece);
    applyPlacement(holder, at);
    return piece;
  }

  /** Takes a piece out of the room (it can be put back with `reattach`, as undo does). */
  detach(piece: PlacedPiece): void {
    const at = this.pieces.indexOf(piece);
    if (at >= 0) this.pieces.splice(at, 1);
    piece.object.removeFromParent();
    this.candle?.rebake();
  }

  /** Puts a piece taken out by `detach` back where it was. */
  reattach(piece: PlacedPiece): void {
    if (!this.pieces.includes(piece)) this.pieces.push(piece);
    this.parents[piece.section].add(piece.object);
    piece.object.updateMatrixWorld(true);
    this.candle?.rebake();
  }

  dispose(): void {
    for (const m of this.materials) m.dispose();
  }
}
