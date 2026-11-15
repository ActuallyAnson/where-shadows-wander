// Puts the room's static pieces where the room layout (src/engine/stage/room-layout.ts, content/rooms/bedroom.json) says,
// and describes them to the dev room editor (src/debug/room-editor.ts).
//
// Each editable piece is one Object3D, named by its id, whose own position, rotation and scale are the placement. What it
// looks like is built around its own origin, so moving it in the editor moves all of it.
import type { Object3D } from '@iwsdk/core';
import { placement, type LayoutSection, type Placement } from '../stage/room-layout';

const DEG = Math.PI / 180;

/** Sets an object's transform from a placement. Static pieces don't update their matrix each frame, so it is updated here. */
export function applyPlacement(o: Object3D, p: Readonly<Placement>): void {
  o.position.set(p.pos[0], p.pos[1], p.pos[2]);
  o.rotation.set(p.rotDeg[0] * DEG, p.rotDeg[1] * DEG, p.rotDeg[2] * DEG, 'XYZ');
  o.scale.set(p.scale[0], p.scale[1], p.scale[2]);
  o.updateMatrix();
  o.updateMatrixWorld(true);
}

/** An object's own transform as a placement (its rotation read in Euler order XYZ). */
export function readPlacement(o: Object3D): Placement {
  const r = o.rotation.order === 'XYZ' ? o.rotation : o.rotation.clone().reorder('XYZ');
  return placement(
    [o.position.x, o.position.y, o.position.z],
    [r.x / DEG, r.y / DEG, r.z / DEG],
    [o.scale.x, o.scale.y, o.scale.z],
  );
}

/** A piece of the room the editor can move. */
export interface EditablePiece {
  /** Its id in the layout file (also the object's name). */
  readonly id: string;
  /** The layout section it belongs to: room space, or the tray's own space. */
  readonly section: LayoutSection;
  /** The object whose transform is the placement. */
  readonly object: Object3D;
  /** Where the code puts it when the file says nothing: what the editor's Reset goes back to. */
  readonly fallback: Readonly<Placement>;
}

/** Something that owns editable pieces: a view of the room. */
export interface EditableSource {
  /** Its pieces, at the time of asking (models that load later are added as they arrive). */
  editables(): readonly EditablePiece[];
  /** Called after a piece has been moved, so the owner can catch up (the candle's shadows are baked, for one). */
  moved?(piece: EditablePiece): void;
}
