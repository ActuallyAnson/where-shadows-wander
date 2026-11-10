import { describe, expect, it } from 'vitest';
import { CandleLight } from './candle-light';
import { footprint, onFloor, placementOr } from '../stage/room-layout';
import { readBedroomLayout } from './bedroom-layout';
import { defaultPlacement, ROOM_PIECES, RoomModels } from './room-models';

describe('RoomModels', () => {
  it('places nothing and hides no painted piece when no model file is there', async () => {
    const hidden: string[] = [];
    const models = new RoomModels(
      () => false,
      (part) => void hidden.push(part),
    );
    const candle = new CandleLight();
    expect(await models.load(candle)).toBe(0);
    expect(models.group.children).toHaveLength(0);
    expect(hidden).toEqual([]);
    candle.dispose();
  });
  it('lists the bed, the bookcase and the rug as replacing their painted stand-ins, with asset ids as the manifest names them', () => {
    expect(ROOM_PIECES.filter((p) => p.replaces).map((p) => p.replaces)).toEqual(['bed', 'bookcase', 'rug']);
    for (const p of ROOM_PIECES) for (const id of p.ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });
  it('gives every piece a layout id, and keeps every default inside the room, short of the nearest the wall ahead can come', () => {
    expect(new Set(ROOM_PIECES.map((p) => p.id)).size).toBe(ROOM_PIECES.length);
    for (const p of ROOM_PIECES) {
      const d = defaultPlacement(p);
      expect(onFloor(footprint(d.pos, p.size, d.rotDeg[1])), p.id).toBe(true);
    }
  });
  it("reads the bedroom's layout file cleanly, and every piece placed there stays inside the room", () => {
    const { layout, problems } = readBedroomLayout();
    expect(problems).toEqual([]);
    for (const p of ROOM_PIECES) {
      const at = placementOr(layout, 'room', p.id, defaultPlacement(p));
      const size: [number, number] = [p.size[0] * at.scale[0], p.size[1] * at.scale[2]];
      expect(onFloor(footprint(at.pos, size, at.rotDeg[1]), 0.001), p.id).toBe(true);
    }
  });
});
