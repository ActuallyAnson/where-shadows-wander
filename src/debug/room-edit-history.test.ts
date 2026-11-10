import { describe, expect, it } from 'vitest';
import { placement } from '../engine/stage/room-layout';
import { RoomEditHistory } from './room-edit-history';

const at = (z: number) => placement([0, 0, z]);

describe('RoomEditHistory', () => {
  it('undoes and redoes in order, and a new change clears the redo list', () => {
    const h = new RoomEditHistory();
    expect(h.push('room:bed', at(0), at(1))).toBe(true);
    h.push('room:rug', at(0), at(2));
    expect(h.undo()?.key).toBe('room:rug');
    expect(h.undo()?.before).toEqual(at(0));
    expect(h.undo()).toBeNull();
    expect(h.redo()?.after).toEqual(at(1));
    expect(h.canRedo).toBe(true);
    h.push('room:chair', at(0), at(3));
    expect(h.canRedo).toBe(false);
    expect(h.redo()).toBeNull();
  });

  it('does not record a change the file could not tell apart', () => {
    const h = new RoomEditHistory();
    expect(h.push('room:bed', at(0), at(0.0002))).toBe(false);
    expect(h.canUndo).toBe(false);
  });

  it('keeps its own copies', () => {
    const h = new RoomEditHistory();
    const p = at(1);
    h.push('room:a', at(0), p);
    p.pos[2] = 9;
    expect(h.undo()?.after).toEqual(at(1));
  });

  it('keeps only the last `limit` steps', () => {
    const h = new RoomEditHistory(2);
    h.push('room:a', at(0), at(1));
    h.push('room:b', at(0), at(2));
    h.push('room:c', at(0), at(3));
    expect(h.undo()?.key).toBe('room:c');
    expect(h.undo()?.key).toBe('room:b');
    expect(h.undo()).toBeNull();
  });
});
