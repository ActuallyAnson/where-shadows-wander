import { describe, expect, it } from 'vitest';
import { CandleLight } from './candle-light';
import { footprint, onFloor, placementOr, ROOM_FLOOR } from '../stage/room-layout';
import { ROOM_WALL_BEHIND_STAGE_M, WALL_DISTANCE_M } from '../stage/stage-frame';
import { readBedroomLayout } from './bedroom-layout';
import { defaultPlacement, ROOM_PIECES, RoomModels } from './room-models';

describe('RoomModels', () => {
  it('places nothing when no model file is there', async () => {
    const models = new RoomModels(() => false);
    const candle = new CandleLight();
    expect(await models.load(candle)).toBe(0);
    expect(models.group.children).toHaveLength(0);
    candle.dispose();
  });
  it('names every asset id as the manifest does', () => {
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
    // The layout is checked against the room as it is played: the wall ahead where the stage always stands (WALL_DISTANCE_M,
    // z -2.02), not the nearest it could come. A door is set into a wall, so it may go into it by up to half its depth.
    const frontWallZ = -(WALL_DISTANCE_M + ROOM_WALL_BEHIND_STAGE_M);
    const intoWall: Readonly<Record<string, number>> = { door: 0.5 };
    for (const p of ROOM_PIECES) {
      const at = placementOr(layout, 'room', p.id, defaultPlacement(p));
      const size: [number, number] = [p.size[0] * at.scale[0], p.size[1] * at.scale[2]];
      const slack = 0.001 + (intoWall[p.id] ?? 0) * size[1];
      const f = footprint(at.pos, size, at.rotDeg[1]);
      const inside =
        f.minX >= ROOM_FLOOR.minX - slack &&
        f.maxX <= ROOM_FLOOR.maxX + slack &&
        f.minZ >= frontWallZ - slack &&
        f.maxZ <= ROOM_FLOOR.maxZ + slack;
      expect(inside, p.id).toBe(true);
    }
  });
});
