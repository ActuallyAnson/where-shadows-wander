// Undo and redo for the room editor (room-editor.ts): each step is one piece going from one placement to another.
// No three.js and no DOM, so it is tested in Node.
import { copyPlacement, samePlacement, type Placement } from '../engine/stage/room-layout';

export interface RoomEdit {
  /** The piece's id and section (`room:bed`, `lap:quilt`). */
  readonly key: string;
  readonly before: Readonly<Placement>;
  readonly after: Readonly<Placement>;
}

export class RoomEditHistory {
  private readonly done: RoomEdit[] = [];
  private readonly undone: RoomEdit[] = [];

  constructor(private readonly limit = 200) {}

  /** Records a change; one that changes nothing (as the file would store it) is not recorded. Clears the redo list. */
  push(key: string, before: Readonly<Placement>, after: Readonly<Placement>): boolean {
    if (samePlacement(before, after)) return false;
    this.done.push({ key, before: copyPlacement(before), after: copyPlacement(after) });
    if (this.done.length > this.limit) this.done.shift();
    this.undone.length = 0;
    return true;
  }

  /** The step to take back (put its piece at `before`), or null. */
  undo(): RoomEdit | null {
    const e = this.done.pop();
    if (!e) return null;
    this.undone.push(e);
    return e;
  }

  /** The step to make again (put its piece at `after`), or null. */
  redo(): RoomEdit | null {
    const e = this.undone.pop();
    if (!e) return null;
    this.done.push(e);
    return e;
  }

  get canUndo(): boolean {
    return this.done.length > 0;
  }

  get canRedo(): boolean {
    return this.undone.length > 0;
  }
}
