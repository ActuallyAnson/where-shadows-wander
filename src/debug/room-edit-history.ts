// Undo and redo for the room editor (room-editor.ts). A step is a piece moving from one placement to another, or a piece being
// added to or taken out of the room (a placed model: `item` is what the editor needs to put it back or take it out again).
// No three.js and no DOM, so it is tested in Node.
import { copyPlacement, samePlacement, type Placement } from '../engine/stage/room-layout';

/** A piece moved: undo puts it at `before`, redo at `after`. */
export interface MoveEdit {
  readonly kind: 'move';
  /** The piece's id and section (`room:bed`, `lap:tray`). */
  readonly key: string;
  readonly before: Readonly<Placement>;
  readonly after: Readonly<Placement>;
}

/** A piece added (undo takes it out, redo puts it back) or removed (the other way round). */
export interface AddRemoveEdit<T> {
  readonly kind: 'add' | 'remove';
  readonly key: string;
  readonly item: T;
}

export type RoomEdit<T = unknown> = MoveEdit | AddRemoveEdit<T>;

export class RoomEditHistory<T = unknown> {
  private readonly done: RoomEdit<T>[] = [];
  private readonly undone: RoomEdit<T>[] = [];

  constructor(private readonly limit = 200) {}

  /** Records a move; one that changes nothing (as the file would store it) is not recorded. Clears the redo list. */
  push(key: string, before: Readonly<Placement>, after: Readonly<Placement>): boolean {
    if (samePlacement(before, after)) return false;
    this.record({ kind: 'move', key, before: copyPlacement(before), after: copyPlacement(after) });
    return true;
  }

  /** Records a piece added to the room. Clears the redo list. */
  pushAdd(key: string, item: T): void {
    this.record({ kind: 'add', key, item });
  }

  /** Records a piece taken out of the room. Clears the redo list. */
  pushRemove(key: string, item: T): void {
    this.record({ kind: 'remove', key, item });
  }

  /** The step to take back, or null. */
  undo(): RoomEdit<T> | null {
    const e = this.done.pop();
    if (!e) return null;
    this.undone.push(e);
    return e;
  }

  /** The step to make again, or null. */
  redo(): RoomEdit<T> | null {
    const e = this.undone.pop();
    if (!e) return null;
    this.done.push(e);
    return e;
  }

  /** The items of every add and remove step still in the history (pieces that undo or redo may bring back). */
  items(): T[] {
    const out: T[] = [];
    for (const e of [...this.done, ...this.undone]) if (e.kind !== 'move' && !out.includes(e.item)) out.push(e.item);
    return out;
  }

  get canUndo(): boolean {
    return this.done.length > 0;
  }

  get canRedo(): boolean {
    return this.undone.length > 0;
  }

  private record(e: RoomEdit<T>): void {
    this.done.push(e);
    if (this.done.length > this.limit) this.done.shift();
    this.undone.length = 0;
  }
}
